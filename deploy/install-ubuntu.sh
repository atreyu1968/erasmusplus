#!/usr/bin/env bash
# Instalador supervisado Ubuntu 22.04/24.04/26.04. No modifica Cloudflare Tunnel.
set -Eeuo pipefail
umask 077
export DEBIAN_FRONTEND=noninteractive
log() { printf '\n[ERASMUS-MMG] %s\n' "$*"; }
die() { printf '\n[ERASMUS-MMG] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$EUID" == 0 ]] || die 'Ejecuta: sudo bash deploy/install-ubuntu.sh'
[[ -f /etc/os-release ]] || die 'No se ha podido identificar Ubuntu.'
source /etc/os-release
[[ "$ID" == ubuntu ]] || die 'El instalador admite únicamente Ubuntu.'
case "$VERSION_ID" in
  22.04|24.04|26.04) ;;
  25.04)
    die 'Ubuntu 25.04 dejó de recibir actualizaciones de seguridad el 15/01/2026. No se instalará Erasmus+ MMG con datos de alumnado sobre un sistema EOL. Se recomienda migrar a Ubuntu 26.04 LTS y conservar el túnel Cloudflare. Instrucciones: https://github.com/atreyu1968/erasmusplus/blob/main/docs/MIGRACION_UBUNTU_25_04.md'
    ;;
  25.10)
    die 'Ubuntu 25.10 dejó de recibir actualizaciones de seguridad el 09/07/2026. Actualiza a Ubuntu 26.04 LTS antes de instalar Erasmus+ MMG. Guía: https://github.com/atreyu1968/erasmusplus/blob/main/docs/MIGRACION_UBUNTU_25_04.md'
    ;;
  *) die "Ubuntu $VERSION_ID no está admitido. Consulta los requisitos de Ubuntu LTS del README." ;;
esac
ARCH=$(dpkg --print-architecture)
[[ "$ARCH" == amd64 || "$ARCH" == arm64 ]] || die "Arquitectura no admitida: $ARCH"
command -v systemctl >/dev/null || die 'Este Ubuntu debe ejecutarse con systemd.'
[[ -d /opt/erasmusplus && -L /opt/erasmusplus/current ]] && log 'Instalación detectada: se respetará la configuración existente.'

SOURCE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
[[ -f "$SOURCE_DIR/update-ubuntu.sh" ]] || die 'El paquete de despliegue no está completo.'
log "Ubuntu $VERSION_ID: actualizando índices APT e instalando requisitos básicos."
if ! apt-get update; then
  die 'No se pudieron actualizar los índices APT. Revisa repositorios, DNS, certificados y soporte de Ubuntu antes de continuar.'
fi
apt-get install -y ca-certificates curl git gnupg openssl age unattended-upgrades

if [[ ! -x /usr/bin/node ]] || [[ "$(/usr/bin/node --version)" != v24.* ]]; then
  log 'Instalando Node.js 24 desde repositorio APT de NodeSource firmado.'
  install -d -m 0755 /usr/share/keyrings
  TMPKEY=$(mktemp)
  curl --proto '=https' --tlsv1.2 --fail --location --silent --show-error \
    https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o "$TMPKEY"
  gpg --batch --yes --dearmor -o /usr/share/keyrings/nodesource.gpg "$TMPKEY"
  rm -f "$TMPKEY"
  chmod 0644 /usr/share/keyrings/nodesource.gpg
  # No sobreescribir repositorios previos configurados por otros servicios.
  if [[ -f /etc/apt/sources.list.d/nodesource.list ||
        -f /etc/apt/sources.list.d/nodesource.sources ]]; then
    die 'Ya existe una configuración NodeSource. Revísala antes de instalar Node.js 24.'
  fi
  cat >/etc/apt/sources.list.d/erasmusmmg-nodesource.sources <<EOF
Types: deb
URIs: https://deb.nodesource.com/node_24.x
Suites: nodistro
Components: main
Architectures: $ARCH
Signed-By: /usr/share/keyrings/nodesource.gpg
EOF
  cat >/etc/apt/preferences.d/erasmusmmg-nodejs <<EOF
Package: nodejs
Pin: origin deb.nodesource.com
Pin-Priority: 600
EOF
  apt-get update
  apt-get install -y nodejs
fi
[[ -x /usr/bin/node && "$(/usr/bin/node --version)" == v24.* ]] || die 'Se requiere Node.js 24 instalado en /usr/bin/node.'
command -v npm >/dev/null || die 'No se ha encontrado npm.'
log "Versiones: $(node --version), npm $(npm --version)."

