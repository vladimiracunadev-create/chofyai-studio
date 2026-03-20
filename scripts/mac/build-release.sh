#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

bash scripts/mac/preflight-build.sh

echo "==> Instalando dependencias NPM"
npm ci

echo "==> Compilando frontend"
npm run build:web

echo "==> Empaquetando .app y .dmg"
npm run tauri:build:mac

echo

echo "Build finalizado. Revisa:"
echo "  src-tauri/target/release/bundle/macos/"
echo "  src-tauri/target/release/bundle/dmg/"
