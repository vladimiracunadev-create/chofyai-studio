#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SETTINGS_FILE="$REPO_ROOT/storage/state/settings.json"
DEFAULT_HOME="$HOME/ChofyAIStudio"
source "$SCRIPT_DIR/common.sh"

STUDIO_HOME="$(resolve_studio_home "$DEFAULT_HOME" "$SETTINGS_FILE")"

INSTALL_DIR="$STUDIO_HOME/tools/whispercpp"
SOURCE_DIR="$INSTALL_DIR/source"
MODELS_DIR="$INSTALL_DIR/models"
LOG_DIR="$STUDIO_HOME/logs"

mkdir -p "$INSTALL_DIR" "$MODELS_DIR" "$LOG_DIR" "$INSTALL_DIR/inputs" "$INSTALL_DIR/outputs"

for bin in git cmake curl; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: $bin no está disponible"
    exit 1
  fi
done

if [ ! -d "$SOURCE_DIR/.git" ]; then
  git clone https://github.com/ggml-org/whisper.cpp "$SOURCE_DIR"
else
  git -C "$SOURCE_DIR" pull --ff-only || true
fi

cd "$SOURCE_DIR"

# Detectar y limpiar build cache si fue generado en otra ruta (ej. instalación
# previa en ExFAT y luego migrada al sparsebundle APFS). CMakeCache.txt
# almacena paths absolutos y se rompe al cambiar la ubicación del source.
if [ -f build/CMakeCache.txt ]; then
  CACHED_SRC=$(awk -F= '/CMAKE_HOME_DIRECTORY:INTERNAL/{print $2}' build/CMakeCache.txt | head -1)
  if [ -n "$CACHED_SRC" ] && [ "$CACHED_SRC" != "$SOURCE_DIR" ]; then
    echo "[clean] CMakeCache apunta a $CACHED_SRC, esperado $SOURCE_DIR — limpiando build/"
    rm -rf build
  fi
fi

cmake -B build -DWHISPER_METAL=ON
cmake --build build --config Release -j 4

if [ ! -f "$MODELS_DIR/ggml-base.en.bin" ]; then
  if [ -x "$SOURCE_DIR/models/download-ggml-model.sh" ]; then
    bash "$SOURCE_DIR/models/download-ggml-model.sh" base.en "$MODELS_DIR"
  else
    curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin -o "$MODELS_DIR/ggml-base.en.bin"
  fi
fi

echo
echo "WHISPERCPP_INSTALL_OK"
echo "Studio Home: $STUDIO_HOME"
echo "Tool Home: $INSTALL_DIR"
echo "Run Server: $SOURCE_DIR/build/bin/whisper-server --host 127.0.0.1 --port 8178 -m $MODELS_DIR/ggml-base.en.bin"