if [[ ! -L /opt/erasmusplus/current && -f /var/lib/erasmusplus/erasmus.sqlite3 ]]; then
  die 'Existe una base de datos anterior sin despliegue identificado. Haz una copia y migra con TIC antes de continuar.'
fi
id erasmusmmg >/dev/null 2>&1 ||
  useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin erasmusmmg
install -d -m 0755 /opt/erasmusplus /opt/erasmusplus/releases
install -d -m 0700 -o erasmusmmg -g erasmusmmg /var/lib/erasmusplus
install -d -m 0700 /var/backups/erasmusplus
install -d -m 0700 /etc/erasmusplus

ENVFILE=/etc/erasmusplus/erasmusplus.env
if [[ ! -e "$ENVFILE" ]]; then
  SECRET=$(openssl rand -hex 48)
  cat >"$ENVFILE" <<EOF
# Editar solo en este servidor. No subir a GitHub ni enviar por mensajería.
HOST=127.0.0.1
PORT=3000
MMG_DATA_DIR=/var/lib/erasmusplus
MMG_ENV=production
MMG_SECURE_COOKIE=1
MMG_SECRET=$SECRET
MMG_ENABLE_REGISTRATION=0
MMG_PRIVACY_VERSION=PENDIENTE_REVISION
MMG_PRIVACY_CONTROLLER=
MMG_PRIVACY_CONTACT=
MMG_PRIVACY_DPO=
MMG_PRIVACY_LEGAL_BASIS=
MMG_PRIVACY_RETENTION=
MMG_PRIVACY_RECIPIENTS=
MMG_PASSKEY_RPID=
MMG_PASSKEY_ORIGIN=
EOF
  log 'Configuración privada generada; registro de participantes deshabilitado.'
else
  log 'Conservando el archivo de configuración existente y su secreto.'
fi
chown root:root "$ENVFILE"
chmod 0600 "$ENVFILE"

IDENTITY=/etc/erasmusplus/backup-identity.txt
RECIPIENTS=/etc/erasmusplus/backup-recipient.txt
if [[ ! -f "$IDENTITY" ]]; then
  age-keygen -o "$IDENTITY" >/dev/null 2>&1
fi
if [[ ! -f "$RECIPIENTS" ]]; then
  age-keygen -y "$IDENTITY" > "$RECIPIENTS"
fi
chown root:root "$IDENTITY" "$RECIPIENTS"
chmod 0600 "$IDENTITY"
chmod 0644 "$RECIPIENTS"

UPDATER_CONF=/etc/erasmusplus/updater.conf
if [[ ! -f "$UPDATER_CONF" ]]; then
  cat >"$UPDATER_CONF" <<'EOF'
# 0=solo comprobación; 1=aplicar novedades de main diariamente.
# Mantener a 0 hasta completar auditoría técnica y autorizar despliegues automáticos.
MMG_AUTO_UPDATE=0
EOF
fi
chown root:root "$UPDATER_CONF"
chmod 0600 "$UPDATER_CONF"

install -m 0750 "$SOURCE_DIR/update-ubuntu.sh" /usr/local/sbin/erasmusplus-update
install -m 0750 "$SOURCE_DIR/init-admin-ubuntu.sh" /usr/local/sbin/erasmusplus-init-admin
install -m 0644 "$SOURCE_DIR/erasmusplus.service" /etc/systemd/system/erasmusplus.service
install -m 0644 "$SOURCE_DIR/erasmusplus-update.service" /etc/systemd/system/erasmusplus-update.service
install -m 0644 "$SOURCE_DIR/erasmusplus-update.timer" /etc/systemd/system/erasmusplus-update.timer
systemctl daemon-reload
systemctl enable erasmusplus.service
systemctl enable --now erasmusplus-update.timer

log 'Instalando la primera versión con pruebas y comprobación local de salud.'
/usr/local/sbin/erasmusplus-update
log 'Instalación terminada.'
printf '%s\n' \
 'Siguiente paso: sudo /usr/local/sbin/erasmusplus-init-admin' \
 'Comprobar servicio: systemctl status erasmusplus --no-pager' \
 'Comprobar origen del túnel: curl -fsS http://127.0.0.1:3000/healthz' \
 'En Cloudflare Tunnel existente: hostname HTTPS autorizado → http://127.0.0.1:3000' \
 'No abrir los puertos 3000 ni 443 del servidor para esta aplicación.' \
 'Las actualizaciones diarias están instaladas pero no se aplican hasta aprobar MMG_AUTO_UPDATE=1.'
