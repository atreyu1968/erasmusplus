#!/usr/bin/env bash
# Crea el primer coordinador solo si falta; no guarda la contraseña en disco.
set -Eeuo pipefail
umask 077
log() { printf '[ERASMUS-MMG] %s\n' "$*"; }
die() { printf '[ERASMUS-MMG] ERROR: %s\n' "$*" >&2; exit 1; }
[[ "$EUID" == 0 ]] || die 'Ejecutar con sudo.'
CURRENT=/opt/erasmusplus/current
ENVFILE=/etc/erasmusplus/erasmusplus.env
[[ -L "$CURRENT" ]] || die 'Instala antes Erasmus+ MMG.'
[[ -r "$ENVFILE" ]] || die 'Falta /etc/erasmusplus/erasmusplus.env.'
cd "$CURRENT"

# Bootstrap credentials may come from a protected caller environment, never
# from the application's persistent configuration file.
ADMIN_USERNAME_INPUT=${MMG_ADMIN_USERNAME:-}
ADMIN_EMAIL_INPUT=${MMG_ADMIN_EMAIL:-}
ADMIN_PASSWORD_INPUT=${MMG_ADMIN_PASSWORD:-}
unset MMG_ADMIN_USERNAME MMG_ADMIN_EMAIL MMG_ADMIN_PASSWORD
verify=''
trap 'unset MMG_ADMIN_USERNAME MMG_ADMIN_EMAIL MMG_ADMIN_PASSWORD verify ADMIN_USERNAME_INPUT ADMIN_EMAIL_INPUT ADMIN_PASSWORD_INPUT' EXIT
set -a
source "$ENVFILE"
set +a
MMG_ADMIN_USERNAME=$ADMIN_USERNAME_INPUT
MMG_ADMIN_EMAIL=$ADMIN_EMAIL_INPUT
MMG_ADMIN_PASSWORD=$ADMIN_PASSWORD_INPUT
unset ADMIN_USERNAME_INPUT ADMIN_EMAIL_INPUT ADMIN_PASSWORD_INPUT

if ! admin_state=$(runuser -u erasmusmmg --preserve-environment -- /usr/bin/node --input-type=module -e '
  const {get}=await import("./src/db.mjs");
  const row=get("SELECT 1 FROM users WHERE role = ? LIMIT 1","coordinator");
  process.stdout.write(row ? "present" : "missing");
'); then
  die 'No se pudo comprobar si existe una cuenta de coordinación.'
fi
case "$admin_state" in
  present) log 'Ya existe una cuenta de coordinación; no se ha creado otra.'; exit 0 ;;
  missing) ;;
  *) die 'Respuesta inesperada al comprobar la cuenta de coordinación.' ;;
esac

if [[ -z "$MMG_ADMIN_USERNAME" ]]; then
  [[ -t 0 ]] || die 'Falta MMG_ADMIN_USERNAME. Ejecuta el instalador en una terminal o proporciona los tres datos mediante un gestor seguro.'
  read -r -p 'Usuario del coordinador (DNI o identificador institucional): ' MMG_ADMIN_USERNAME
fi
if [[ -z "$MMG_ADMIN_EMAIL" ]]; then
  [[ -t 0 ]] || die 'Falta MMG_ADMIN_EMAIL. Ejecuta el instalador en una terminal o proporciona los tres datos mediante un gestor seguro.'
  read -r -p 'Correo institucional del coordinador: ' MMG_ADMIN_EMAIL
fi
if [[ -z "$MMG_ADMIN_PASSWORD" ]]; then
  [[ -t 0 ]] || die 'Falta MMG_ADMIN_PASSWORD. Ejecuta el instalador en una terminal o proporciona los tres datos mediante un gestor seguro.'
  read -r -s -p 'Contraseña inicial (mínimo 16 caracteres): ' MMG_ADMIN_PASSWORD
  printf '\n'
  read -r -s -p 'Repite la contraseña: ' verify
  printf '\n'
  [[ "$MMG_ADMIN_PASSWORD" == "$verify" ]] || die 'Las contraseñas no coinciden.'
fi
[[ -n "${MMG_ADMIN_USERNAME//[[:space:]]/}" ]] || die 'El usuario del coordinador no puede estar vacío.'
[[ "$MMG_ADMIN_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || die 'El correo institucional no parece válido.'
[[ "${#MMG_ADMIN_PASSWORD}" -ge 16 ]] || die 'La contraseña debe tener 16 caracteres o más.'

export MMG_ADMIN_USERNAME MMG_ADMIN_EMAIL MMG_ADMIN_PASSWORD
runuser -u erasmusmmg --preserve-environment -- /usr/bin/node scripts/init-admin.mjs
log 'Cuenta inicial de coordinación creada. La contraseña no se ha guardado en archivos.'
