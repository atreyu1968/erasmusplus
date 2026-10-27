# Publicación mediante Cloudflare Tunnel (Ubuntu)

## Arquitectura seleccionada

El instituto ya tiene **Cloudflare Tunnel (\`cloudflared\`) instalado** en el servidor Ubuntu. Para Movilidades Erasmus+ MMG **no hace falta instalar Nginx ni abrir puertos de entrada** si el túnel y la aplicación se ejecutan en el mismo equipo.

\`\`\`text
Docentes / alumnado (HTTPS)
             │
      Subdominio autorizado
             │
       Cloudflare Edge
             │
       Cloudflare Tunnel
             │  conexión saliente cifrada
 cloudflared en servidor Ubuntu
             │
     http://127.0.0.1:3000
             │
        Node.js 24 LTS
             │
     SQLite (carpeta privada)
\`\`\`

El tráfico HTTPS termina en Cloudflare; el enlace de \`cloudflared\` a Node.js es HTTP **solo por loopback**, dentro del propio servidor. Si el túnel se ejecuta en otra máquina o contenedor, habrá que adaptar el circuito y proteger también ese tramo.

## 1. Comprobar que cloudflared está en marcha

\`\`\`bash
systemctl status cloudflared --no-pager
cloudflared --version
\`\`\`

No reinstales ni crees otro túnel: utiliza el que ya funciona. No pegues en este repositorio tokens, credenciales ni el contenido de \`/etc/cloudflared\`.

## 2. Arrancar primero Node.js solo en local

En las variables privadas del servicio de Erasmus+ MMG:

\`\`\`ini
HOST=127.0.0.1
PORT=3000
MMG_ENV=production
MMG_SECURE_COOKIE=1
MMG_DATA_DIR=/var/lib/erasmusplus
MMG_SECRET=SECRETO_ALEATORIO_LARGO
MMG_ENABLE_REGISTRATION=0
MMG_PRIVACY_VERSION=PENDIENTE_REVISION
\`\`\`

El proceso Node.js debe correr con una cuenta sin privilegios de administrador y la carpeta SQLite deberá tener permisos restrictivos. Iniciar con \`systemd\` una vez adaptada su plantilla:

\`\`\`bash
sudo systemctl restart erasmusplus
sudo systemctl status erasmusplus --no-pager
curl -fsS http://127.0.0.1:3000/healthz
\`\`\`

La comprobación local debe devolver \`ok\`. **No cambies HOST a 0.0.0.0** y no publiques directamente el puerto 3000.

## 3. Añadir la aplicación al túnel existente

Si el túnel se administra desde el panel de Cloudflare:

1. Abre **Cloudflare One / Zero Trust → Networking → Tunnels**, según la interfaz disponible.
2. Selecciona el túnel existente del servidor Ubuntu.
3. En **Routes**, añade **Published application**.
4. Introduce el **subdominio institucional autorizado**, por ejemplo \`erasmus.subdominio-institucional.example\` (solo ilustrativo).
5. En **Service URL**, indica **\`http://127.0.0.1:3000\`**.
6. Guarda la ruta. Revisa el registro DNS creado/gestionado por Cloudflare.

Si el túnel usa **\`config.yml\` local** y no una configuración remota, no cambies el método de administración ni sobrescribas reglas existentes: agrega esta regla en el orden adecuado y conserva un \`http_status:404\` final:

\`\`\`yaml
ingress:
  - hostname: erasmus.subdominio-institucional.example
    service: http://127.0.0.1:3000
  # Conservar aquí las reglas reales de los demás servicios
  - service: http_status:404
\`\`\`

La dirección \`.example\` no es un dominio real: el responsable TIC debe sustituirla por el subdominio aprobado. El hostname público **no** se usa como Service URL del origen.

## 4. Protección de coordinación y rutas privadas

- El túnel **no sustituye la autenticación**. Cualquiera que conozca el hostname público podrá llegar al servicio si no se añade otra política.
- Node.js comprueba el rol de coordinación en el servidor y solo permite aprobación de cuentas tras verificación por correo.
- Como segunda capa, valorar **Cloudflare Access** para proteger \`/coordinacion\` y \`/coordinacion/*\`. Las políticas se configuran en Zero Trust → Access → Applications.
- Si se aplica Cloudflare Access a **toda la aplicación**, definir un procedimiento compatible con el registro y la verificación de correo (o proteger por rutas), porque los nuevos usuarios deben poder abrir \`/registro\` y \`/verificar\` antes de ser aprobados.
- Aplicar políticas de seguridad y limitación de peticiones en el perímetro Cloudflare. La limitación en memoria de Node.js es solo una protección adicional para el prototipo.
- Revisar caché: las páginas de sesión y datos privados devuelven \`Cache-Control: no-store\`; no crear reglas que almacenen en caché esas respuestas.
- No publicar la API Key de Resend, claves de sesiones ni tokens del túnel.

## 5. Resend y enlaces de verificación

En la web, entra como coordinación en **Configurar Resend**.

- **API Key**: creada en Resend, con permisos de envío; queda cifrada en SQLite.
- **Remitente**: correo de un dominio autorizado y verificado mediante DNS en Resend.
- **URL pública**: la dirección HTTPS exacta del subdominio configurado en el túnel (sin ruta), por ejemplo \`https://erasmus.subdominio-institucional.example\`.

Los enlaces de correo se construirán desde esa URL pública. Para evitar que un enlace de un solo uso se filtre, se recomienda minimizar su registro y no enviarlo a servicios analíticos; la confirmación exige una acción POST con CSRF.

## 6. Comprobaciones antes de abrir el registro

\`\`\`bash
curl -I http://127.0.0.1:3000/
curl -I https://erasmus.subdominio-institucional.example/
sudo journalctl -u erasmusplus -n 50 --no-pager
systemctl status cloudflared --no-pager
\`\`\`

El primer \`curl\` realiza una solicitud HEAD y puede responder 405 porque la app solo acepta GET; comprueba el servicio preferentemente con \`curl -fsS http://127.0.0.1:3000/healthz\` y la web pública desde un navegador.

**No habilitar inscripciones con datos reales** hasta completar revisión legal y de seguridad, backups cifrados y pruebas de restauración, correo verificado, acceso por roles y auditoría técnica.

Documentación oficial:
- https://developers.cloudflare.com/tunnel/get-started/
- https://developers.cloudflare.com/tunnel/concepts/routing/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
