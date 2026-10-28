# Comprobación de identidad y representación legal

La autorización firmada de una persona menor de 18 años es el documento ordinario del proceso Erasmus+ MMG.

No se exige automáticamente una fotocopia íntegra del DNI/NIE ni una foto tipo selfie. La coordinación valorará de forma individual si la identidad o la representación legal requiere comprobación adicional. El documento identificativo acredita identidad, pero no demuestra por sí mismo patria potestad o tutela.

Orden de preferencia para resolver dudas: contrastar información ya verificada del centro; comprobar la identidad presencialmente sin conservar copia; emplear un medio de identificación electrónica autorizado; o solicitar la acreditación documental estrictamente necesaria según el procedimiento aprobado por el delegado de protección de datos.

Si el centro aprueba una carga documental excepcional, deberán definirse la finalidad, base jurídica, nivel de acceso, cifrado, supresión, plazo de conservación y registro de auditoría antes de habilitar la opción. Nunca solicitar documentos por correo ordinario ni chat, y permitir ocultar datos innecesarios.

Referencias: https://www.aepd.es/preguntas-frecuentes/1-tus-derechos/3-identificacion-con-dni/FAQ-0116-que-puedo-hacer-si-me-solicitan-una-copia-del-dni y https://www.aepd.es/documento/2023-0048.pdf

## Implementación en el panel de coordinación

En **Coordinación → Autorizaciones de menores**, antes de aprobar el PDF firmado se exige registrar un método de comprobación de identidad y representación legal y una nota mínima sobre cómo se realizó. Los métodos disponibles son: datos ya acreditados previamente en el centro, comprobación presencial, identificación electrónica admitida o acreditación documental examinada sin conservar una copia.

La aplicación guarda método, constancia, fecha/hora y usuario revisor en SQLite, con auditoría. Una autorización no se aprueba si no se documenta esta comprobación. **La plataforma no pide ni almacena de forma general copias del DNI/NIE o fotografías personales de las familias.**

Una futura recepción digital de documentos identificativos deberá diseñarse con aprobación del DPD, cifrado de archivos, justificación de la solicitud, acceso restringido, plazo de borrado y comprobaciones técnicas de seguridad; no queda habilitada en esta versión.
