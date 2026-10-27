#!/usr/bin/env bash
# Movilidades Erasmus+ MMG: actualización y reversión con backup cifrado.
set -Eeuo pipefail
umask 077
export DEBIAN_FRONTEND=noninteractive GIT_TERMINAL_PROMPT=0

BASE=/opt/erasmusplus
RELEASES="$BASE/releases"
CURRENT="$BASE/current"
DATA=/var/lib/erasmusplus
BACKUP_DIR=/var/backups/erasmusplus
IDENTITY=/etc/erasmusplus/backup-identity.txt
RECIPIENTS=/etc/erasmusplus/backup-recipient.txt
SETTINGS=/etc/erasmusplus/updater.conf
REPO=https://github.com/atreyu1968/erasmusplus.git
# The origin can run in a separate Proxmox guest from cloudflared.
# Read the actual bind address to avoid a false failed-update/rollback.
APP_ENV=/etc/erasmusplus/erasmusplus.env
[[ -f "$APP_ENV" ]] || { echo 'Falta archivo del servicio: /etc/erasmusplus/erasmusplus.env' >&2; exit 1; }
BIND_HOST=$(sed -n 's/^HOST=//p' "$APP_ENV" | head -n 1)
BIND_PORT=$(sed -n 's/^PORT=//p' "$APP_ENV" | head -n 1)
BIND_HOST=${BIND_HOST:-127.0.0.1}
BIND_PORT=${BIND_PORT:-3000}
[[ "$BIND_HOST" =~ ^[0-9]{1,3}([.][0-9]{1,3}){3}$ ]] || {
  echo 'HOST debe ser una IPv4 privada o 127.0.0.1 para la comprobación de salud.' >&2
  exit 1
}
[[ "$BIND_PORT" =~ ^[0-9]{1,5}$ ]] || { echo 'PORT no válido en configuración.' >&2; exit 1; }
[[ "$BIND_HOST" == 0.0.0.0 ]] && BIND_HOST=127.0.0.1
HEALTH="http://$BIND_HOST:$BIND_PORT/healthz"
STAGE=
BACKUP=
PREVIOUS=
SWITCHED=0
STOPPED=0

log() { printf '[ERASMUS-MMG] %s\n' "$*"; }
die() { log "ERROR: $*"; if declare -F rollback >/dev/null 2>&1; then rollback 1; else exit 1; fi; }
[[ "$EUID" == 0 ]] || die 'Se requiere sudo/root.'
[[ "${1:-}" == "" || "${1:-}" == "--scheduled" ]] || die 'Uso: erasmusplus-update [--scheduled]'
[[ -f "$SETTINGS" ]] && source "$SETTINGS"
if [[ "${1:-}" == "--scheduled" && "${MMG_AUTO_UPDATE:-0}" != 1 ]]; then
  log 'La aplicación comprobará actualizaciones automáticamente cuando lo autorice coordinación.'
  exit 0
fi
for c in git node npm age tar curl flock runuser systemctl; do
  command -v "$c" >/dev/null || die "Falta el requisito: $c"
done
[[ ! -L "$DATA" ]] || die 'El directorio de datos no puede ser un enlace simbólico.'
[[ -f "$IDENTITY" && -f "$RECIPIENTS" ]] || die 'Faltan claves para backups cifrados con age.'
install -d -m 0700 "$BACKUP_DIR"
install -d -m 0755 "$RELEASES"
exec 9>/run/lock/erasmusplus-update.lock
flock -n 9 || die 'Otra actualización está en curso.'

rollback() {
  local code=${1:-$?}
  trap - ERR INT TERM
  log "Error $code: intentando recuperar código y datos anteriores."
  if [[ "$SWITCHED" == 1 ]]; then
    systemctl stop erasmusplus.service || true
    if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
      ln -s "$PREVIOUS" "$CURRENT.rollback"
      mv -Tf "$CURRENT.rollback" "$CURRENT"
    else
      rm -f "$CURRENT"
    fi
    if [[ -s "$BACKUP" ]]; then
      rm -rf -- "$DATA"
      if ! (age -d -i "$IDENTITY" "$BACKUP" | tar -xz -C /var/lib); then
        log 'ALERTA: restauración fallida. Conserva el respaldo y recupera manualmente.'
        exit 1
      fi
      chown -R erasmusmmg:erasmusmmg "$DATA"
    fi
  fi
  if [[ "$STOPPED" == 1 || "$SWITCHED" == 1 ]]; then
    if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
      systemctl restart erasmusplus.service || true
    else
      systemctl stop erasmusplus.service || true
    fi
  fi
  [[ -n "$STAGE" && -d "$STAGE" ]] && rm -rf -- "$STAGE"
  log 'Consultar: journalctl -u erasmusplus'
  exit "$code"
}
trap rollback ERR INT TERM

