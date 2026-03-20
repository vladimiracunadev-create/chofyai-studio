#!/usr/bin/env bash
set -euo pipefail

TARGET_PATH="${1:-$HOME/ChofyAIStudio}"
PARENT_VOLUME="$(df "$TARGET_PATH" 2>/dev/null | tail -1 | awk '{print $1}')"
FREE_GB="$(df -g "$TARGET_PATH" 2>/dev/null | tail -1 | awk '{print $4}')"

printf '=== ChofyAI Studio Doctor ===\n'
printf 'Ruta objetivo: %s\n' "$TARGET_PATH"
printf 'Volumen: %s\n' "${PARENT_VOLUME:-desconocido}"
printf 'Espacio libre (GB): %s\n' "${FREE_GB:-desconocido}"

for bin in git python3 ffmpeg; do
  if command -v "$bin" >/dev/null 2>&1; then
    printf '[OK] %s -> %s\n' "$bin" "$(command -v "$bin")"
  else
    printf '[WARN] %s no encontrado\n' "$bin"
  fi
done

if command -v python3.10 >/dev/null 2>&1; then
  printf '[OK] python3.10 -> %s\n' "$(command -v python3.10)"
else
  printf '[WARN] python3.10 no encontrado\n'
fi

printf '[INFO] Solo usar rutas APFS o SSD interno para runtimes/modelos críticos.\n'
