# Empaquetado de ChofyAI Studio

## Objetivo

Generar un `.app` y un `.dmg` desde tu Mac para uso local o distribución controlada.

## Qué quedó preparado

- configuración Tauri para bundle macOS
- íconos base en `src-tauri/icons/`
- `Info.plist`
- `Entitlements.plist`
- script de preflight
- script de build release
- lectura de manifests y scripts desde recursos empaquetados
- escritura de settings en un directorio de datos de usuario en vez del bundle

## Requisitos en tu Mac

Instala y verifica:

```bash
xcode-select --install
node -v
npm -v
cargo --version
```

## Preflight

```bash
npm run preflight:mac
```

## Build completo

```bash
npm ci
npm run package:mac
```

## Comandos disponibles

```bash
npm run tauri:build:app
npm run tauri:build:dmg
npm run tauri:build:mac
npm run package:mac
```

## Salidas esperadas

```text
src-tauri/target/release/bundle/macos/
src-tauri/target/release/bundle/dmg/
```

## Qué no hace esta fase

- no firma la app
- no notariza la app
- no publica releases automáticamente

## Tarea Pendiente: Automatización CI/CD con tu Mac Mini

Actualmente, el workflow `.github/workflows/release.yml` solo crea las notas de release, pero **no genera el binario `.app/.dmg`**, ya que eso requiere un entorno macOS Apple Silicon.

Para automatizar esto sin costo, **es necesario registrar tu Mac Mini física como un "Self-Hosted Runner" de GitHub**.

### Pasos a futuro

1. En GitHub, ve a **Settings > Actions > Runners > New self-hosted runner**.
2. Selecciona **macOS** y **ARM64**.
3. Sigue las instrucciones para descargar e instalar el agente en tu Mac Mini.
4. Modifica `.github/workflows/release.yml` para usar `runs-on: self-hosted` y añadir los pasos de `npm run package:mac`.

Con esto, cada vez que dispares un Release desde GitHub, **tu Mac Mini** recibirá la orden, compilará la app en 1-2 minutos (usando su caché local) y subirá el `.dmg` al release automáticamente.

## Distribución interna vs distribución profesional

### Interna / pruebas personales

Puedes generar `.app` / `.dmg` y probarlo localmente.

### Profesional / terceros

Necesitarás:

- cuenta Apple Developer
- firma (Developer ID Application)
- notarización alcatraz/notarytool
