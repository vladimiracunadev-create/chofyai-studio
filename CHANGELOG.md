# Changelog

All notable changes to ChofyAI Studio are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Despliegue local verificado en disco externo ORICO `/Volumes/ORICO/ChofyIA/chofyai-studio`
- `Studio Home` configurado en `/Volumes/ORICO/ChofyIA/ChofyAIStudio` con estructura de directorios creada
- `.npmrc` con registry público `registry.npmjs.org` para evitar registros corporativos hardcodeados
- `._*` añadido a `.gitignore` para evitar archivos de recursos macOS en volúmenes exFAT
- `common.sh` inyecta `PATH=/opt/homebrew/bin:...` para que los scripts funcionen cuando son lanzados desde Tauri/Rust (entorno sin shell interactivo)
- Dependencias del sistema instaladas y verificadas: Homebrew 5.0.14, cmake 4.3.1, ffmpeg 8.1, python 3.10.20, python 3.11.15, rust 1.94.1, uv 0.11.3
- `docs/INSTALL_MAC.md` reescrito con tabla completa de dependencias, pasos exactos y advertencia sobre modo web vs modo Tauri
- `docs/STATUS.md` actualizado con tabla de entorno verificado y nota clara sobre limitaciones de modo web

### Fixed

- `package-lock.json` regenerado desde `registry.npmjs.org` (el anterior apuntaba a un registro interno inaccesible)
- `package.json` version alineada a `0.2.0` para coincidir con `CHANGELOG.md` y `docs/STATUS.md`
- `storage/state/settings.json` corregido (eliminado placeholder `CHANGE_ME`, apunta a ruta real)

### Planned (Fase 2 / Fase 3)

- Stop / Restart por herramienta desde la UI
- Health checks reales por proceso y puerto
- Cola de instalaciones con progreso visible
- Settings avanzados (`models_dir`, `outputs_dir`, `cache_dir`)
- Integración operativa de ComfyUI

---

## [0.2.0] — 2026-03-20

### Added

- Scripts de limpieza `cleanup-tool.sh` con argumento de `tool_id`
- Script `doctor.sh` con diagnóstico de `studio_home` y herramientas
- Script `preflight-build.sh` para verificar prerequisitos antes de empaquetar
- Base de empaquetado macOS: `npm run package:mac` genera `.app` y `.dmg` mediante Tauri
- Manifests YAML para las 5 herramientas (Qwen3-TTS, whisper.cpp, FaceFusion, AceForge, ComfyUI)
- Campo `installed_if` en manifests para detectar instalación real por rutas de archivo
- Integración operativa de **AceForge** (workstation musical local-first)
- Documentación en `docs/`: `PROJECT_OVERVIEW.md`, `STATUS.md`, `INSTALL_MAC.md`, `TOOLS.md`, `TROUBLESHOOTING.md`, `packaging.md`, `architecture.md`, `decisions.md`

### Changed

- `studio_home` en modo empaquetado ahora usa el directorio de datos de Tauri en lugar de `storage/state/settings.json`
- Refactorización de comandos Rust: separación clara entre `save_studio_home`, `list_tools`, `install_tool`, `start_tool`, `open_tool_directory`, `open_tool_log`

### Fixed

- Detección de instalación ahora usa `installed_if` del manifest en lugar de estado interno
- Guardado de settings persiste correctamente al relanzar la app

---

## [0.1.0] — 2026-03-01

### Added

- Estructura inicial del repositorio: `apps/`, `docs/`, `scripts/mac/`, `src/`, `src-tauri/`, `storage/`
- Shell de escritorio con **Tauri 2 + Rust + React/TypeScript + Vite**
- Lectura de manifests YAML desde `apps/`
- Guardado de `studio_home` en `storage/state/settings.json` (modo desarrollo)
- Detección de instalación básica por archivos declarados en el manifest
- Botones de UI: **Instalar**, **Iniciar**, **Abrir carpeta**, **Abrir log**
- Scripts de instalación operativos para: **Qwen3-TTS**, **whisper.cpp**, **FaceFusion**
- `bootstrap.sh`: verificación de prerequisitos (Rust, Node.js, Xcode CLT)
- `install-qwen3-tts.sh`: TTS + clonación de voz con backend MLX
- `install-whispercpp.sh`: compilación desde fuente con CMake + Metal
- `install-facefusion.sh`: face swap y procesamiento facial + venv

[Unreleased]: https://github.com/vladimiracunadev-create/chofyai-studio/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/vladimiracunadev-create/chofyai-studio/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/vladimiracunadev-create/chofyai-studio/releases/tag/v0.1.0
