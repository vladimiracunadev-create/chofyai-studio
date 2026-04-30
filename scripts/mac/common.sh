#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# common.sh — utilidades compartidas por los scripts de instalación.
#
# Provee:
#   • resolve_studio_home  · path resolution con fallback
#   • detect_python        · ubica un Python aceptable
#   • detect_uv            · imprime el binario uv si está disponible
#   • create_pyenv         · crea un venv usando uv (rápido) o python -m venv
#   • pip_install          · instala paquetes con uv pip o pip clásico
#   • py_install_requirements · instala -r requirements.txt
#
# Filosofía: si uv está disponible, lo usamos (10-100× más rápido y maneja la
# resolución/caché mejor). Si no, caemos a python -m venv + pip sin romper.
# ─────────────────────────────────────────────────────────────────────────────

# Asegurar que Homebrew está en el PATH cuando el script
# es lanzado desde Tauri/Rust (entorno sin shell interactivo).
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$HOME/.local/bin:$PATH"

# ─── Studio home ─────────────────────────────────────────────────────────────

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

# ─── Python toolchain ────────────────────────────────────────────────────────

# detect_python [preferred1 preferred2 ...]
# Imprime el path absoluto al primer Python que encuentre. Códig 1 si no hay.
detect_python() {
  local candidates=("$@")
  if [ ${#candidates[@]} -eq 0 ]; then
    candidates=(python3.11 python3.10 python3.12 python3)
  fi
  local cand
  for cand in "${candidates[@]}"; do
    if command -v "$cand" >/dev/null 2>&1; then
      command -v "$cand"
      return 0
    fi
  done
  return 1
}

# detect_uv
# Imprime el path absoluto a uv si está disponible. Código 1 si no.
detect_uv() {
  if [ "${CHOFYAI_DISABLE_UV:-0}" = "1" ]; then
    return 1
  fi
  if command -v uv >/dev/null 2>&1; then
    command -v uv
    return 0
  fi
  return 1
}

# log_python_manager $env_dir
# Imprime "uv" o "pip" según marcador interno (creado por create_pyenv).
log_python_manager() {
  local env_dir="$1"
  if [ -f "$env_dir/.chofyai-uv" ]; then
    echo "uv"
  else
    echo "pip"
  fi
}

# create_pyenv <env_dir> [python_bin]
# Crea (o reutiliza) un venv. Usa uv si está disponible.
# Si python_bin se omite, detect_python decide.
create_pyenv() {
  local env_dir="$1"
  local python_bin="${2:-}"
  if [ -z "$python_bin" ]; then
    python_bin="$(detect_python)" || {
      echo "ERROR: no encontré una versión usable de Python" >&2
      return 1
    }
  fi

  if [ -d "$env_dir" ] && [ -x "$env_dir/bin/python" ]; then
    echo "[uv] Reutilizando venv existente: $env_dir"
    return 0
  fi

  if uv_bin="$(detect_uv)"; then
    echo "[uv] Creando venv con uv: $env_dir (python=$python_bin)"
    "$uv_bin" venv --python "$python_bin" "$env_dir"
    : > "$env_dir/.chofyai-uv"
  else
    echo "[pip] uv no disponible, usando python -m venv: $env_dir"
    "$python_bin" -m venv "$env_dir"
  fi
}

# pip_install <env_dir> <pkg...>
# Instala paquetes en el venv. uv si disponible, pip si no.
pip_install() {
  local env_dir="$1"; shift
  if [ -f "$env_dir/.chofyai-uv" ] && uv_bin="$(detect_uv)"; then
    VIRTUAL_ENV="$env_dir" "$uv_bin" pip install "$@"
  else
    "$env_dir/bin/python" -m pip install "$@"
  fi
}

# py_install_requirements <env_dir> <requirements.txt>
py_install_requirements() {
  local env_dir="$1"
  local req="$2"
  if [ -f "$env_dir/.chofyai-uv" ] && uv_bin="$(detect_uv)"; then
    echo "[uv] Instalando requirements: $req"
    VIRTUAL_ENV="$env_dir" "$uv_bin" pip install -r "$req"
  else
    echo "[pip] Instalando requirements: $req"
    "$env_dir/bin/python" -m pip install -r "$req"
  fi
}

# pip_upgrade_base <env_dir>
# Actualiza pip/setuptools/wheel (no necesario con uv pero inocuo).
pip_upgrade_base() {
  local env_dir="$1"
  if [ -f "$env_dir/.chofyai-uv" ] && uv_bin="$(detect_uv)"; then
    # uv no necesita pip; pero algunos scripts lo invocan después. Lo dejamos disponible.
    VIRTUAL_ENV="$env_dir" "$uv_bin" pip install --upgrade pip setuptools wheel
  else
    "$env_dir/bin/python" -m pip install --upgrade pip setuptools wheel
  fi
}
