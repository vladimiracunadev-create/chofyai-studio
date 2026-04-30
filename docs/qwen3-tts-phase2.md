# 🎤 Qwen3-TTS — bitácora Fase 2

> **Bitácora histórica de la integración Fase 2.** Para el estado actual ver [`STATUS.md`](STATUS.md) y [`TOOLS.md`](TOOLS.md).

[![Fase](https://img.shields.io/badge/Fase-2%20histórica-informational)](../ROADMAP.md)


## Objetivo

Dejar la primera herramienta operativa usando un flujo controlado por manifest + script dedicado.

## Requisitos

- macOS Apple Silicon
- Python 3.10
- git
- espacio suficiente para modelos y caché
- `studio_home` apuntando a SSD interno o volumen APFS

## Flujo

1. Editar `storage/state/settings.json` con la ruta real de `studio_home`.
2. Ejecutar `scripts/mac/doctor.sh`.
3. Ejecutar `scripts/mac/install-qwen3-tts.sh`.
4. Abrir el servicio con el comando entregado al final del script.
5. Verificar que existan:
   - `tools/qwen3-tts/launcher/.git`
   - `tools/qwen3-tts/app/env`
   - `tools/qwen3-tts/app/models`

## Notas

- El detector de instalación de la UI se basa en `installed_if` del manifest.
- La UI ya puede ejecutar el instalador dedicado para Qwen3-TTS.
- La UI ya puede iniciar Qwen3-TTS y abrir la carpeta o los logs asociados.
- El objetivo de esta fase es evitar estados fantasma y desacoplar el launcher de instaladores externos genéricos.
