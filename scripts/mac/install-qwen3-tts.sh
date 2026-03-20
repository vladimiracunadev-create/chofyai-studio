#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SETTINGS_FILE="$REPO_ROOT/storage/state/settings.json"
DEFAULT_HOME="$HOME/ChofyAIStudio"
source "$SCRIPT_DIR/common.sh"

STUDIO_HOME="$(resolve_studio_home "$DEFAULT_HOME" "$SETTINGS_FILE")"

INSTALL_DIR="$STUDIO_HOME/tools/qwen3-tts"
LAUNCHER_DIR="$INSTALL_DIR/launcher"
APP_DIR="$INSTALL_DIR/app"
HF_HOME="$STUDIO_HOME/cache/huggingface"

mkdir -p "$INSTALL_DIR" "$HF_HOME" "$STUDIO_HOME/cache" "$STUDIO_HOME/models" "$STUDIO_HOME/logs"

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git no está disponible"
  exit 1
fi

if ! command -v python3.10 >/dev/null 2>&1; then
  echo "ERROR: python3.10 no está disponible. Instálalo antes de continuar."
  exit 1
fi

if [ ! -d "$LAUNCHER_DIR/.git" ]; then
  git clone https://github.com/Blizaine/Qwen3-TTS-MLX-WebUI-Enhanced.git "$LAUNCHER_DIR"
fi

if [ ! -d "$APP_DIR/.git" ]; then
  git clone https://github.com/blizaine/qwen3-tts-apple-silicon.git "$APP_DIR"
fi

python3.10 -m venv "$APP_DIR/env"
source "$APP_DIR/env/bin/activate"
python -m pip install --upgrade pip setuptools wheel
python -m pip install uv

export HF_HOME
export UV_LINK_MODE=copy
cd "$APP_DIR"

uv pip install mlx mlx-lm
uv pip install git+https://github.com/Blaizzy/mlx-audio.git
uv pip install librosa soundfile transformers sentencepiece tiktoken mlx-whisper
uv pip install huggingface_hub tqdm pyyaml numpy
uv pip install fastapi uvicorn python-multipart

python - <<'PYCODE'
from huggingface_hub import snapshot_download
snapshot_download(
    "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit",
    local_dir="models/Qwen3-TTS-12Hz-0.6B-Base-8bit"
)
snapshot_download(
    "mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit",
    local_dir="models/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit"
)
snapshot_download(
    "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-8bit",
    local_dir="models/Qwen3-TTS-12Hz-1.7B-VoiceDesign-8bit"
)
PYCODE

mkdir -p outputs/CustomVoice outputs/VoiceDesign outputs/Clones voices

echo
echo "QWEN3_TTS_INSTALL_OK"
echo "Studio Home: $STUDIO_HOME"
echo "Tool Home: $INSTALL_DIR"
echo "Launch: source \"$APP_DIR/env/bin/activate\" && cd \"$APP_DIR\" && python -m uvicorn server:app --host 127.0.0.1 --port 7860"
