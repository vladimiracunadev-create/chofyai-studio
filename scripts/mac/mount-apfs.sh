#!/usr/bin/env bash
set -euo pipefail

IMG_PATH="${1:-}"
MOUNT_PATH="${2:-/Volumes/ChofyAIStudio}"

if [[ -z "$IMG_PATH" ]]; then
  echo "Uso: $0 /ruta/a/imagen.sparsebundle [/Volumes/MountName]"
  exit 1
fi

hdiutil attach "$IMG_PATH" -mountpoint "$MOUNT_PATH" -nobrowse
mkdir -p "$MOUNT_PATH/studio_home"
echo "Montado en: $MOUNT_PATH"
