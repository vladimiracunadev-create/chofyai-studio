#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

bash scripts/mac/preflight-build.sh

echo "==> Instalando dependencias (pnpm)"
pnpm install --frozen-lockfile

echo "==> Compilando frontend"
pnpm build:web

echo "==> Empaquetando .app y .dmg"
pnpm tauri:build:mac

echo

echo "Build finalizado. Revisa:"
echo "  src-tauri/target/release/bundle/macos/"
echo "  src-tauri/target/release/bundle/dmg/"
