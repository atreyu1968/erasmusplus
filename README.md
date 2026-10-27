# Movilidades Erasmus+ MMG

Aplicación de gestión Erasmus+ del **IES Manuel Martín González (Guía de Isora, Tenerife)**. Node.js 24, SQLite, Resend, interfaz adaptable y PWA. Repositorio público de código; **nunca** almacena datos reales, bases SQLite o secretos en GitHub.

> **Estado:** versión de desarrollo para pruebas con datos ficticios. No abrir registros de alumnado real sin revisión técnica, autorización del centro y validación de protección de datos. El instalador deja el registro cerrado y las actualizaciones automáticas sin aplicar hasta su autorización.

## Si el instalador detecta Ubuntu 25.04

El instalador bloquea deliberadamente Ubuntu **25.04**, que está fuera de soporte de seguridad desde el **15 de enero de 2026**. No es un error de instalación ni se soluciona ignorando la versión. Ubuntu 25.10 también ha agotado su soporte (9 de julio de 2026).

**Solución recomendada:** preparar Ubuntu Server **26.04 LTS**, migrar con seguridad el Cloudflare Tunnel y los servicios del equipo y, después, instalar Erasmus+ MMG con los comandos de la sección siguiente. Si no es posible reinstalar, el camino secuencial 25.04 → 25.10 → 26.04 debe realizarse con respaldo, consola de recuperación y supervisión de TIC.

**[Guía de migración desde Ubuntu 25.04, con pasos para conservar Cloudflare Tunnel](docs/MIGRACION_UBUNTU_25_04.md).**

## Instalación confirmada: contenedor Ubuntu 26.04 en Proxmox

El contenedor Erasmus+ MMG ya dispone de **Ubuntu 26.04 LTS**, con arquitectura x86_64. **Cloudflare Tunnel está en otro contenedor Proxmox**: es normal que no exista `cloudflared.service` dentro de Ubuntu. No reinstales el túnel.

Si ya tienes un clon previo en `/root/erasmusplus`:

```bash
apt-get update
apt-get install -y ca-certificates git curl
cd /root/erasmusplus
git pull --ff-only
bash deploy/install-ubuntu.sh
```

Si no existe ese repositorio, usa `git clone https://github.com/atreyu1968/erasmusplus.git` desde `/root`, entra en `erasmusplus` y ejecuta `bash deploy/install-ubuntu.sh`.

Tras instalar, crea el coordinador con `/usr/local/sbin/erasmusplus-init-admin`, comprueba `curl -fsS http://127.0.0.1:3000/healthz`, configura `HOST` con la IP privada real del Ubuntu y limita TCP 3000 a la IP del contenedor Cloudflare. La ruta Cloudflare debe usar **`http://IP_PRIVADA_UBUNTU:3000`**, no `127.0.0.1`.

El procedimiento y el ejemplo de cortafuegos están en [Cloudflare Tunnel en otro contenedor Proxmox](deploy/CLOUDFLARE_TUNNEL.md).

## 1. Instalación desde cero en Ubuntu, aunque no tenga Git ni cURL

**Requisitos:** Ubuntu Server 22.04, 24.04 o 26.04 LTS de 64 bits (`amd64`/`arm64`), acceso administrativo `sudo`, `apt` operativo, Internet saliente por HTTPS y systemd. No se admiten versiones sin soporte estándar como Ubuntu 20.04: debe actualizarse o migrarse con el equipo TIC. El túnel **Cloudflare Tunnel ya instalado** se conserva tal como está.

Antes de instalar, comprobar versión y espacio disponible:

```bash
cat /etc/os-release
df -h
# cloudflared funciona en otro contenedor Proxmox; no debe aparecer aquí
```

El servidor está desactualizado: **realizar una instantánea o copia de seguridad previa** y coordinar con TIC la actualización del sistema operativo. El instalador solo ejecuta `apt-get update` e instala los paquetes necesarios; **no ejecuta silenciosamente un `dist-upgrade`, no reinicia Ubuntu y no altera el túnel existente**. Para revisar actualizaciones del sistema de manera separada:

```bash
sudo apt-get update
sudo apt-get upgrade
```

Si APT falla debido a repositorios antiguos o certificados caducados, resolverlo antes de continuar. Consultar posibles reinicios y comprobar que `cloudflared` sigue funcionando después de actualizar Ubuntu.

### Descargar el instalador sin disponer previamente de Git ni cURL

