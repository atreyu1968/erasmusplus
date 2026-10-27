# Instalación de Movilidades Erasmus+ MMG en Ubuntu

**Guía principal y actualizada:** [README.md](../README.md), apartados 1–5. Esta página es un resumen para el equipo TIC.

La aplicación se publica por el **Cloudflare Tunnel existente**: no requiere Nginx ni apertura de puertos de entrada. Node.js escucha solamente en `127.0.0.1:3000`.

## Desde un Ubuntu sin Git ni cURL

```bash
cat /etc/os-release
sudo apt-get update
sudo apt-get install -y ca-certificates git curl
git clone https://github.com/atreyu1968/erasmusplus.git
cd erasmusplus
sudo bash deploy/install-ubuntu.sh
sudo /usr/local/sbin/erasmusplus-init-admin
curl -fsS http://127.0.0.1:3000/healthz
```

El instalador admite Ubuntu LTS **22.04, 24.04 y 26.04** sobre `amd64` o `arm64`, instala Node.js **24** usando APT firmado, y configura `systemd`, SQLite, backups cifrados y el actualizador programado.

Si el servidor está muy desactualizado, comprobar soporte de la versión, repositorios APT y copias de seguridad antes de instalar. **No actualizar automáticamente toda la distribución ni reiniciar un servidor con otros servicios de la Consejería sin autorización del equipo TIC.**

## Actualizaciones de la aplicación

```bash
sudo /usr/local/sbin/erasmusplus-update
sudo systemctl status erasmusplus-update.timer --no-pager
sudo journalctl -u erasmusplus-update.service -n 80 --no-pager
```

El timer diario queda instalado, pero la instalación automática está inicialmente **desactivada** en `/etc/erasmusplus/updater.conf` mediante `MMG_AUTO_UPDATE=0`. Una vez aprobado el despliegue de nuevas versiones por el equipo TIC, cambiarlo a `1`. El script ejecuta pruebas, hace una copia cifrada antes de cada cambio, comprueba `/healthz` y recupera el servicio anterior si la actualización falla.

Los datos se guardan en `/var/lib/erasmusplus`, fuera del código; el archivo de configuración privada reside en `/etc/erasmusplus/erasmusplus.env` y las copias cifradas en `/var/backups/erasmusplus`. **Conservar la clave privada de age también fuera del servidor.**

## Cloudflare Tunnel y Resend

La ruta de aplicación publicada en Cloudflare debe dirigir el subdominio institucional HTTPS autorizado a `http://127.0.0.1:3000`. No reinstalar ni sobrescribir el túnel existente.

Resend se configura desde el panel privado de coordinación, verificando primero el dominio remitente. El registro y el tratamiento de datos personales reales permanecerán deshabilitados hasta la revisión del DPD y las pruebas de seguridad.

Referencias: [Cloudflare Tunnel](../deploy/CLOUDFLARE_TUNNEL.md) · [Privacidad y menores](PRIVACIDAD_Y_MENORES.md).
