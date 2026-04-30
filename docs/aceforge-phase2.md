# 🎵 AceForge — bitácora Fase 2

> **Bitácora histórica de la integración Fase 2.** Para el estado actual ver [`STATUS.md`](STATUS.md) y [`TOOLS.md`](TOOLS.md).

[![Fase](https://img.shields.io/badge/Fase-2%20histórica-informational)](../ROADMAP.md)


## Objetivo

Integrar **AceForge** como módulo musical operativo dentro de ChofyAI Studio, sin depender de Pinokio.

## Qué hace esta integración

- clona el repositorio `audiohacking/AceForge`
- crea `venv` propio dentro de `tools/aceforge/env`
- instala dependencias desde `requirements_ace_macos.txt` (o `requirements_ace.txt` como fallback)
- deja `music_forge_ui.py` listo para ejecutar desde la UI
- usa `ffmpeg` del sistema para funciones que lo requieran

## Ruta esperada

```text
<studio_home>/tools/aceforge
```

## Checks de instalación

- `source/.git`
- `env`
- `source/music_forge_ui.py`

## Arranque

```bash
source env/bin/activate && cd source && python music_forge_ui.py
```

Puerto esperado:

- `5056`

## Notas

- El primer uso puede descargar modelos grandes automáticamente.
- El módulo musical queda integrado sin incluir **ComfyUI** en esta fase.
- Si faltan dependencias del sistema, revisar `scripts/mac/doctor.sh` y el log de instalación.
