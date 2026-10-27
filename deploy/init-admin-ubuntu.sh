#!/usr/bin/env bash
# Alta del primer coordinador, sin guardar la contraseña en el disco.
set -Eeuo pipefail
umask 077
[[ "$EUID" == 0 ]] || { echo 'Ejecutar con sudo.' >&2; exit 1; }
[[ -L /opt/erasmusplus/current ]] || { echo 'Instala antes Erasmus+ MMG.' >&2; exit 1; }
[[ -t 0 ]] || { echo 'Ejecutar en terminal interactiva; no desde cron.' >&2; exit 1; }
cd /opt/erasmusplus/current
# El archivo lo crea el instalador root:0600 con sintaxis KEY=VALUE.
set -a
source /etc/erasmusplus/erasmusplus.env
set +a
read -r -p 'Usuario del coordinador (DNI o identificador institucional): ' MMG_ADMIN_USERNAME
read -r -p 'Correo institucional del coordinador: ' MMG_ADMIN_EMAIL
read -r -s -p 'Contraseña inicial (mínimo 16 caracteres): ' MMG_ADMIN_PASSWORD
printf '\n'
read -r -s -p 'Repite la contraseña: ' verify
printf '\n'
[[ "$MMG_ADMIN_PASSWORD" == "$verify" ]] || { echo 'Las contraseñas no coinciden.' >&2; exit 1; }
[[ "${#MMG_ADMIN_PASSWORD}" -ge 16 ]] || { echo 'La contraseña debe tener 16 caracteres o más.' >&2; exit 1; }
export MMG_ADMIN_USERNAME MMG_ADMIN_EMAIL MMG_ADMIN_PASSWORD
trap 'unset MMG_ADMIN_USERNAME MMG_ADMIN_EMAIL MMG_ADMIN_PASSWORD verify' EXIT
runuser -u erasmusmmg --preserve-environment -- /usr/bin/node scripts/init-admin.mjs
printf 'Ya puedes iniciar sesión a través del túnel de Cloudflare una vez configurado.\n'
