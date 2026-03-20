#!/usr/bin/env bash

read_studio_home_from_settings() {
  local settings_file="$1"

  if [ ! -f "$settings_file" ]; then
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$settings_file" <<'PYCODE'
import json
import sys

try:
    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        data = json.load(fh)
except Exception:
    print("", end="")
else:
    print(data.get("studio_home", "") or "", end="")
PYCODE
    return 0
  fi

  if command -v jq >/dev/null 2>&1; then
    jq -r '.studio_home // empty' "$settings_file"
    return 0
  fi
}

resolve_studio_home() {
  local default_home="${1:-$HOME/ChofyAIStudio}"
  local settings_file="${2:-}"
  local studio_home="${CHOFYAI_STUDIO_HOME:-${STUDIO_HOME:-}}"

  if [ -z "$studio_home" ] && [ -n "$settings_file" ]; then
    studio_home="$(read_studio_home_from_settings "$settings_file")"
  fi

  if [ -z "$studio_home" ] || [ "$studio_home" = "null" ]; then
    studio_home="$default_home"
  fi

  printf '%s\n' "$studio_home"
}
