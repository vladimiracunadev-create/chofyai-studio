#!/usr/bin/env bash
set -euo pipefail

echo "==> Preflight ChofyAI Studio"

missing=0
for cmd in node pnpm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Falta: $cmd"
    missing=1
  fi
done

if ! command -v cargo >/dev/null 2>&1; then
  echo "Falta: cargo / rustup"
  missing=1
fi

if ! xcode-select -p >/dev/null 2>&1; then
  echo "Falta: Xcode Command Line Tools (xcode-select --install)"
  missing=1
fi

if [ "$missing" -ne 0 ]; then
  echo "Preflight falló. Instala los prerequisitos y vuelve a intentar."
  exit 1
fi

echo "node:  $(node -v)"
echo "pnpm:  $(pnpm -v)"
echo "cargo: $(cargo --version)"
echo "xcode: $(xcode-select -p)"

echo "OK"
