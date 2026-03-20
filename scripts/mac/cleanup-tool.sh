#!/usr/bin/env bash
set -euo pipefail

STUDIO_HOME="${1:-}"
TOOL_ID="${2:-}"

if [[ -z "$STUDIO_HOME" || -z "$TOOL_ID" ]]; then
  echo "Uso: $0 <studio_home> <tool_id>"
  exit 1
fi

rm -rf "$STUDIO_HOME/tools/$TOOL_ID"
echo "Herramienta eliminada: $TOOL_ID"
