# Privacidad y autorización de representantes legales — Erasmus+ MMG

## Marco jurídico y decisión del centro
En aplicación del RGPD y LOPDGDD, la base jurídica del tratamiento se determina por el responsable y su DPD. Los tratamientos educativos no requieren necesariamente consentimiento. Cuando se basa en consentimiento, la edad general en España es 14 años, salvo excepciones. Para la participación Erasmus+ el centro exige una autorización firmada del representante legal para toda persona menor de 18 años, como procedimiento interno, no como regla universal del RGPD.

Fuentes:
- https://www.aepd.es/preguntas-frecuentes/10-menores-y-educacion/FAQ-1001-cual-es-la-edad-para-que-los-menores-puedan-prestar-consentimiento-para-tratar-sus-datos-personales
- https://www.aepd.es/infografias/criterios-tratamiento-datos-personales-centros-educativos.pdf
- https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673

## Mayores de edad
En el registro se muestra el aviso de privacidad en /privacidad y se solicita una aceptación electrónica expresa de haber recibido esa información. Se registra fecha UTC, versión y huella SHA-256 del texto. Esto no equivale a consentimiento para finalidades opcionales. El correo se verifica mediante Resend y coordinación aprueba la cuenta manualmente. Las cuentas creadas manualmente por coordinación requieren que sea el propio interesado quien registre la aceptación mediante enlace temporal.

## Menores de 18 años
1. El alumno se registra y verifica su correo institucional.
2. Recibe un enlace temporal de siete días para /privacidad/tramite.
3. Descarga /privacidad/modelo.pdf, cumplimenta y firma el documento con su representante legal.
4. Adjunta un PDF firmado legible de hasta 6 MB en /privacidad/subir.
5. La plataforma guarda el archivo privado y su SHA-256; el estado queda pendiente.
6. Coordinación revisa firma y representación en /coordinacion/privacidad y aprueba o rechaza.
7. /coordinacion/estado impide activar la cuenta hasta que conste correo verificado y autorización aprobada.

Si el documento es rechazado se puede presentar de nuevo. La plataforma no certifica automáticamente la identidad del firmante: el centro debe tener un procedimiento para comprobar la representación legal. El modelo no reemplaza autorizaciones de viaje, de prácticas ni consentimientos específicos de imágenes o datos sensibles.

## Seguridad y conservación
Los PDFs no se sirven como archivos públicos y solo se recuperan desde rutas autorizadas. Se registran versiones, revisiones y acciones administrativas. El enlace temporal se intercambia por una cookie HttpOnly que evita mantener el token en la URL. Cifrar los backups y aprobar la retención, las condiciones de Resend y las posibles comunicaciones a entidades de acogida. No subir documentos, datos de familias o secretos a GitHub.

## Variables de privacidad obligatorias
Antes de activar el registro real, establecer valores oficiales aprobados para MMG_PRIVACY_VERSION, MMG_PRIVACY_CONTROLLER, MMG_PRIVACY_CONTACT, MMG_PRIVACY_DPO, MMG_PRIVACY_LEGAL_BASIS, MMG_PRIVACY_RETENTION y MMG_PRIVACY_RECIPIENTS. Debe existir configuración válida de Resend y MMG_ENABLE_REGISTRATION=1. Tener texto en las variables no sustituye aprobación jurídica; los datos personales reales no deben utilizarse sin revisión previa.

## Rutas de interés
- /privacidad: aviso de privacidad.
- /privacidad/tramite: trámite del interesado o del representante legal.
- /privacidad/modelo.pdf: modelo de autorización.
- /privacidad/subir: entrega del PDF.
- /privacidad/renovar: renovación del enlace temporal.
- /coordinacion/privacidad: revisión del documento.
- /coordinacion/estado: aprobación de la cuenta.

## PDF interactivo desde móviles, tabletas y ordenadores
El endpoint `/privacidad/modelo.pdf` descarga un **PDF AcroForm rellenable** generado con `pdf-lib`, con los datos del menor prerrellenados de forma editable. Incluye campos para nombre, fecha de nacimiento, estudios, identidad y teléfono del representante, relación familiar y lugar/fecha. Los campos siguen siendo editables al guardar y volver a abrir el archivo.

**Instrucciones para familias:** descargar el PDF y abrirlo con Adobe Acrobat Reader o un lector compatible; rellenar los campos, marcar la opción de parentesco y guardar el documento. Para la firma, emplear la opción del lector para dibujarla o firmar con un mecanismo electrónico admitido por el centro. Si no está disponible, imprimir, firmar y escanear el documento. Después, volver al enlace del trámite y adjuntar el PDF firmado (máximo 6 MB).

El navegador integrado en algunas aplicaciones móviles puede mostrar los campos pero no guardar correctamente sus valores; por eso se recomienda descargarlo y abrirlo con un lector PDF dedicado.

Una firma dibujada en pantalla no constituye por sí misma una firma electrónica cualificada ni acredita automáticamente la identidad. La coordinación deberá validar el documento y la representación legal conforme al procedimiento del centro.
