#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SETTINGS_FILE="$REPO_ROOT/storage/state/settings.json"
DEFAULT_HOME="$HOME/ChofyAIStudio"
source "$SCRIPT_DIR/common.sh"

STUDIO_HOME="$(resolve_studio_home "$DEFAULT_HOME" "$SETTINGS_FILE")"

INSTALL_DIR="$STUDIO_HOME/tools/aceforge"
SOURCE_DIR="$INSTALL_DIR/source"
ENV_DIR="$INSTALL_DIR/env"
LOG_DIR="$STUDIO_HOME/logs"
CACHE_DIR="$STUDIO_HOME/cache/aceforge"
OUTPUT_DIR="$INSTALL_DIR/output"
INPUT_DIR="$INSTALL_DIR/input"

mkdir -p "$INSTALL_DIR" "$LOG_DIR" "$CACHE_DIR" "$OUTPUT_DIR" "$INPUT_DIR"

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

PYTHON_BIN="$(detect_python python3.11 python3.10 python3.12 python3)" || {
  echo "ERROR: no encontré una versión usable de Python"
  exit 1
}

if uv_bin="$(detect_uv)"; then
  echo "[uv] Detectado: $uv_bin ($($uv_bin --version))"
else
  echo "[pip] uv no disponible — usando python -m venv + pip clásico"
fi

if [ ! -d "$SOURCE_DIR/.git" ]; then
  git clone https://github.com/audiohacking/AceForge "$SOURCE_DIR"
else
  git -C "$SOURCE_DIR" pull --ff-only || true
fi

create_pyenv "$ENV_DIR" "$PYTHON_BIN"
pip_upgrade_base "$ENV_DIR"

cd "$SOURCE_DIR"

if [ -f requirements_ace_macos.txt ]; then
  py_install_requirements "$ENV_DIR" "$SOURCE_DIR/requirements_ace_macos.txt"
elif [ -f requirements_ace.txt ]; then
  py_install_requirements "$ENV_DIR" "$SOURCE_DIR/requirements_ace.txt"
else
  echo "ERROR: no encontré requirements_ace_macos.txt ni requirements_ace.txt"
  exit 1
fi

mkdir -p "$SOURCE_DIR/training_datasets" "$OUTPUT_DIR" "$INPUT_DIR"

echo
echo "ACEFORGE_INSTALL_OK"
echo "Studio Home: $STUDIO_HOME"
echo "Tool Home: $INSTALL_DIR"
echo "Python manager: $(log_python_manager "$ENV_DIR")"
echo "Run: source \"$ENV_DIR/bin/activate\" && cd \"$SOURCE_DIR\" && python music_forge_ui.py"
echo "Nota: en el primer uso AceForge descargará modelos grandes automáticamente."
