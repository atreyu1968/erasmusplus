# Movilidades Erasmus+ MMG

Plataforma de movilidad Erasmus+ del **IES Manuel Martín González** (Guía de Isora, Tenerife).

**Versión 0.1.0 — fase 1 (en desarrollo).** Backend Node.js sin dependencias externas, SQLite mediante \`node:sqlite\` y frontend adaptativo.

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

Ubuntu 24.04 LTS o posterior, Node.js **24 LTS** (necesario para \`node:sqlite\`) y, para producción, un subdominio institucional autorizado y HTTPS mediante Nginx.

## Instalar en Ubuntu (solo pruebas locales)

\`\`\`bash
git clone https://github.com/atreyu1968/erasmusplus.git
cd erasmusplus
node --version
cp .env.example .env
\`\`\`

Configura \`.env\`, sobre todo \`MMG_SECRET\` con 48 o más caracteres aleatorios (puedes generar el valor con \`openssl rand -hex 48\`). No subas este archivo a Git.

\`\`\`bash
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
5. El coordinador examina la solicitud desde **Control de cuentas**.
6. El coordinador aprueba (solo si el correo está verificado) o desactiva.
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

## Funciones aún pendientes

- Recuperación de contraseñas y acceso con passkeys/WebAuthn.
- Gestión editorial de notificaciones y destinatarios.
- Presentación real de candidaturas, PDFs con custodia inmutable y eliminación documentada.
- Chat interno con políticas transparentes de privacidad y moderación.
- Portal completo PWA (service worker e iconos oficiales).
- Revisión de accesibilidad, pruebas end-to-end, backup automatizado y auditoría de seguridad.
- Textos legales de protección de datos aprobados, política de conservación y verificación de infraestructura.

**No emplear esta versión con datos reales del alumnado ni publicarla en Internet sin revisión técnica y legal.** El código está preparado para pruebas de Fase 1, no certificado para producción. Nunca versionar \`data/\`, \`.env\`, contraseñas, claves ni documentos personales.
