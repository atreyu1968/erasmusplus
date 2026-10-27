# Preparación del servidor Ubuntu — Erasmus+ MMG

> Procedimiento de referencia para el equipo TIC. No abrir puertos ni desplegar con datos reales hasta completar autorización técnica y revisión de seguridad.

## 1. Comprobar el entorno

```bash
cat /etc/os-release
node --version
which node
```

Se necesita **Node.js 24 LTS**. Instala una versión mantenida desde un origen autorizado por el administrador del servidor.

## 2. Descargar código

```bash
sudo mkdir -p /opt/erasmusplus
# Clonar como usuario con permisos sobre la carpeta y con acceso a GitHub:
git clone https://github.com/atreyu1968/erasmusplus.git /opt/erasmusplus
```

## 3. Crear cuenta de servicio y carpeta privada

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin erasmusmmg
sudo install -d -m 0700 -o erasmusmmg -g erasmusmmg /var/lib/erasmusplus
sudo install -d -m 0700 -o root -g root /etc/erasmusplus
```

Crear `/etc/erasmusplus/erasmusplus.env` (propiedad root, permisos 0600) con valores reales. **No incluir el archivo en Git.**

```ini
HOST=127.0.0.1
PORT=3000
MMG_DATA_DIR=/var/lib/erasmusplus
MMG_ENV=production
MMG_SECURE_COOKIE=1
MMG_SECRET=REEMPLAZAR_POR_UN_SECRETO_ALEATORIO
MMG_ENABLE_REGISTRATION=0
MMG_PRIVACY_VERSION=PENDIENTE_REVISION
```

Para crear el coordinador inicial, ejecutar `npm run init-admin` con variables `MMG_ADMIN_*` y las de entorno de producción cargadas de forma segura. Retirar esas variables tras el alta. Los datos de la cuenta no se definen en archivos públicos.

## 4. systemd

La plantilla está en `deploy/erasmusplus.service.example`. Comprobar previamente la ruta real de Node (`which node`), rutas de datos y usuario.

```bash
sudo cp deploy/erasmusplus.service.example /etc/systemd/system/erasmusplus.service
sudo systemctl daemon-reload
sudo systemctl enable --now erasmusplus
sudo systemctl status erasmusplus --no-pager
```

El servicio se comunica únicamente por `127.0.0.1:3000`; **no publicar ese puerto**.

## 5. Nginx y HTTPS

La configuración en `deploy/nginx.conf.example` es una **plantilla que no debe habilitarse sin editarla**. Es necesario un subdominio institucional autorizado, certificado TLS y permiso del administrador de red. Solicitar al equipo TIC la publicación segura.

## 6. Resend desde Coordinación

Tras acceder con la cuenta inicial, abrir `/coordinacion/configuracion`. Introducir la API Key de Resend, remitente del dominio previamente verificado y URL pública HTTPS. Guardar y utilizar el botón de prueba.

## 7. Seguridad antes de admitir alumnado

- Aprobar información de privacidad y mantener cerrado el registro hasta entonces.
- Configurar cifrado en reposo del volumen que contenga SQLite y sus copias.
- Automatizar backups cifrados, copia externa y pruebas de restauración.
- Revisar correo institucional, limitación de peticiones en Nginx, autorización, auditoría y política de retención.
- Añadir pruebas funcionales y revisión independiente de seguridad antes de producción.
- Comprobar resolución DNS, HSTS, TLS, actualizaciones automáticas y acceso remoto administrativo restringido.

El repositorio público solo debe contener código y documentación, nunca los datos, API Keys o secretos.
