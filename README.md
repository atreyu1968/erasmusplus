# Movilidades Erasmus+ MMG

Plataforma de movilidad Erasmus+ del **IES Manuel Martín González** (Guía de Isora, Tenerife).

**Versión 0.3.0 — versión funcional para pruebas.** Backend Node.js 24 con SQLite mediante node:sqlite, WebAuthn con SimpleWebAuthn y frontend responsive/PWA.

## Funcionalidades implementadas

- Registro para docentes y alumnado; usuario automático por DNI / CIAL.
- Contraseñas derivadas mediante \`scrypt\` y sesiones privadas guardadas en SQLite.
- **Verificación del correo institucional con Resend** mediante enlace de un solo uso y caducidad de 24 horas.
- **Aprobación manual obligatoria**: únicamente Coordinación puede activar una cuenta cuyo correo ya esté verificado.
- Panel administrativo con fichas de usuarios, recuentos, aprobación y desactivación.
- **Configuración privada de Resend** en \`/coordinacion/configuracion\`, con API Key cifrada mediante AES-256-GCM en SQLite.
- Aviso de aprobación por correo (si Resend funciona correctamente).
- Vistas informativas de Viseu, Oporto, Róterdam y modalidades 2026–2027.
- Auditoría básica, CSRF, protección de cookies e intentos de acceso limitados.

No se emplean SMS. Las API Keys **no se incluyen en el repositorio**.

## Requisitos

Ubuntu 24.04 LTS o posterior, Node.js **24 LTS**, subdominio institucional y HTTPS mediante el **Cloudflare Tunnel ya instalado**. No es necesario instalar Nginx para esta arquitectura.

## Instalar en Ubuntu (solo pruebas locales)

\`\`\`bash
git clone https://github.com/atreyu1968/erasmusplus.git
cd erasmusplus
node --version
cp .env.example .env
\`\`\`

Configura \`.env\`, sobre todo \`MMG_SECRET\` con 48 o más caracteres aleatorios (puedes generar el valor con \`openssl rand -hex 48\`). No subas este archivo a Git.

\`\`\`bash
npm install
npm run init-admin
npm start
\`\`\`

Para \`npm run init-admin\` hay que definir previamente en \`.env\` las variables \`MMG_ADMIN_USERNAME\`, \`MMG_ADMIN_PASSWORD\` (mínimo 16 caracteres) y \`MMG_ADMIN_EMAIL\`. **Borra estas variables del archivo después del alta.** El usuario coordinador se crea una única vez, desde consola, no mediante registro público.

En pruebas locales abre \`http://127.0.0.1:3000\`.

> **Importante:** el registro viene deshabilitado. No modifiques \`MMG_ENABLE_REGISTRATION=0\` ni la versión de privacidad hasta que el centro haya aprobado el aviso, las medidas técnicas y los procedimientos para tratar datos reales.

## Configuración de Resend desde el panel

1. Accede con la cuenta de Coordinación.
2. Entra en **Configurar Resend**.
3. Introduce la **API Key**, el **correo remitente autorizado** y la **URL pública HTTPS** de la web.
4. Guarda: la clave se cifra con un secreto derivado de \`MMG_SECRET\` y se guarda en SQLite; no se vuelve a mostrar en el navegador.
5. Comprueba el envío mediante el botón de prueba dirigido al correo institucional de Coordinación.

Debes **verificar el dominio remitente y sus registros DNS en el panel de Resend**. El correo remitente configurado debe pertenecer a ese dominio o a uno autorizado. Resend no habilita por sí solo el subdominio institucional del centro; esa publicación corresponde al equipo TIC.

**No cambies \`MMG_SECRET\` sin planificar la rotación**, porque protege las claves guardadas y las sesiones.

## Flujo de registro

1. Docente o alumnado rellena los formularios.
2. La aplicación guarda la cuenta como \`pending\`.
3. Resend envía un enlace al correo \`@canariaseducacion.es\`.
4. El usuario confirma el correo.
5. Las personas adultas registran electrónicamente la lectura del aviso; las menores de 18 años entregan un PDF firmado por su representante, que coordinación revisa en **Autorizaciones de menores**.
6. El coordinador aprueba solo si el correo está verificado y el requisito de privacidad o autorización se ha completado.
7. La aplicación envía un aviso de resolución mediante Resend.

La pantalla **Reenviar verificación** permite pedir otro enlace si el inicial caducó o no llegó. El sistema no confirma públicamente la existencia de una cuenta.

## Despliegue con Cloudflare Tunnel existente y systemd

Hay ejemplos iniciales en \`deploy/\`, que deben adaptarse al subdominio institucional, usuario de servicio, permisos de red y certificados gestionados por TIC.

Para producción:

- \`MMG_ENV=production\`
- \`MMG_SECURE_COOKIE=1\`
- \`MMG_SECRET\` de al menos 48 caracteres
- \`HOST=127.0.0.1\` y aplicación **no accesible directamente desde Internet**
- Cloudflare Tunnel existente con ruta HTTPS al puerto local 3000; configurar reglas perimetrales y revisar Cloudflare Access para coordinación
- Copias de seguridad cifradas, retención, permisos restrictivos y restauración probada

## Nuevos módulos publicados
- Candidatura de movilidad corta, Dual-Erasmus+ y Job Shadowing con permisos por perfil y PDF de entrega.
- Documentación privada, subida y descarga controladas, auditoría y baja administrativa de documentos.
- Notificaciones por destinatarios con adjuntos y cola persistente de correos Resend.
- Chat de participantes restringido a coordinación y miembros de sus grupos; supervisión administrativa auditada y comunicada.
- Creación de grupos y asignación de alumnado o docentes acompañantes.
- Edición de fichas y bajas, recuperación de acceso, passkeys/WebAuthn opcionales.
- PWA inicial instalable, sin almacenamiento en caché de datos privados.
- Aviso de privacidad versionado, aceptación electrónica de adultos y PDF de autorización firmada por representante legal para menores de 18 años. Coordinación debe aprobar el documento antes de activar cuentas.
- Guías culturales y normativas para Portugal y Países Bajos.

### Antes de utilizar información real
- Revisar el modelo y la base jurídica con el responsable del tratamiento y su delegado de protección de datos; configurar los campos MMG_PRIVACY_*.
- Completar pruebas end-to-end y de seguridad independientes, revisión de accesibilidad y controles sobre archivos subidos.
- Configurar copias de seguridad cifradas, restauración de pruebas y políticas de conservación y eliminación.
- Verificar dominio, DNS, Cloudflare Tunnel, Cloudflare Access en coordinación, políticas de protección y el remitente de Resend.
- Añadir los logotipos oficiales suministrados por el centro y fotografías verificadas de cada destino.
- Validar las autorizaciones de viaje, convivencia, prácticas y cualquier consentimiento adicional con el centro.

Guías detalladas: docs/PRIVACIDAD_Y_MENORES.md, deploy/CLOUDFLARE_TUNNEL.md y docs/UBUNTU.md.

**No emplear esta versión con datos reales del alumnado ni publicarla en Internet sin revisión técnica y legal.** El código está preparado para pruebas de Fase 1, no certificado para producción. Nunca versionar \`data/\`, \`.env\`, contraseñas, claves ni documentos personales.
