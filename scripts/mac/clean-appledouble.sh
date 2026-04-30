#!/usr/bin/env bash
# Borra archivos AppleDouble (._*) que macOS crea en volúmenes no-APFS.
# Estos archivos rompen `cargo build` cuando Tauri los lee como TOML/JSON.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"
COUNT=$(find . -name "._*" -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null | wc -l | tr -d ' ')
find . -name "._*" -not -path "./node_modules/*" -not -path "./.git/*" -delete 2>/dev/null || true
echo "Borrados $COUNT archivos AppleDouble en $REPO_ROOT"
