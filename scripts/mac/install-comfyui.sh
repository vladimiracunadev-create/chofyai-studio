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

# ComfyUI usa nombres SINGULARES (input, output) en su código fuente — los
# plurales eran un bug histórico: las carpetas externas nunca se enlazaban
# a las internas, así que los modelos descargados no aparecían en la UI.
mkdir -p "$INSTALL_DIR" "$LOG_DIR" \
  "$INSTALL_DIR/input" "$INSTALL_DIR/output" \
  "$INSTALL_DIR/models" "$INSTALL_DIR/custom_nodes" \
  "$INSTALL_DIR/models/checkpoints" "$INSTALL_DIR/models/loras" \
  "$INSTALL_DIR/models/vae" "$INSTALL_DIR/models/controlnet"

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

# Enlaces simbólicos a las carpetas externas para que ComfyUI las vea.
# CRÍTICO: ComfyUI crea estos directorios al clonar con placeholders dentro
# (`put_checkpoints_here`, etc.). Si los dejamos, los modelos descargados
# al directorio externo no aparecen en la UI. Forzamos symlink siempre,
# preservando cualquier custom_node que el usuario haya añadido.
for sub in models input output custom_nodes; do
  src="$SOURCE_DIR/$sub"
  dst="$INSTALL_DIR/$sub"
  # Si es symlink: validar destino correcto, si no rehacerlo
  if [ -L "$src" ]; then
    [ "$(readlink "$src")" = "$dst" ] && continue
    rm -f "$src"
  elif [ -d "$src" ]; then
    # Mover contenido relevante al directorio externo antes de reemplazar
    if [ "$sub" = "custom_nodes" ]; then
      # Preservar nodos del usuario, descartar placeholders
      for entry in "$src"/*; do
        [ -e "$entry" ] || continue
        base=$(basename "$entry")
        case "$base" in
          example_node.py.example|websocket_image_save.py|__pycache__|.gitkeep) ;;
          *) [ -e "$dst/$base" ] || mv "$entry" "$dst/$base" ;;
        esac
      done
    fi
    rm -rf "$src"
  fi
  ln -s "$dst" "$src"
done

echo
echo "COMFYUI_INSTALL_OK"
echo "Studio Home: $STUDIO_HOME"
echo "Tool Home: $INSTALL_DIR"
echo "Python manager: $(log_python_manager "$VENV_DIR")"
echo "Run Server: source $VENV_DIR/bin/activate && cd $SOURCE_DIR && python main.py --listen 127.0.0.1 --port 8188"
