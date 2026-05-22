# 🍎 Instalación y uso en macOS

> **Levantar ChofyAI Studio en un Mac Apple Silicon paso a paso.**

![Platform](https://img.shields.io/badge/Platform-macOS%20Apple%20Silicon-black?logo=apple&logoColor=white)
[![Última actualización](https://img.shields.io/badge/Actualizado-2026--04--30-informational)](../CHANGELOG.md)

---

## 🎯 Objetivo

Levantar ChofyAI Studio en un Mac Apple Silicon y dejar lista la base para instalar herramientas desde la UI.

---

## 📋 Requisitos del sistema

| Herramienta | Versión mínima | Cómo instalar |
|---|---|---|
| macOS | 13 Ventura | — Apple Silicon requerido |
| Xcode Command Line Tools | Cualquier reciente | `xcode-select --install` |
| Homebrew | 4.x+ | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| Node.js | 20 LTS+ | `brew install node` |
| Rust / cargo | 1.76+ | `brew install rust` |
| cmake | 3.x+ | `brew install cmake` |
| ffmpeg | Cualquier reciente | `brew install ffmpeg` |
| python@3.10 | 3.10.x | `brew install python@3.10` |
| python@3.11 | 3.11.x | `brew install python@3.11` |
| uv ⚡ | 0.x+ (opcional) | `brew install uv` — instalaciones Python 10-100× más rápidas |
| git | Cualquier reciente | Incluido con Xcode CLT |

> **Nota importante:** Los scripts de instalación de herramientas buscan los binarios en `/opt/homebrew/bin`. Si instalas con `rustup` o `pyenv` en lugar de Homebrew, asegúrate de que las rutas estén disponibles.

⚡ **uv y pip coexisten** — ninguno anula al otro. Si `uv` está disponible, los scripts lo usan (10-100× más rápido); si no, caen a `python -m venv` + `pip` clásico sin problema. Puedes desactivar `uv` puntualmente con `CHOFYAI_DISABLE_UV=1`.

---

## ⚡ Instalación de todas las dependencias de una vez

```bash
brew install node rust cmake ffmpeg python@3.10 python@3.11 uv git
```

---

## ✅ Verificación rápida

```bash
# Verifica que todo esté en orden antes de usar la app
bash scripts/mac/bootstrap.sh
bash scripts/mac/preflight-build.sh
```

---

## 💾 Disco externo no-APFS

> [!IMPORTANT]
> Si tu `studio_home` apunta a un volumen **exFAT, HFS+ o NTFS**, los wheels Python con scripts ejecutables (`numba`, `sympy`, `markupsafe`, `antlr4-python3-runtime`) **fallarán** al instalar. macOS escribe archivos sidecar `._*` (AppleDouble) que `uv` interpreta como entradas reales del wheel.

### Solución: imagen APFS sparsebundle

Crea una imagen elástica APFS dentro del disco externo. Vive en exFAT físicamente, pero internamente es APFS:

```bash
EXT="/Volumes/MiDiscoExterno"
SBUNDLE="$EXT/ChofyAIStudio.sparsebundle"

# 1. Crear (100 GB, crece on-demand, ocupa ~35 MB inicial)
hdiutil create -size 100g -fs APFS -volname ChofyAIStudio \
  -type SPARSEBUNDLE "$SBUNDLE"

# 2. Montar
hdiutil attach "$SBUNDLE" -mountpoint /Volumes/ChofyAIStudio -nobrowse

# 3. Apuntar settings al volumen montado
cat > storage/state/settings.json <<JSON
{
  "studio_home": "/Volumes/ChofyAIStudio",
  "tool_overrides": {},
  "fallback_home": null
}
JSON

# 4. Verifica
diskutil info /Volumes/ChofyAIStudio | grep "File System Personality"
# debe imprimir: APFS
```

### Operaciones comunes

| Acción | Comando |
|:---|:---|
| 🔄 Re-montar al boot/reconectar disco | `hdiutil attach "$SBUNDLE" -mountpoint /Volumes/ChofyAIStudio -nobrowse` |
| ⏏️ Desmontar antes de extraer disco | `hdiutil detach /Volumes/ChofyAIStudio` |
| 📐 Redimensionar (crecer) | `hdiutil resize -size 200g "$SBUNDLE"` |
| 📉 Redimensionar (achicar — requiere desmontar + compactar) | `hdiutil detach ...; hdiutil compact "$SBUNDLE"; hdiutil resize -size 100g "$SBUNDLE"; hdiutil attach ...` |
| 📊 Ver tamaño real ocupado | `du -sh "$SBUNDLE"` |
| 🚚 Mover a otro Mac | copia el `.sparsebundle` y monta en el destino |

> [!TIP]
> Recomendado **100 GB** para empezar. Las 5 herramientas integradas ocupan ~12 GB; el resto crece con tus modelos descargados. Compacta cada cierto tiempo si borraste mucho contenido.

### Alternativa — SSD interno

Si no necesitas el disco externo, apunta `studio_home` a `~/ChofyAIStudio` (APFS nativo, funciona out-of-the-box):

```bash
echo '{"studio_home":"~/ChofyAIStudio","tool_overrides":{},"fallback_home":null}' \
  > storage/state/settings.json
```

---

## 🚀 Instalación paso a paso

### 1️⃣ Clonar el proyecto

```bash
git clone https://github.com/vladimiracunadev-create/chofyai-studio.git
cd chofyai-studio
```

### 2️⃣ Instalar dependencias del frontend

```bash
# El .npmrc del proyecto fija el registry a npmjs.org y endurece pnpm
corepack enable && corepack prepare pnpm@10 --activate
pnpm install --frozen-lockfile
```

### 3️⃣ Definir Studio Home

Edita `storage/state/settings.json` con la ruta donde quieres que las herramientas se instalen:

```json
{
  "studio_home": "/Volumes/ORICO/ChofyIA/ChofyAIStudio"
}
```

**Recomendaciones de ruta:**

- Preferir SSD interno o volumen APFS
- Evitar exFAT (genera archivos `._*` que interfieren con git)
- Evitar rutas con espacios

### 4️⃣ Crear la estructura del Studio Home

```bash
mkdir -p /Volumes/ORICO/ChofyIA/ChofyAIStudio/{tools,logs,models,cache}
```

---

## ▶️ Ejecutar en modo desarrollo

### 🌐 Modo web (solo frontend, sin backend Rust)

```bash
export PATH="/opt/homebrew/bin:$PATH"
pnpm dev:web
# Abre: http://localhost:1420
```

> ⚠️ En modo web los botones de instalar/iniciar herramientas **no funcionan** — requieren el backend Tauri compilado.

### 🖥️ Modo escritorio completo (requiere Rust instalado)

```bash
export PATH="/opt/homebrew/bin:$PATH"
pnpm tauri:dev
```

Este modo activa el backend Rust y permite usar los botones de instalación e inicio de herramientas.

---

## 🩺 Ejecutar diagnóstico

```bash
bash scripts/mac/doctor.sh "/Volumes/ORICO/ChofyIA/ChofyAIStudio"
```

---

## 🛠️ Instalar herramientas desde terminal (alternativa a la UI)

Los scripts leen automáticamente el `studio_home` desde `storage/state/settings.json`.

```bash
# Qwen3-TTS — TTS y clonación de voz (requiere python3.10)
bash scripts/mac/install-qwen3-tts.sh

# whisper.cpp — ASR local (requiere cmake)
bash scripts/mac/install-whispercpp.sh

# FaceFusion — face swap y video (requiere ffmpeg)
bash scripts/mac/install-facefusion.sh

# AceForge — workstation musical (requiere ffmpeg)
bash scripts/mac/install-aceforge.sh

# ComfyUI — workflows de imagen (requiere python3.11/3.10)
bash scripts/mac/install-comfyui.sh
```

---

## 📦 Empaquetado macOS (.app / .dmg)

```bash
pnpm install --frozen-lockfile
pnpm package:mac
```

Salidas esperadas (target redirigido a `/tmp` por `.cargo/config.toml`):

```text
/tmp/chofyai-target/release/bundle/macos/ChofyAI Studio.app
/tmp/chofyai-target/release/bundle/dmg/ChofyAI Studio_0.5.0_aarch64.dmg
```

> Requiere Rust, Xcode CLT y todas las dependencias instaladas.

### ⚠️ Volúmenes externos no-APFS (exFAT / HFS+)

Si el repo vive en un volumen externo no-APFS, macOS crea archivos AppleDouble (`._*`) que rompen `cargo build` al ser interpretados como TOML/JSON:

```text
failed to read file '...permissions/path/autogenerated/._default.toml': stream did not contain valid UTF-8
```

Mitigación incluida:

- `.cargo/config.toml` redirige `target-dir` a `/tmp/chofyai-target` (siempre APFS).
- `bash scripts/mac/clean-appledouble.sh` borra los `._*` del árbol de fuentes.

Si la build sigue fallando, ejecuta el script de limpieza y reintenta. Lo ideal a largo plazo es reformatear el volumen externo a APFS o `mount-apfs.sh` para crear una imagen APFS dentro del externo.

### 🆓 Build sin Apple Developer ID (uso personal)

`pnpm tauri:build:app` genera un `.app` ad-hoc que funciona en este equipo:

```bash
cp -R "/tmp/chofyai-target/release/bundle/macos/ChofyAI Studio.app" /Applications/
# Primer arranque: click derecho → Abrir (Gatekeeper pedirá confirmar)
```

Para distribución pública necesitarás Apple Developer ID + notarización (ver [`docs/packaging.md`](packaging.md)).
