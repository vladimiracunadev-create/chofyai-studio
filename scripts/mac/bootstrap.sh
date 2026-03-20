#!/usr/bin/env bash
set -euo pipefail

echo "[bootstrap] verificando entorno macOS..."
command -v git >/dev/null 2>&1 || { echo "Falta git"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Falta python3"; exit 1; }
command -v rustc >/dev/null 2>&1 || echo "Aviso: Rust no está instalado todavía"
command -v cargo >/dev/null 2>&1 || echo "Aviso: Cargo no está instalado todavía"
command -v npm >/dev/null 2>&1 || echo "Aviso: npm no está instalado todavía"

echo "[bootstrap] entorno base verificado"