Ejecutar en una terminal Ubuntu con un usuario autorizado a utilizar `sudo`:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates git curl
git clone https://github.com/atreyu1968/erasmusplus.git
cd erasmusplus
sudo bash deploy/install-ubuntu.sh
```

Los dos primeros comandos instalan precisamente las herramientas que faltan. **No hay que ejecutar código descargado directamente con `curl | bash`.** Se descarga el repositorio, se puede revisar `deploy/install-ubuntu.sh` y después se ejecuta. Si se prefiere, se puede copiar el repositorio al servidor desde un equipo de administración.

El instalador realiza automáticamente estas operaciones:

1. Verifica Ubuntu y actualiza índices APT; instala `git`, `curl`, certificados, GnuPG, `age`, OpenSSL y herramientas de actualización.
2. Instala **Node.js 24** mediante el repositorio APT firmado de NodeSource, si no existe una versión adecuada. Usa su clave GPG y comprueba la versión al terminar.
3. Crea el usuario limitado `erasmusmmg`, las carpetas privadas y los servicios `systemd`.
4. Genera `MMG_SECRET` aleatorio y conserva cualquier configuración privada ya existente.
5. Crea claves `age` para cifrar las copias de seguridad; **guarda una copia offline** de la clave privada bajo custodia institucional.
6. Descarga el código, verifica sintaxis, instala dependencias mediante `npm ci` y ejecuta las pruebas automáticas antes de activar el servicio.
7. Instala el actualizador diario, inicialmente en modo **sin aplicación automática** por seguridad.

### Crear la primera cuenta de coordinación

```bash
sudo /usr/local/sbin/erasmusplus-init-admin
```

El asistente solicita identificador, correo institucional y contraseña (oculta mientras se escribe). No guarda la contraseña en archivos de configuración. Solo se puede crear la primera cuenta de coordinación mediante consola.

### Comprobar el servicio

```bash
sudo systemctl status erasmusplus --no-pager
curl -fsS http://127.0.0.1:3000/healthz
sudo journalctl -u erasmusplus -n 60 --no-pager
```

El control de salud debe devolver `ok`. **Node solo escucha en `127.0.0.1:3000`: no abrir el puerto 3000 al exterior.**

## 2. Acceso mediante tu Cloudflare Tunnel existente

En Cloudflare Zero Trust, selecciona el túnel del **otro contenedor Proxmox** y crea una **ruta de aplicación publicada** para el subdominio institucional aprobado. El destino será la dirección privada del Ubuntu Erasmus+:

```text
http://IP_PRIVADA_UBUNTU:3000
```

Configura `HOST=IP_PRIVADA_UBUNTU` en `/etc/erasmusplus/erasmusplus.env`, reinicia el servicio y comprueba conectividad desde el contenedor donde está cloudflared. Restringe el cortafuegos del guest a la IP del contenedor cloudflared. Consulta [la guía específica de Proxmox](deploy/CLOUDFLARE_TUNNEL.md).

El usuario navegará por `https://TU-SUBDOMINIO-INSTITUCIONAL`. El dominio ilustrativo debe sustituirse por el autorizado. Cloudflare establece la conexión saliente desde `cloudflared`; no es necesario Nginx ni abrir puertos en el router. En esta instalación el tráfico interno entre ambos contenedores debe quedar restringido a la red privada autorizada de Proxmox.

**No permitir el acceso de estudiantes a la aplicación ni activar el registro antes de validar el tratamiento de datos.** Conviene proteger rutas administrativas mediante Cloudflare Access cuando el procedimiento de autenticación lo permita.

Guía: [deploy/CLOUDFLARE_TUNNEL.md](deploy/CLOUDFLARE_TUNNEL.md).

## 3. Resend y configuración privada

La cuenta de Coordinación dispone de **Configurar Resend**: introducir API Key, dirección remitente de un dominio verificado y URL HTTPS pública de la aplicación. La API Key se guarda cifrada en SQLite y nunca en el repositorio. Resend no sustituye la aprobación manual del coordinador.

El archivo principal de configuración se encuentra **solo en el servidor**:

```bash
sudo nano /etc/erasmusplus/erasmusplus.env
sudo systemctl restart erasmusplus
```

Está protegido con permisos `0600` y propietario root. El instalador mantiene por defecto `MMG_ENABLE_REGISTRATION=0` y `MMG_PRIVACY_VERSION=PENDIENTE_REVISION`. El responsable y DPD deberán aprobar los campos `MMG_PRIVACY_*` antes de permitir solicitudes reales. Usar comillas para valores de configuración que contengan espacios y no modificar `MMG_SECRET` sin plan de rotación.

Para WebAuthn/passkeys, completar `MMG_PASSKEY_RPID` y `MMG_PASSKEY_ORIGIN` con el dominio público HTTPS definitivo.

## 4. Actualización automática de la aplicación

