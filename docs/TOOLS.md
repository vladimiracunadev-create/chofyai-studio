# 🛠️ Herramientas integradas

> **Las 5 herramientas creativas de IA orquestadas por ChofyAI Studio.**

![Tools](https://img.shields.io/badge/Tools-5-2d7a66)
[![Status](https://img.shields.io/badge/Estado-Operativas-success)](STATUS.md)

---

## 📊 Vista rápida

| # | Herramienta | Categoría | Puerto | Runtime | Acelerable con uv ⚡ | Script |
|:-:|:---|:---|:---:|:---:|:---:|:---|
| 1 | 🎤 **Qwen3-TTS** | Voz / TTS | `7860` | `python` | ✅ | `install-qwen3-tts.sh` |
| 2 | 🎙️ **whisper.cpp** | ASR | `8178` | `binary` | — | `install-whispercpp.sh` |
| 3 | 🎬 **FaceFusion** | Video / Cara | `7862` | `python` (conda) | — | `install-facefusion.sh` |
| 4 | 🎵 **AceForge** | Música | `5056` | `python` | ✅ | `install-aceforge.sh` |
| 5 | 🖼️ **ComfyUI** | Imagen | `8188` | `python` | ✅ | `install-comfyui.sh` |

> [!TIP]
> Las 4 herramientas Python crean su `venv` con `uv` cuando está disponible y caen a `python -m venv` + `pip` si no — sin cambios para el usuario. `whisper.cpp` es nativo (CMake/Metal) y no necesita Python.

---

## 🎤 1. Qwen3-TTS

### Rol

TTS y clonación de voz con backend MLX para Apple Silicon.

### Script

```bash
scripts/mac/install-qwen3-tts.sh
```

### Checks de instalación

- `launcher/.git`
- `app/env`
- `app/models`

### Puerto esperado

- `7860`

### Observaciones

- requiere `python3.10`
- descarga modelos durante la instalación
- genera estructura propia dentro de `tools/qwen3-tts`

---

## 🎙️ 2. whisper.cpp

### Rol

ASR local y transcripción.

### Script

```bash
scripts/mac/install-whispercpp.sh
```

### Checks de instalación

- `source/.git`
- `source/build/bin/whisper-cli`
- `models/ggml-base.en.bin`

### Puerto esperado

- `8178`

### Observaciones

- compila con CMake
- usa Metal en build
- levanta `whisper-server`

---

## 🎬 3. FaceFusion

### Rol

Face swap y utilidades de video/cara.

### Script

```bash
scripts/mac/install-facefusion.sh
```

### Checks de instalación

- `source/.git`
- `env`
- `source/facefusion.py`

### Observaciones

- depende de `ffmpeg`
- **requiere `conda`** — su `install.py` aborta con `conda is not activated` si no detecta `CONDA_PREFIX`. El `env` debe ser un environment **conda**, no un `venv` plano. Ver [`TROUBLESHOOTING.md` § 11](TROUBLESHOOTING.md#-11-facefusion-conda-is-not-activated)
- usa `python install.py --onnxruntime default` para descargar pesos ONNX (~400 MB en el primer run)
- **puerto `7862`** (Gradio) — declarado vía `GRADIO_SERVER_PORT=7862` para no chocar con Qwen3-TTS (`:7860`)

---

## 🎵 4. AceForge

### Rol

Workstation musical local-first basada en ACE-Step.

### Script

```bash
scripts/mac/install-aceforge.sh
```

### Checks de instalación

- `source/.git`
- `env`
- `source/music_forge_ui.py`

### Puerto esperado

- `5056`

### Observaciones

- puede descargar modelos grandes en primer uso
- depende de `ffmpeg`
- queda desacoplado de ComfyUI

---

## 🖼️ 5. ComfyUI

### Estado

✅ **Integrada operativamente** desde la Fase 4.

### Archivos

```text
apps/comfyui.yaml
scripts/mac/install-comfyui.sh
```

### Función

Workflows visuales para generación de imagen (Stable Diffusion, Flux, etc.) con backend PyTorch sobre MPS / Apple Silicon.

### Requisitos

- Python 3.11 o 3.10
- git
- ~5 GB libres para PyTorch + dependencias (los modelos van aparte y pueden pesar muchos GB).

### Puerto esperado

- `8188`

### Observaciones

- El script crea symlinks desde `source/{models,inputs,outputs,custom_nodes}` hacia las carpetas externas en `studio_home/tools/comfyui/`. Cambiar `studio_home` o reubicar el módulo no rompe los modelos descargados.
- No descarga modelos automáticamente — cópialos a `studio_home/tools/comfyui/models/checkpoints/` (o la subcarpeta correspondiente).

