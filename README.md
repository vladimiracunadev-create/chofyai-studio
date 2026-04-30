# ChofyAI Studio

[![CI](https://github.com/vladimiracunadev-create/chofyai-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/vladimiracunadev-create/chofyai-studio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20Apple%20Silicon-black?logo=apple)](docs/INSTALL_MAC.md)
[![Versión](https://img.shields.io/badge/versión-0.4.0--dev-indigo)](CHANGELOG.md)

ChofyAI Studio es una **aplicación de escritorio local para macOS Apple Silicon** orientada a centralizar la instalación, arranque y organización de herramientas creativas de IA.

Su objetivo no es ser un launcher genérico para cualquier repositorio, sino un **orquestador controlado** para un conjunto concreto de herramientas:

- **voz**: TTS y clonación de voz
- **ASR**: transcripción local
- **video/cara**: utilidades de face swap y procesamiento facial
- **música**: herramientas musicales locales
- **gestión**: rutas, logs, scripts, settings y empaquetado macOS

## Estado real del proyecto

### Lo que ya está implementado

- Shell de escritorio con **Tauri 2 + Rust + React/TypeScript**
- Lectura de manifests YAML desde `apps/`
- Guardado de `studio_home` en `storage/state/settings.json` durante desarrollo
- Guardado de `studio_home` en el directorio de datos de la app cuando está empaquetada
- Detección de instalación por archivos/carpetas declarados en `installed_if`
- Botones desde la UI para:
  - **Instalar** — con salida en tiempo real (streaming stdout)
  - **Actualizar** — re-ejecuta el script de instalación sobre una herramienta ya instalada
  - **Iniciar** — registra PID en `ProcessRegistry`
  - **Detener** — envía SIGTERM al proceso activo
  - **Reiniciar** — stop + start en secuencia
  - **Abrir carpeta** / **Abrir log**
- **Cola de instalaciones**: encola múltiples herramientas e instala una a una
- **Health check visual**: punto verde pulsante cuando la herramienta responde en su puerto TCP
- Scripts reales de instalación para las **5 herramientas**: Qwen3-TTS, whisper.cpp, FaceFusion, AceForge **y ComfyUI**
- **Resolución dual de disco**: `studio_home` solicitado vs. efectivo. Si el volumen externo está desmontado o sin permisos, fallback automático a `~/ChofyAIStudio`. UI muestra indicador de fallback.
- **Selector de volúmenes**: lista `~` y todos los `/Volumes/*` con espacio libre. Cambia el `studio_home` con un clic.
- **Zona de módulos / reubicación**: cada herramienta puede moverse a una ruta absoluta arbitraria (`relocate_module`). El override se guarda en `tool_overrides` dentro de `settings.json`. Reset desactiva el override sin mover archivos.
- **Barra de stats inferior**: CPU%, RAM usada/total, disco libre, uptime, load average — refresco cada 3 s.
- Empaquetado macOS (`.app` / `.dmg`) con Tauri — funciona ad-hoc sin Apple Developer ID.

### Pendiente — Fase 5+

- **Settings avanzados** en UI: `models_dir`, `outputs_dir`, `cache_dir` declarados en manifest pero sin controles aún.
- **Firma y notarización Apple**: requerida para distribución pública (no necesaria para uso personal).
- **Detección de puertos ocupados** antes de iniciar.
- **Cleanup de procesos huérfanos** al reiniciar la app.

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
| **ComfyUI** | imagen | 8188 | ✅ Operativa | `install-comfyui.sh` |

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

Hay **tres formas equivalentes**:

- **Desde la UI** (recomendado): el panel "Studio Home" lista volúmenes disponibles con espacio libre; un clic sobre `~` o cualquier `/Volumes/*` lo guarda.
- **Editando** `storage/state/settings.json`:

  ```json
  {
    "studio_home": "/Volumes/ORICO/ChofyIA/ChofyAIStudio",
    "tool_overrides": {},
    "fallback_home": null
  }
  ```

- **Sin tocar nada**: si `studio_home` no es escribible, ChofyAI usa `~/ChofyAIStudio` como fallback automático y lo indica en la barra inferior.

La estructura `tools/`, `modules/`, `logs/`, `models/`, `cache/` se crea sola al primer uso.

### 4. Ejecutar en modo desarrollo

```bash
export PATH="/opt/homebrew/bin:$PATH"

# Solo frontend (los botones de herramientas NO funcionan en este modo)
npm run dev:web

# App de escritorio completa — botones de instalar/iniciar SÍ funcionan
npm run tauri:dev
```

> ⚠️ **Importante:** `npm run dev:web` solo muestra la UI. Para que los botones de **Instalar**, **Iniciar**, **Carpeta** y **Logs** funcionen de verdad, hay que correr `npm run tauri:dev` (requiere Rust instalado).

## Studio Home y resolución dual de disco

La ruta principal de trabajo se guarda en:

```text
Desarrollo: storage/state/settings.json
App empaquetada: ~/Library/Application Support/cl.vladimiracuna.chofyai.studio/state/settings.json
```

Esquema completo:

```json
{
  "studio_home": "/Volumes/ORICO/ChofyIA/ChofyAIStudio",
  "tool_overrides": {
    "comfyui": "/Volumes/Externo2/ComfyModels/source"
  },
  "fallback_home": null
}
```

### Cómo se elige la ruta efectiva

1. Si `studio_home` apunta a un volumen montado y escribible → se usa.
2. Si no (volumen ausente, sin permisos) → cae al `fallback_home` o a `~/ChofyAIStudio`.
3. El `SystemSummary` expone `studio_home`, `studio_home_effective` y `using_fallback` para que la UI lo refleje.

### Recomendaciones

- **Volumen APFS** (interno o externo). En exFAT/HFS+ macOS crea archivos `._*` que rompen `cargo build`; el repo ya redirige `target/` a `/tmp/chofyai-target` para mitigarlo.
- Para descargas grandes (modelos), un volumen externo dedicado libera tu SSD principal.

## Zona de módulos / reubicación

Cada herramienta vive por defecto en `studio_home/tools/<id>`. La UI permite **moverla** a:

- `studio_home/modules/<id>` (sugerido por defecto al pulsar **📍 Mover**).
- Cualquier otra ruta absoluta — útil para mover modelos pesados a un volumen distinto.

El traslado:

- Usa `rename` cuando origen y destino están en el mismo volumen (instantáneo).
- Cae a copia recursiva + borrado cuando son volúmenes diferentes.
- Registra el override en `tool_overrides`, de modo que `install/start/restart` futuros respetan la nueva ruta sin tocar el manifest.

**Reset ruta** quita el override (no mueve archivos automáticamente).

## Scripts útiles

```bash
bash scripts/mac/doctor.sh "/ruta/a/tu/studio_home"
bash scripts/mac/install-qwen3-tts.sh
bash scripts/mac/install-whispercpp.sh
bash scripts/mac/install-facefusion.sh
bash scripts/mac/install-aceforge.sh
bash scripts/mac/install-comfyui.sh
bash scripts/mac/cleanup-tool.sh "/ruta/studio_home" "tool_id"
bash scripts/mac/clean-appledouble.sh   # borra ._* en discos no-APFS
```

## Empaquetado macOS

Para generar `.app` y `.dmg` en tu Mac:

```bash
npm ci
npm run package:mac
```

Salidas esperadas (el `target-dir` está redirigido por `.cargo/config.toml` para evitar archivos `._*` en volúmenes externos):

```text
/tmp/chofyai-target/release/bundle/macos/ChofyAI Studio.app
/tmp/chofyai-target/release/bundle/dmg/ChofyAI Studio_*.dmg
```

> Ver detalles en [`docs/packaging.md`](docs/packaging.md). Build ad-hoc (sin Apple Developer ID) funciona para uso local: en el primer arranque, click derecho → Abrir.

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
