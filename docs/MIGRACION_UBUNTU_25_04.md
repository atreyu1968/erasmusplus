# Servidor Ubuntu 25.04: recuperación y migración segura

> **Situación verificada a 27 de octubre de 2026:** Ubuntu 25.04 (Plucky Puffin) terminó su soporte el **15 de enero de 2026** y Ubuntu 25.10 lo terminó el **9 de julio de 2026**. Ubuntu 26.04 LTS está disponible y dispone de soporte estándar hasta 2031. No activar la gestión de DNI/CIAL ni documentación familiar sobre 25.04.
>
> El instalador rechaza deliberadamente versiones sin mantenimiento de seguridad. **No edites la comprobación de versión ni añadas un parámetro para saltarla.**

## Opción recomendada: nuevo Ubuntu Server 26.04 LTS

Para un servidor que gestionará información del alumnado, recomiendo preparar una instalación limpia de **Ubuntu Server 26.04 LTS**. Si hay otros servicios funcionando en el servidor 25.04, lo más seguro es migrar primero a otra máquina o VM y mantener el servidor antiguo operativo hasta verificar el reemplazo.

1. Inventariar servicios activos: `systemctl --type=service --state=running --no-pager`. Comprobar el estado de `cloudflared`, discos y arquitectura mediante los comandos de abajo.
2. Tomar una instantánea del sistema o backup recuperable completo antes de cualquier cambio. **Incluir y custodiar de forma segura la configuración del Cloudflare Tunnel y sus credenciales**, tanto si el túnel es gestionado en la consola Cloudflare como si se utiliza un archivo local. No imprimir el token en el chat ni guardarlo en GitHub.
3. Instalar Ubuntu Server 26.04 LTS con SSH restringido, hora sincronizada, actualizaciones de seguridad y acceso administrativo controlado.
4. Restaurar/instalar el conector de Cloudflare según el método original, comprobar que se conecta y que los demás hostnames siguen funcionando. Coordinar los cambios DNS/rutas con TIC.
5. Instalar Erasmus+ MMG según las instrucciones del [README](../README.md) y conectar la ruta de la aplicación al origen **`http://127.0.0.1:3000`**, sin abrir el puerto públicamente.
6. Mantener `MMG_ENABLE_REGISTRATION=0` hasta validar protección de datos, Resend, permisos, backups y acceso por roles.

Comprobaciones que **no modifican** el servidor actual:

```bash
cat /etc/os-release
uname -m
df -h
sudo systemctl status cloudflared --no-pager
sudo systemctl list-unit-files --type=service | grep -E '(cloudflared|ssh|erasmusplus)'
sudo ls -ld /etc/cloudflared /var/lib/cloudflared 2>/dev/null || true
```

La configuración de `cloudflared` puede estar en otras rutas si fue instalado con un token de túnel remotamente gestionado. **No publiques `systemctl cat cloudflared` sin ocultar previamente tokens, credenciales o contraseñas.**

## Alternativa: conservar la instalación actual y actualizarla por etapas

**Solo si no es posible una instalación nueva y tienes una copia de seguridad verificada.** La secuencia oficial es:

```text
Ubuntu 25.04 (EOL) → Ubuntu 25.10 (EOL) → Ubuntu 26.04 LTS
```

No se admite saltar directamente desde 25.04 a 26.04 mediante el procedimiento ordinario. Las primeras etapas son versiones EOL, por lo que pueden necesitar usar `old-releases.ubuntu.com` y la guía de actualizaciones de versiones sin soporte.

- [Guía de Canonical para Ubuntu fuera de soporte](https://help.ubuntu.com/community/EOLUpgrades)
- [Actualizaciones de versión en Ubuntu Server](https://ubuntu.com/server/docs/how-to-upgrade-your-release/)
- [Notas oficiales de Ubuntu 26.04 LTS](https://documentation.ubuntu.com/release-notes/26.04/)

La herramienta habitual es `sudo do-release-upgrade`, ejecutada **una vez por salto** tras preparar los repositorios y paquetes adecuados. Puede requerir reiniciar entre saltos. No ejecutes `do-release-upgrade -d` ni cambies manualmente el codename `plucky` a `resolute` en los repositorios; no son sustitutos de una actualización controlada.

Si `apt-get update` falla por repositorios que ya no sirven 25.04, sigue la sección de repositorios históricos de la guía EOL: cambiar **solo el servidor de descarga** a `old-releases.ubuntu.com`, manteniendo el codename `plucky` durante esa etapa. Las fuentes de Ubuntu pueden estar en archivos `.sources` (formato Deb822), no solo en `/etc/apt/sources.list`. Después de completar cada salto, revisa el estado del sistema y de `cloudflared` antes de seguir.

**Advertencia:** en un equipo institucional con servicios activos no recomiendo hacer estos dos saltos desde una sesión SSH sin acceso de consola/snapshot y plan de recuperación. Coordina la ventana de mantenimiento con TIC.

## Cuando ya tengas Ubuntu 26.04 LTS

Verifica:

```bash
cat /etc/os-release
sudo apt-get update
sudo systemctl status cloudflared --no-pager
```

Instala la aplicación conforme al README. En el equipo nuevo también debes verificar que la ruta del túnel sigue apuntando al origen local correcto.

## Fuentes oficiales y fechas

- Fin de Ubuntu 25.04: https://lists.ubuntu.com/archives/ubuntu-announce/2026-January/000320.html
- Fin de Ubuntu 25.10: https://lists.ubuntu.com/archives/ubuntu-security-announce/2026-July/010877.html
- Lanzamiento de Ubuntu 26.04: https://lists.ubuntu.com/archives/ubuntu-announce/2026-April/000323.html
- Soporte de versiones: https://ubuntu.com/about/release-cycle
