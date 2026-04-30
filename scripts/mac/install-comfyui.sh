#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SETTINGS_FILE="$REPO_ROOT/storage/state/settings.json"
DEFAULT_HOME="$HOME/ChofyAIStudio"
source "$SCRIPT_DIR/common.sh"

STUDIO_HOME="$(resolve_studio_home "$DEFAULT_HOME" "$SETTINGS_FILE")"

INSTALL_DIR="$STUDIO_HOME/tools/comfyui"
SOURCE_DIR="$INSTALL_DIR/source"
VENV_DIR="$INSTALL_DIR/venv"
LOG_DIR="$STUDIO_HOME/logs"

mkdir -p "$INSTALL_DIR" "$LOG_DIR" \
  "$INSTALL_DIR/inputs" "$INSTALL_DIR/outputs" \
  "$INSTALL_DIR/models" "$INSTALL_DIR/custom_nodes"

for bin in git python3; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: $bin no está disponible"
    exit 1
  fi
done

PYTHON_BIN="$(detect_python python3.11 python3.10 python3)" || {
  echo "ERROR: no encontré una versión usable de Python"
  exit 1
}
echo "Usando Python: $PYTHON_BIN ($($PYTHON_BIN --version))"

if uv_bin="$(detect_uv)"; then
  echo "[uv] Detectado: $uv_bin ($($uv_bin --version))"
else
  echo "[pip] uv no disponible — usando python -m venv + pip clásico"
fi

if [ ! -d "$SOURCE_DIR/.git" ]; then
  echo "Clonando ComfyUI..."
  git clone https://github.com/comfyanonymous/ComfyUI "$SOURCE_DIR"
else
  echo "Actualizando ComfyUI..."
  git -C "$SOURCE_DIR" pull --ff-only || true
fi

create_pyenv "$VENV_DIR" "$PYTHON_BIN"
pip_upgrade_base "$VENV_DIR"

# PyTorch con MPS (Apple Silicon)
echo "Instalando PyTorch (MPS para Apple Silicon)..."
pip_install "$VENV_DIR" --upgrade torch torchvision torchaudio

# Requisitos de ComfyUI
if [ -f "$SOURCE_DIR/requirements.txt" ]; then
  py_install_requirements "$VENV_DIR" "$SOURCE_DIR/requirements.txt"
fi

# Enlaces simbólicos a las carpetas externas para que ComfyUI las vea
for sub in models inputs outputs custom_nodes; do
  if [ ! -e "$SOURCE_DIR/$sub" ] || [ -L "$SOURCE_DIR/$sub" ]; then
    rm -f "$SOURCE_DIR/$sub"
    ln -s "$INSTALL_DIR/$sub" "$SOURCE_DIR/$sub"
  fi
done

echo
echo "COMFYUI_INSTALL_OK"
echo "Studio Home: $STUDIO_HOME"
echo "Tool Home: $INSTALL_DIR"
echo "Python manager: $(log_python_manager "$VENV_DIR")"
echo "Run Server: source $VENV_DIR/bin/activate && cd $SOURCE_DIR && python main.py --listen 127.0.0.1 --port 8188"
