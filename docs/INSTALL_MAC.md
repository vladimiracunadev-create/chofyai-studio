# Instalación y uso en macOS

## Objetivo

Levantar ChofyAI Studio en un Mac Apple Silicon y dejar lista la base para instalar herramientas desde la UI.

## Requisitos mínimos

- macOS en Apple Silicon
- Node.js
- npm
- Rust / cargo
- Xcode Command Line Tools
- git
- python3

## Verificación rápida

```bash
bash scripts/mac/bootstrap.sh
bash scripts/mac/preflight-build.sh
```

## Instalación paso a paso

### 1. Entrar al proyecto

```bash
cd chofyai-studio
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Definir Studio Home

Edita:

```text
storage/state/settings.json
```

Ejemplo recomendado:

```json
{
  "studio_home": "/Users/tu_usuario/ChofyAIStudio"
}
```

## Ejecutar en modo desarrollo

### Modo web

```bash
npm run dev:web
```

### Modo escritorio

```bash
npm run tauri:dev
```

## Ejecutar diagnóstico básico

```bash
bash scripts/mac/doctor.sh "/Users/tu_usuario/ChofyAIStudio"
```

## Instalar herramientas por consola

### Qwen3-TTS

```bash
bash scripts/mac/install-qwen3-tts.sh
```

### whisper.cpp

```bash
bash scripts/mac/install-whispercpp.sh
```

### FaceFusion

```bash
bash scripts/mac/install-facefusion.sh
```

### AceForge

```bash
bash scripts/mac/install-aceforge.sh
```

## Empaquetado macOS

```bash
npm ci
npm run package:mac
```

## Ubicación esperada del resultado

```text
src-tauri/target/release/bundle/macos/
src-tauri/target/release/bundle/dmg/
```

## Recomendaciones de ruta

Usa preferentemente:

- SSD interno
- volumen APFS

Evita:

- exFAT
- discos que generen problemas con `._*`
- rutas inestables o volúmenes no montados
