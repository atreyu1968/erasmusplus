# Movilidades Erasmus+ MMG

Aplicación de gestión de movilidades Erasmus+ del **IES Manuel Martín González (Guía de Isora, Tenerife)**.

## Estado del proyecto

**Fase 1 (MVP de pruebas):** Node.js + SQLite, tres perfiles, solicitudes de alta pendientes de aprobación, acceso con contraseña, panel de coordinación y vistas informativas. **No introducir datos personales reales hasta completar la revisión de seguridad y protección de datos.**

## Requisitos

- Ubuntu 24.04 LTS o posterior
- Node.js **24 LTS**
- Servidor Nginx como proxy inverso y HTTPS para la publicación institucional

## Inicio local

```bash
git clone https://github.com/atreyu1968/erasmusplus.git
cd erasmusplus
cp .env.example .env
# Revisar configuración (NO subir .env)
npm start
```

La aplicación se inicia por defecto en `http://127.0.0.1:3000`.

Para crear el primer coordinador: editar temporalmente variables `MMG_ADMIN_*` y ejecutar `npm run init-admin`. Nunca se permite autorregistro como coordinador.

## Seguridad

- Contraseñas derivadas con `scrypt` de Node.js; sin contraseñas en texto plano.
- Sesiones persistidas en SQLite con tokens aleatorios y hashes SHA-256.
- Roles validados en el servidor y aprobación manual de cuentas.
- Formularios protegidos con CSRF.
- Por defecto el registro queda deshabilitado hasta aprobar el aviso de privacidad y habilitarlo conscientemente.
- No hay SMS ni notificaciones por correo activas en esta fase.

## Pendiente

Correo institucional, recuperación de contraseñas, firma legal y privacidad validadas, exportación segura de PDF, chat, auditoría ampliada, copias de seguridad cifradas, pruebas de seguridad y PWA instalable.

**El repositorio público no debe contener bases de datos, expedientes, contraseñas, claves ni datos reales.**
