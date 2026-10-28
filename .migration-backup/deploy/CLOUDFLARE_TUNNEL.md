# Cloudflare Tunnel en otro contenedor de Proxmox

## Arquitectura real del IES Manuel Martín González

El conector **cloudflared ya está instalado en otro contenedor/VM de Proxmox**. El servidor dedicado a Erasmus+ MMG es **otro sistema Ubuntu**. No instales un segundo túnel, no reinstales cloudflared en el Ubuntu de Erasmus+ y no modifiques rutas existentes de otras aplicaciones.

\`\`\`text
Docentes / alumnado
       HTTPS
         │
 Cloudflare (borde público)
         │ túnel cifrado saliente
         ▼
 Contenedor Proxmox A
 cloudflared existente · IP_CLOUDFLARED
         │ red interna Proxmox · acceso restringido
         │ http://IP_PRIVADA_ERASMUS:3000
         ▼
 Servidor Ubuntu B · IP_PRIVADA_ERASMUS
 Node.js 24 + SQLite
 Datos privados: /var/lib/erasmusplus
\`\`\`

**Muy importante:** \`127.0.0.1\` siempre corresponde al propio sistema donde se utiliza. Desde el contenedor cloudflared, \`http://127.0.0.1:3000\` **no llega a otro servidor**. Para el origen hay que usar una IP o un nombre interno resoluble del servidor Erasmus+.

Cloudflare confirma que el origen de una aplicación publicada puede estar en otro equipo de la red: https://developers.cloudflare.com/tunnel/get-started/.

## 1. Preparar Ubuntu Erasmus+ en versión con soporte

**Ubuntu 25.04 ya está fuera de soporte.** Migrar este sistema a Ubuntu Server 26.04 LTS antes de instalar la aplicación con datos del alumnado. Como cloudflared está en un contenedor independiente, **puedes sustituir/reinstalar únicamente el sistema Ubuntu de Erasmus+**, manteniendo cloudflared y los demás servicios existentes en el otro contenedor.

El Ubuntu actual informa de una raíz de unos 7,8 GB. Para documentación, SQLite, actualizaciones y copias no es una capacidad aconsejable; asignar aproximadamente **30–40 GB como punto de partida** según el volumen previsto y la política de almacenamiento del centro. Consultar el espacio del almacenamiento Proxmox y planificar respaldos externos.

Guía: [MIGRACION_UBUNTU_25_04.md](../docs/MIGRACION_UBUNTU_25_04.md).

## 2. Identificar ambas IP privadas

En el Ubuntu Erasmus+:

\`\`\`bash
ip -4 -br address show scope global
ip route
\`\`\`

En el contenedor de cloudflared, si tiene consola y acceso administrativo:

\`\`\`bash
ip -4 -br address show scope global
\`\`\`

También se pueden consultar las direcciones de ambos invitados desde la interfaz web de Proxmox. Evitar publicar credenciales, tokens de Cloudflare o configuración completa en mensajes.

Ejemplo de configuración (las IP **son ficticias y deben sustituirse**):

| Servicio | IP privada de ejemplo | Función |
| --- | --- | --- |
| Contenedor cloudflared | \`192.168.20.10\` | Se conecta a Cloudflare; origen de las conexiones locales |
| Ubuntu Erasmus+ | \`192.168.20.20\` | Recibe el tráfico de la aplicación en TCP 3000 |

Antes de crear una regla en Cloudflare, comprobar desde el contenedor cloudflared que la IP privada del Ubuntu puede alcanzarse mediante la red Proxmox. Debe haber conectividad en el bridge o en las VLAN/rutas correspondientes.

## 3. Configurar Node.js en la IP privada del Ubuntu

El instalador crea el archivo **privado** \`/etc/erasmusplus/erasmusplus.env\` inicialmente con \`HOST=127.0.0.1\`. Es seguro durante el arranque de prueba inicial.

Una vez identificada la IP interna **del servidor Erasmus+**:

\`\`\`bash
sudo nano /etc/erasmusplus/erasmusplus.env
\`\`\`

Modificar **solo** la variable:

\`\`\`ini
HOST=192.168.20.20
PORT=3000
MMG_SECURE_COOKIE=1
\`\`\`

Estas IP son solo ejemplos. **No escribir la IP de cloudflared en HOST**: hay que indicar la IP privada asignada a la interfaz del propio Ubuntu Erasmus+.

Reiniciar y comprobar:

\`\`\`bash
sudo systemctl restart erasmusplus
sudo systemctl status erasmusplus --no-pager
curl -fsS http://192.168.20.20:3000/healthz
sudo ss -lntp | grep ':3000'
\`\`\`

La comprobación debe responder \`ok\`. La aplicación debe escuchar solo en la IP privada configurada (no en la IP pública del host Proxmox). El actualizador \`deploy/update-ubuntu.sh\` lee \`HOST\` y \`PORT\` de este archivo y comprueba la salud en esa misma dirección.

**No utilizar \`HOST=0.0.0.0\`** sin una necesidad verificada, y no crear reglas NAT ni abrir el puerto TCP 3000 a Internet.

## 4. Cortafuegos y aislamiento

Permitir **solamente la conexión TCP desde la IP privada del contenedor cloudflared hacia la IP privada del Ubuntu Erasmus+ en el puerto 3000**. No aceptar conexiones de todo el instituto o de Internet.

Preferir reglas en **Proxmox Firewall** cuando están correctamente habilitados el firewall del datacenter, del nodo y del guest correspondiente. Otra opción es un cortafuegos en el Ubuntu si está administrado por TIC.

Ejemplo **solo si UFW ya está habilitado y administrado** (adaptar las IP reales):

\`\`\`bash
sudo ufw status verbose
sudo ufw allow from 192.168.20.10 to 192.168.20.20 port 3000 proto tcp
\`\`\`

Mantener las reglas de acceso administrativo SSH y **no activar un nuevo cortafuegos remotamente sin verificar que SSH continuará disponible**. La regla indicada es de ejemplo: si existen reglas generales previas que permiten el puerto 3000, habrá que revisarlas y restringirlas también.

**Privacidad del tramo interno:** el enlace de Cloudflare al conector cloudflared está cifrado. Si el origen se configura con \`http://IP_PRIVADA:3000\`, el tramo entre el contenedor y Ubuntu usa HTTP sin TLS. Solo debe emplearse sobre una red interna confiable y aislada de Proxmox. Si hay otros equipos no confiables en esa red, implementar TLS autenticado entre cloudflared y el servicio de origen, validando el certificado; no desactivar la validación TLS.

## 5. Publicar el subdominio desde el túnel existente

### Túnel gestionado desde Cloudflare Zero Trust

1. Abrir Cloudflare Zero Trust → **Networking → Tunnels** (el menú puede variar).
2. Seleccionar el **túnel existente**, que está funcionando en el otro contenedor Proxmox.
3. En **Routes → Published application**, añadir una ruta para el **subdominio institucional autorizado**.
4. Configurar la **Service URL** con la IP privada del servidor Erasmus+ y el puerto 3000; por ejemplo, \`http://192.168.20.20:3000\`.
5. Guardar sin tocar las rutas existentes.

### Túnel configurado localmente en el otro contenedor

En el **contenedor de cloudflared**, y solo si el túnel usa configuración local (no remota), añadir una regla para el hostname nuevo, conservando el resto de reglas:

\`\`\`yaml
ingress:
  - hostname: erasmus.subdominio-institucional.example
    service: http://192.168.20.20:3000
  # ... mantener todas las rutas anteriores
  - service: http_status:404
\`\`\`

**No reemplazar el archivo completo** por este fragmento: perderías las reglas de otros servicios. La ruta se añade en el orden correspondiente.

El subdominio \`.example\` es solo un marcador ilustrativo. La URL pública que tendrán las familias debe usar el subdominio realmente autorizado y HTTPS.

## 6. Comprobaciones de conectividad

Desde el **Ubuntu Erasmus+**:

\`\`\`bash
curl -fsS http://IP_PRIVADA_ERASMUS:3000/healthz
\`\`\`

Desde el **contenedor Proxmox con cloudflared**:

\`\`\`bash
curl -fsS --connect-timeout 5 http://IP_PRIVADA_ERASMUS:3000/healthz
\`\`\`

Si el contenedor no dispone de cURL, puedes usar \`wget -qO- http://IP_PRIVADA_ERASMUS:3000/healthz\` si está disponible.

Ambas consultas deberían devolver \`ok\`. Finalmente, desde un equipo externo o móvil, abrir la URL HTTPS autorizada y comprobar registro cerrado, inicio de sesión y roles.

Si la primera prueba funciona y la segunda falla, comprobar IP de enlace, bridges/VLAN, rutas y firewall entre ambos sistemas. Si ambas funcionan pero la web no abre por Cloudflare, revisar la ruta publicada y sus registros DNS.

## 7. Protección de datos y seguridad

- Configurar Resend en el panel de Coordinación con la **URL HTTPS pública**, no la IP privada.
- Mantener \`MMG_SECURE_COOKIE=1\` para las cookies de sesión.
- Evaluar **Cloudflare Access** en rutas de coordinación como segunda capa. Cualquier política debe permitir los trámites previos de verificación y registro necesarios.
- No crear caché Cloudflare de páginas autenticadas, documentos o datos personales.
- Mantener los endpoints y permisos de aplicación independientes de Cloudflare: el túnel por sí solo no autentica a las familias.
- No exponer a Internet el puerto 3000 ni el escritorio de Proxmox.
- Completar la auditoría técnica y la revisión del delegado de protección de datos antes de aceptar datos reales.

Referencias:
- https://developers.cloudflare.com/tunnel/get-started/
- https://developers.cloudflare.com/tunnel/concepts/routing/
- https://developers.cloudflare.com/tunnel/troubleshooting/https-origins/