OLD_SHA=''
[[ -f "$CURRENT/.revision" ]] && OLD_SHA=$(<"$CURRENT/.revision")
[[ -L "$CURRENT" ]] && PREVIOUS=$(readlink -f "$CURRENT")
log 'Descargando rama main del repositorio autorizado por HTTPS.'
STAGE=$(mktemp -d "$RELEASES/.prepare.XXXXXXXX")
git clone -q --depth 1 --branch main --single-branch "$REPO" "$STAGE"
NEW_SHA=$(git -C "$STAGE" rev-parse HEAD)
[[ "$NEW_SHA" =~ ^[0-9a-f]{40}$ ]] || die 'SHA de Git incorrecto.'
if [[ "$NEW_SHA" == "$OLD_SHA" ]]; then
  log "Ya está instalado $NEW_SHA"
  rm -rf -- "$STAGE"
  STAGE=''
  trap - ERR INT TERM
  exit 0
fi
[[ -f "$STAGE/package-lock.json" ]] || die 'Falta package-lock.json, se cancela la actualización.'
log "Validando versión $NEW_SHA antes de detener el servicio."
(
  cd "$STAGE"
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund
  find src scripts -name '*.mjs' -print0 | xargs -0 -n1 node --check
  # mktemp crea el directorio con permisos 0700: sin esta línea el usuario
  # nobody no puede entrar y las pruebas fallan en un despliegue real.
  chmod 0755 "$STAGE"
  runuser -u nobody -- env HOME=/tmp npm test
)
printf '%s\n' "$NEW_SHA" > "$STAGE/.revision"
chmod -R a+rX "$STAGE"
chmod -R go-w "$STAGE"
FINAL="$RELEASES/$NEW_SHA"
if [[ -d "$FINAL" ]]; then
  rm -rf -- "$STAGE"
else
  mv "$STAGE" "$FINAL"
fi
STAGE=''

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
if [[ -n "$PREVIOUS" ]]; then
  log 'Deteniendo servicio para respaldo consistente de SQLite y documentos.'
  systemctl stop erasmusplus.service
  STOPPED=1
  BACKUP="$BACKUP_DIR/pre-update-$STAMP-${OLD_SHA:0:12}.tar.gz.age"
  tar -cz -C /var/lib erasmusplus | age -R "$RECIPIENTS" -o "$BACKUP"
  chmod 0600 "$BACKUP"
  [[ -s "$BACKUP" ]] || die 'No se pudo crear el respaldo.'
fi

log 'Cambiando enlace de versión de manera atómica.'
ln -s "$FINAL" "$CURRENT.new"
mv -Tf "$CURRENT.new" "$CURRENT"
SWITCHED=1
systemctl start erasmusplus.service
log 'Esperando a que la comprobación local de salud responda ok.'
healthy=0
for i in {1..12}; do
  if [[ "$(curl --noproxy '*' -fsS --max-time 3 "$HEALTH" 2>/dev/null || true)" == ok ]]; then
    healthy=1
    break
  fi
  sleep 2
done
[[ "$healthy" == 1 ]] || die 'La nueva versión no respondió a /healthz.'
SWITCHED=0
STOPPED=0
trap - ERR INT TERM
log "Nueva versión operativa: $NEW_SHA. Cloudflare Tunnel no se ha modificado."
# Renovar el propio actualizador solo después de validar el arranque.
if [[ -f "$FINAL/deploy/update-ubuntu.sh" ]]; then
  install -m 0750 "$FINAL/deploy/update-ubuntu.sh" /usr/local/sbin/.erasmusplus-update.next
  mv -fT /usr/local/sbin/.erasmusplus-update.next /usr/local/sbin/erasmusplus-update
fi
find "$BACKUP_DIR" -maxdepth 1 -name 'pre-update-*.tar.gz.age' -type f -mtime +14 -delete
