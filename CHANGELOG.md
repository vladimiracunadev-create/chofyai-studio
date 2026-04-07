# Changelog

All notable changes to ChofyAI Studio are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Despliegue local verificado en disco externo ORICO (macOS Apple Silicon)
- `.npmrc` con registro público `registry.npmjs.org` para evitar registros corporativos hardcodeados
- `._*` añadido a `.gitignore` para evitar archivos de recursos macOS en exFAT

### Fixed

- `package-lock.json` regenerado desde `registry.npmjs.org` (el anterior apuntaba a un registro interno inaccesible)
- `package.json` version alineada a `0.2.0` para coincidir con `CHANGELOG.md` y `docs/STATUS.md`

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
