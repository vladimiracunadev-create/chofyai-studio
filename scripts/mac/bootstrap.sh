#!/usr/bin/env bash
set -euo pipefail

echo "[bootstrap] verificando entorno macOS..."

# Críticos: si faltan, abortamos
command -v git >/dev/null 2>&1 || { echo "  ❌ Falta git"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "  ❌ Falta python3"; exit 1; }
echo "  ✅ git ($(git --version | awk '{print $3}'))"
echo "  ✅ python3 ($(python3 --version | awk '{print $2}'))"

# Recomendados
if command -v rustc >/dev/null 2>&1; then
  echo "  ✅ Rust ($(rustc --version | awk '{print $2}'))"
else
  echo "  ⚠️  Rust no instalado — necesario para Tauri (curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh)"
fi

command -v cargo >/dev/null 2>&1 \
  && echo "  ✅ cargo ($(cargo --version | awk '{print $2}'))" \
  || echo "  ⚠️  cargo no instalado"

command -v node >/dev/null 2>&1 \
  && echo "  ✅ node ($(node --version))" \
  || echo "  ⚠️  node no instalado (brew install node)"

if command -v pnpm >/dev/null 2>&1; then
  echo "  ✅ pnpm ($(pnpm --version))"
else
  echo "  ⚠️  pnpm no instalado — actívalo con: corepack enable && corepack prepare pnpm@10 --activate"
  echo "      (este proyecto NO usa npm — ver docs/PACKAGE_MANAGER.md)"
fi

# uv: opcional pero altamente recomendado para Python tools
if command -v uv >/dev/null 2>&1; then
  echo "  ✅ uv ($(uv --version | awk '{print $2}')) — instalaciones Python aceleradas"
else
  echo "  ℹ️  uv no instalado — opcional pero recomendado:"
  echo "       brew install uv         # 10-100× más rápido que pip"
  echo "       Si no está, los scripts caen a python -m venv + pip sin problema."
fi

# Otros opcionales
command -v ffmpeg >/dev/null 2>&1 \
  && echo "  ✅ ffmpeg" \
  || echo "  ⚠️  ffmpeg no instalado — necesario para FaceFusion / AceForge"

command -v cmake >/dev/null 2>&1 \
  && echo "  ✅ cmake" \
  || echo "  ⚠️  cmake no instalado — necesario para whisper.cpp"

echo
echo "[bootstrap] entorno base verificado"
