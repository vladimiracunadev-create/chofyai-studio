# Herramientas integradas

## 1. Qwen3-TTS

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

## 2. whisper.cpp

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

## 3. FaceFusion

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
- crea un `venv` local
- usa `python install.py --onnxruntime default`

## 4. AceForge

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

## 5. ComfyUI

### Estado

Manifest declarado, **no integrado operativamente** en esta fase.

### Archivo

```text
apps/comfyui.yaml
```

### Nota

Se dejó fuera a propósito para no aumentar peso ni complejidad del MVP.

