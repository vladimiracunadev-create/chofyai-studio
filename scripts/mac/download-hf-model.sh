#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# download-hf-model.sh — descarga un repo de Hugging Face Hub a un directorio.
#
# Uso:
#   download-hf-model.sh <repo_id> <target_dir>
#
# Ejemplos:
#   download-hf-model.sh mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit \
#     /Volumes/ChofyAIStudio/tools/qwen3-tts/models/Qwen3-TTS-12Hz-0.6B-Base-8bit
#
# Estrategia:
#   1. huggingface-cli download (más rápido, paralelo, resumible) si está
#   2. fallback a python -c "from huggingface_hub import snapshot_download"
#
# Salida: imprime una línea por archivo bajado a stdout.
#   "[hf] descargando <repo_id> → <target>"
#   "[hf] OK" al terminar.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

REPO="${1:-}"
TARGET="${2:-}"

if [ -z "$REPO" ] || [ -z "$TARGET" ]; then
  echo "ERROR: faltan argumentos. Uso: $0 <repo_id> <target_dir>" >&2
  exit 2
fi

mkdir -p "$TARGET"

echo "[hf] descargando $REPO → $TARGET"

if command -v huggingface-cli >/dev/null 2>&1; then
  echo "[hf] usando huggingface-cli"
  huggingface-cli download "$REPO" --local-dir "$TARGET" --local-dir-use-symlinks False
elif PY="$(detect_python 2>/dev/null)"; then
  echo "[hf] huggingface-cli no encontrado, usando python ($PY)"
  if ! "$PY" -c "import huggingface_hub" 2>/dev/null; then
    echo "[hf] instalando huggingface_hub en el python detectado"
    "$PY" -m pip install --quiet --user huggingface_hub
  fi
  "$PY" - "$REPO" "$TARGET" <<'PYCODE'
import sys
from huggingface_hub import snapshot_download

repo, target = sys.argv[1], sys.argv[2]
snapshot_download(
    repo_id=repo,
    local_dir=target,
    local_dir_use_symlinks=False,
)
PYCODE
else
  echo "ERROR: ni huggingface-cli ni python disponibles" >&2
  exit 3
fi

# Tamaño total post-descarga
if command -v du >/dev/null 2>&1; then
  SIZE="$(du -sh "$TARGET" 2>/dev/null | awk '{print $1}')"
  echo "[hf] tamaño total en disco: $SIZE"
fi

echo "[hf] OK"
