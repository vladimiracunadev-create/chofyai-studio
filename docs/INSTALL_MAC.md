# Instalación y uso en macOS

> Última actualización: **2026-04-07**

## Objetivo

Levantar ChofyAI Studio en un Mac Apple Silicon y dejar lista la base para instalar herramientas desde la UI.

## Requisitos del sistema

| Herramienta | Versión mínima | Cómo instalar |
|---|---|---|
| macOS | 13 Ventura | — Apple Silicon requerido |
| Xcode Command Line Tools | Cualquier reciente | `xcode-select --install` |
| Homebrew | 4.x+ | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| Node.js | 20 LTS+ | `brew install node` |
| Rust / cargo | 1.76+ | `brew install rust` |
| cmake | 3.x+ | `brew install cmake` |
| ffmpeg | Cualquier reciente | `brew install ffmpeg` |
| python@3.10 | 3.10.x | `brew install python@3.10` |
| python@3.11 | 3.11.x | `brew install python@3.11` |
| uv | 0.x+ | `brew install uv` |
| git | Cualquier reciente | Incluido con Xcode CLT |

> **Nota importante:** Los scripts de instalación de herramientas buscan los binarios en `/opt/homebrew/bin`. Si instalas con `rustup` o `pyenv` en lugar de Homebrew, asegúrate de que las rutas estén disponibles.

## Instalación de todas las dependencias de una vez

```bash
brew install node rust cmake ffmpeg python@3.10 python@3.11 uv git
```

## Verificación rápida

```bash
# Verifica que todo esté en orden antes de usar la app
bash scripts/mac/bootstrap.sh
bash scripts/mac/preflight-build.sh
```

## Instalación paso a paso

### 1. Clonar el proyecto

```bash
git clone https://github.com/vladimiracunadev-create/chofyai-studio.git
cd chofyai-studio
```

### 2. Instalar dependencias del frontend

```bash
# El .npmrc del proyecto fija el registry a npmjs.org automáticamente
npm install
```

### 3. Definir Studio Home

Edita `storage/state/settings.json` con la ruta donde quieres que las herramientas se instalen:

```json
{
  "studio_home": "/Volumes/ORICO/ChofyIA/ChofyAIStudio"
}
```

> **Recomendaciones de ruta:**
> - Preferir SSD interno o volumen APFS
> - Evitar exFAT (genera archivos `._*` que interfieren con git)
> - Evitar rutas con espacios

### 4. Crear la estructura del Studio Home

```bash
mkdir -p /Volumes/ORICO/ChofyIA/ChofyAIStudio/{tools,logs,models,cache}
```

## Ejecutar en modo desarrollo

### Modo web (solo frontend, sin backend Rust)

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm run dev:web
# Abre: http://localhost:1420
```

> ⚠️ En modo web los botones de instalar/iniciar herramientas **no funcionan** — requieren el backend Tauri compilado.

### Modo escritorio completo (requiere Rust instalado)

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm run tauri:dev
```

Este modo activa el backend Rust y permite usar los botones de instalación e inicio de herramientas.

## Ejecutar diagnóstico

```bash
bash scripts/mac/doctor.sh "/Volumes/ORICO/ChofyIA/ChofyAIStudio"
```

## Instalar herramientas desde terminal (alternativa a la UI)

Los scripts leen automáticamente el `studio_home` desde `storage/state/settings.json`.

```bash
# Qwen3-TTS — TTS y clonación de voz (requiere python3.10)
bash scripts/mac/install-qwen3-tts.sh

# whisper.cpp — ASR local (requiere cmake)
bash scripts/mac/install-whispercpp.sh

# FaceFusion — face swap y video (requiere ffmpeg)
bash scripts/mac/install-facefusion.sh

# AceForge — workstation musical (requiere ffmpeg)
bash scripts/mac/install-aceforge.sh
```

## Empaquetado macOS (.app / .dmg)

```bash
npm ci
npm run package:mac
```

Salidas esperadas:

```text
src-tauri/target/release/bundle/macos/ChofyAI Studio.app
src-tauri/target/release/bundle/dmg/ChofyAI Studio_0.2.0_aarch64.dmg
```

> Requiere Rust, Xcode CLT y todas las dependencias instaladas.