Se instala un timer `systemd` que **comprueba diariamente, aproximadamente a las 04:25 según la hora local del servidor**, si hay cambios en `main` de GitHub. Se añade un retraso aleatorio de hasta 15 minutos.

**Por defecto no instala automáticamente versiones nuevas**, porque el proyecto sigue en desarrollo y la rama `main` no es todavía un canal de versiones certificadas. Una vez realizadas las pruebas de funcionamiento, revisión de seguridad y aprobación del procedimiento de cambios, el administrador podrá habilitar la aplicación automática:

```bash
sudo nano /etc/erasmusplus/updater.conf
```

Cambiar `MMG_AUTO_UPDATE=0` por `MMG_AUTO_UPDATE=1`. No modificar el resto de la configuración. El timer ya queda habilitado. Para ejecutar una actualización manual y supervisar el resultado:

```bash
sudo /usr/local/sbin/erasmusplus-update
sudo systemctl status erasmusplus-update.timer --no-pager
sudo journalctl -u erasmusplus-update.service -n 100 --no-pager
```

**Cómo se actualiza:** Git descarga el código nuevo por HTTPS; `npm ci` usa las versiones fijadas en `package-lock.json`; se verifican sintaxis y pruebas; solo después se detiene brevemente el servicio, se crea una copia de seguridad cifrada `age` de SQLite y documentos, se cambia la versión de forma atómica y se comprueba `http://127.0.0.1:3000/healthz`. Si falla el arranque o la salud, se intenta **restaurar código y datos anteriores**. Los fallos y cambios se reflejan en `journalctl`.

Para impedir las actualizaciones programadas, volver a `MMG_AUTO_UPDATE=0`; para detener incluso la comprobación diaria:

```bash
sudo systemctl disable --now erasmusplus-update.timer
```

Una actualización automática toma la rama `main`; por ello es imprescindible proteger la rama, revisar las contribuciones y exigir CI satisfactorio. **No activar despliegues automáticos sobre expedientes reales mientras la aplicación no supere su auditoría de seguridad.** El actualizador no realiza actualizaciones de sistema operativo ni reinicios del servidor.

## 5. Datos y copias de seguridad

| Elemento | Ruta en Ubuntu |
| --- | --- |
| Versión activa del programa | `/opt/erasmusplus/current` |
| Versiones del código | `/opt/erasmusplus/releases/` |
| SQLite y documentos privados | `/var/lib/erasmusplus/` |
| Configuración y secretos | `/etc/erasmusplus/erasmusplus.env` |
| Clave privada para restaurar backups | `/etc/erasmusplus/backup-identity.txt` |
| Copias cifradas anteriores a actualizaciones | `/var/backups/erasmusplus/` |
| Configuración del actualizador | `/etc/erasmusplus/updater.conf` |

Las copias creadas en cada actualización se cifran con **age** y se conservan localmente un máximo aproximado de 14 días. Esto **no sustituye** una política de backups diarios, externos y ensayos de restauración. Guardar **fuera del servidor**, de forma segura y separada, la clave privada `backup-identity.txt` y una copia de la configuración. Si se pierde la clave de recuperación no será posible descifrar las copias. Un responsable TIC deberá verificar periódicamente la restauración en un entorno aislado.

## 6. Funciones existentes

- Acceso por perfiles alumnado, profesorado y coordinación, verificación institucional con Resend, aprobación manual, recuperación de contraseña y passkeys opcionales.
- Candidaturas Erasmus+ corta, Dual-Erasmus+ y Job Shadowing, PDFs privados, valoración manual y consulta de resultados.
- Gestión de grupos, agenda de actividades y tareas con seguimiento de cada participante.
- Notificaciones y adjuntos, chat de grupos y comunicación con coordinación, con política transparente y auditoría.
- Compromisos de participación, documentación y autorizaciones de menores con PDF rellenable y revisión manual.
- Destinos Portugal y Países Bajos, modalidades, normativa, panel personal adaptativo y PWA inicial.

## 7. Limitaciones y obligaciones antes de producción

El sistema requiere pruebas independientes de seguridad y accesibilidad, revisión de privacidad y conservación documental, controles adicionales de archivos, una política de copias y recuperación, fotografías y logotipos originales autorizados y comprobación del dominio de Resend. Ninguna prueba automatizada reemplaza estos controles. **No introducir datos personales reales hasta que la administración educativa confirme las medidas necesarias.**

Documentación: [Privacidad y menores](docs/PRIVACIDAD_Y_MENORES.md) · [Cloudflare Tunnel](deploy/CLOUDFLARE_TUNNEL.md) · [Instalación técnica](docs/UBUNTU.md).
