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

## Distribución interna vs distribución profesional

### Interna / pruebas personales
Puedes generar `.app` / `.dmg` y probarlo localmente.

### Profesional / terceros
Necesitarás:
- cuenta Apple Developer
- firma
- notarización
