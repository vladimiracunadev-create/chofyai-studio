#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SETTINGS_FILE="$REPO_ROOT/storage/state/settings.json"
DEFAULT_HOME="$HOME/ChofyAIStudio"
source "$SCRIPT_DIR/common.sh"

STUDIO_HOME="$(resolve_studio_home "$DEFAULT_HOME" "$SETTINGS_FILE")"

INSTALL_DIR="$STUDIO_HOME/tools/facefusion"
SOURCE_DIR="$INSTALL_DIR/source"
ENV_DIR="$INSTALL_DIR/env"
LOG_DIR="$STUDIO_HOME/logs"

mkdir -p "$INSTALL_DIR" "$LOG_DIR" "$INSTALL_DIR/input" "$INSTALL_DIR/output"

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git no está disponible"
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "[INFO] ffmpeg no encontrado. Intentando instalar con Homebrew..."
    brew install ffmpeg
  else
    echo "ERROR: ffmpeg no está disponible y Homebrew no está instalado"
    exit 1
  fi
fi

PYTHON_BIN="$(detect_python python3.12 python3.11 python3.10 python3)" || {
  echo "ERROR: no encontré una versión usable de Python"
  exit 1
}

if uv_bin="$(detect_uv)"; then
  echo "[uv] Detectado: $uv_bin ($($uv_bin --version))"
else
  echo "[pip] uv no disponible — usando python -m venv + pip clásico"
fi

if [ ! -d "$SOURCE_DIR/.git" ]; then
  git clone https://github.com/facefusion/facefusion "$SOURCE_DIR"
else
  git -C "$SOURCE_DIR" pull --ff-only || true
fi

create_pyenv "$ENV_DIR" "$PYTHON_BIN"
pip_upgrade_base "$ENV_DIR"

# El installer oficial de FaceFusion usa pip directamente; activamos el venv
# para que python install.py vea las dependencias correctas. Si uv creó el venv,
# los binarios siguen siendo compatibles (mismo layout que python -m venv).
# shellcheck disable=SC1091
source "$ENV_DIR/bin/activate"
cd "$SOURCE_DIR"
python install.py --onnxruntime default

echo
echo "FACEFUSION_INSTALL_OK"
echo "Studio Home: $STUDIO_HOME"
echo "Tool Home: $INSTALL_DIR"
echo "Python manager: $(log_python_manager "$ENV_DIR")"
echo "Run: source \"$ENV_DIR/bin/activate\" && cd \"$SOURCE_DIR\" && python facefusion.py run --open-browser"
