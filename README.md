# ChofyAI Studio

[![CI](https://github.com/vladimiracunadev-create/chofyai-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/vladimiracunadev-create/chofyai-studio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20Apple%20Silicon-black?logo=apple)](docs/INSTALL_MAC.md)
[![Versión](https://img.shields.io/badge/versión-0.2.0-indigo)](CHANGELOG.md)

ChofyAI Studio es una **aplicación de escritorio local para macOS Apple Silicon** orientada a centralizar la instalación, arranque y organización de herramientas creativas de IA.

Su objetivo no es ser un launcher genérico para cualquier repositorio, sino un **orquestador controlado** para un conjunto concreto de herramientas:

- **voz**: TTS y clonación de voz
- **ASR**: transcripción local
- **video/cara**: utilidades de face swap y procesamiento facial
- **música**: herramientas musicales locales
- **gestión**: rutas, logs, scripts, settings y empaquetado macOS

## Estado real del proyecto

### Lo que ya está implementado

- shell de escritorio con **Tauri 2 + Rust + React/TypeScript**
- lectura de manifests YAML desde `apps/`
- guardado de `studio_home` en `storage/state/settings.json` durante desarrollo
- guardado de `studio_home` en el directorio de datos de la app cuando esta empaquetada
- detección de instalación por archivos/carpetas declarados en `installed_if`
- botones desde la UI para:
  - **Instalar**
  - **Iniciar**
  - **Abrir carpeta**
  - **Abrir log**
- scripts reales de instalación para:
  - **Qwen3-TTS**
  - **whisper.cpp**
  - **FaceFusion**
  - **AceForge**
- preparación de empaquetado macOS (`.app` / `.dmg`) con Tauri

### Pendiente — Fase 3 y 4

- **ComfyUI**: declarada en manifest, sin script de instalación aún
- **Stop / Restart / Health checks**: control de procesos desde la UI
- **Cola de instalaciones**: instalación secuencial con progreso visible
- **Flujo de actualización automática**: actualizaciones de herramientas desde la UI
- **Firma y notarización Apple**: necesario para distribución pública

> Ver hoja de ruta completa en [ROADMAP.md](ROADMAP.md)

## Stack técnico

- **Desktop shell**: Tauri 2
- **Core**: Rust
- **UI**: React + TypeScript + Vite
- **Integración de herramientas**: scripts Bash + Python + binarios externos
- **Configuración de herramientas**: manifests YAML

## Herramientas incluidas en esta fase

| Herramienta | Categoría | Puerto | Estado | Script |
|---|---|---|---|---|
| **Qwen3-TTS** | voz / TTS | 7860 | ✅ Operativa | `install-qwen3-tts.sh` |
| **whisper.cpp** | ASR | 8178 | ✅ Operativa | `install-whispercpp.sh` |
| **FaceFusion** | video / cara | — | ✅ Operativa | `install-facefusion.sh` |
| **AceForge** | música | 5056 | ✅ Operativa | `install-aceforge.sh` |
| **ComfyUI** | imagen | — | 🚧 Declarada | — |

> Ver especificación completa de manifests en [`docs/MANIFEST_SPEC.md`](docs/MANIFEST_SPEC.md).

## Estructura del repositorio

```text
chofyai-studio/
├─ apps/                  # manifests YAML por herramienta
├─ docs/                  # documentación del proyecto
├─ public/                # assets estáticos
├─ scripts/mac/           # scripts operativos para macOS
├─ src/                   # frontend React/TypeScript
├─ src-tauri/             # backend Tauri/Rust
├─ storage/               # estado local y placeholders de runtime
├─ package.json
└─ README.md
```

## Documentación incluida

### Proyecto

| Archivo | Contenido |
|---|---|
| [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) | Visión general y filosofía |
| [`docs/STATUS.md`](docs/STATUS.md) | Estado actual (v0.2.0) |
| [`docs/architecture.md`](docs/architecture.md) | Arquitectura por capas con diagrama |
| [`docs/decisions.md`](docs/decisions.md) | Architecture Decision Records (ADR-001…ADR-005) |
| [`ROADMAP.md`](ROADMAP.md) | Fases futuras |
| [`CHANGELOG.md`](CHANGELOG.md) | Historial de versiones |

### Operación

| Archivo | Contenido |
|---|---|
| [`docs/INSTALL_MAC.md`](docs/INSTALL_MAC.md) | Instalación completa en macOS |
| [`docs/TOOLS.md`](docs/TOOLS.md) | Herramientas integradas y requisitos |
| [`docs/SCRIPTS_REFERENCE.md`](docs/SCRIPTS_REFERENCE.md) | Referencia completa de scripts |
| [`docs/MANIFEST_SPEC.md`](docs/MANIFEST_SPEC.md) | Especificación del formato YAML |
| [`docs/packaging.md`](docs/packaging.md) | Empaquetado `.app` / `.dmg` |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Problemas comunes |

### Contribución y seguridad

| Archivo | Contenido |
|---|---|
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Cómo contribuir al proyecto |
| [`SECURITY.md`](SECURITY.md) | Política de seguridad y reporte de vulnerabilidades |

## Instalación en tu Mac

### 0. Instalar dependencias del sistema

```bash
brew install node rust cmake ffmpeg python@3.10 python@3.11 uv git
```

> Ver tabla completa en [`docs/INSTALL_MAC.md`](docs/INSTALL_MAC.md)

### 1. Clonar el proyecto

```bash
git clone https://github.com/vladimiracunadev-create/chofyai-studio.git
cd chofyai-studio
```

### 2. Instalar dependencias del frontend

```bash
# El .npmrc del proyecto fija registry a npmjs.org automáticamente
npm install
```

### 3. Configurar Studio Home

Editar `storage/state/settings.json`:

```json
{
  "studio_home": "/Volumes/ORICO/ChofyIA/ChofyAIStudio"
}
```

Crear la estructura de directorios:

```bash
mkdir -p /Volumes/ORICO/ChofyIA/ChofyAIStudio/{tools,logs,models,cache}
```

### 4. Ejecutar en modo desarrollo

```bash
export PATH="/opt/homebrew/bin:$PATH"

# Solo frontend (los botones de herramientas NO funcionan en este modo)
npm run dev:web

# App de escritorio completa — botones de instalar/iniciar SÍ funcionan
npm run tauri:dev
```

> ⚠️ **Importante:** `npm run dev:web` solo muestra la UI. Para que los botones de **Instalar**, **Iniciar**, **Carpeta** y **Logs** funcionen de verdad, hay que correr `npm run tauri:dev` (requiere Rust instalado).

## Studio Home

La ruta principal de trabajo se guarda en:

```text
Desarrollo: storage/state/settings.json
App empaquetada: directorio de datos de Tauri + /state/settings.json
```

Ejemplo:

```json
{
  "studio_home": "/Users/tu_usuario/ChofyAIStudio"
}
```

Se recomienda:

- **SSD interno** o volumen **APFS**
- evitar exFAT u otros volúmenes que puedan meter archivos `._*`

## Scripts útiles

```bash
bash scripts/mac/doctor.sh "/ruta/a/tu/studio_home"
bash scripts/mac/install-qwen3-tts.sh
bash scripts/mac/install-whispercpp.sh
bash scripts/mac/install-facefusion.sh
bash scripts/mac/install-aceforge.sh
bash scripts/mac/cleanup-tool.sh "/ruta/studio_home" "tool_id"
```

## Empaquetado macOS

Para generar `.app` y `.dmg` en tu Mac:

```bash
npm ci
npm run package:mac
```

Salidas esperadas:

```text
src-tauri/target/release/bundle/macos/
src-tauri/target/release/bundle/dmg/
```

> Ver detalles en [`docs/packaging.md`](docs/packaging.md).

## CI/CD

Este repositorio incluye GitHub Actions configurados en `.github/workflows/`:

| Workflow | Trigger | Qué hace |
|---|---|---|
| [`ci.yml`](.github/workflows/ci.yml) | push / PR a `main` | Lint Markdown, TypeScript typecheck, validación de manifests YAML, secret scanning |
| [`release.yml`](.github/workflows/release.yml) | `workflow_dispatch` | Crea tag + GitHub Release con notas desde `CHANGELOG.md` |

## Contribuir

¿Quieres añadir una herramienta, reportar un bug o proponer una mejora?
Lee [`CONTRIBUTING.md`](CONTRIBUTING.md) para el flujo completo.

## Licencia

Este repositorio incluye `LICENSE` de base. Ajusta branding, nombre legal y licencia definitiva antes de distribución pública.
