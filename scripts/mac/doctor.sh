#!/usr/bin/env bash
set -euo pipefail

TARGET_PATH="${1:-$HOME/ChofyAIStudio}"
PARENT_VOLUME="$(df "$TARGET_PATH" 2>/dev/null | tail -1 | awk '{print $1}')"
FREE_GB="$(df -g "$TARGET_PATH" 2>/dev/null | tail -1 | awk '{print $4}')"

printf '=== ChofyAI Studio Doctor ===\n'
printf 'Ruta objetivo: %s\n' "$TARGET_PATH"
printf 'Volumen: %s\n' "${PARENT_VOLUME:-desconocido}"
printf 'Espacio libre (GB): %s\n' "${FREE_GB:-desconocido}"

for bin in git python3 ffmpeg cmake; do
  if command -v "$bin" >/dev/null 2>&1; then
    printf '[OK]   %s -> %s\n' "$bin" "$(command -v "$bin")"
  else
    printf '[WARN] %s no encontrado\n' "$bin"
  fi
done

for py in python3.10 python3.11 python3.12; do
  if command -v "$py" >/dev/null 2>&1; then
    printf '[OK]   %s -> %s (%s)\n' "$py" "$(command -v "$py")" "$($py --version 2>&1 | awk '{print $2}')"
  fi
done

if command -v uv >/dev/null 2>&1; then
  printf '[OK]   uv -> %s (%s) · instalaciones Python aceleradas\n' "$(command -v uv)" "$(uv --version 2>&1 | awk '{print $2}')"
else
  printf '[INFO] uv no instalado · opcional, los scripts caen a pip clásico (brew install uv)\n'
fi

if command -v cargo >/dev/null 2>&1; then
  printf '[OK]   cargo -> %s (%s)\n' "$(command -v cargo)" "$(cargo --version | awk '{print $2}')"
else
  printf '[WARN] cargo no encontrado (necesario para Tauri)\n'
fi

printf '[INFO] Solo usar rutas APFS o SSD interno para runtimes/modelos críticos.\n'
