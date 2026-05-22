# 📜 Referencia de Scripts macOS

> **Catálogo completo de los scripts Bash que orquestan instalación, diagnóstico y limpieza.**

[![Bash](https://img.shields.io/badge/Bash-5+-4EAA25?logo=gnubash&logoColor=white)](https://www.gnu.org/software/bash/)
![Platform](https://img.shields.io/badge/Platform-macOS%20Apple%20Silicon-black?logo=apple&logoColor=white)

Todos los scripts operativos se encuentran en `scripts/mac/`. Se ejecutan desde la raíz del repo o desde la UI del launcher.

---

## 🧰 `common.sh` — helpers compartidos

Todos los scripts hacen `source "$SCRIPT_DIR/common.sh"` para reutilizar funciones de path resolution y manejo de Python con soporte transparente de **uv**.

| Función | Propósito |
|:---|:---|
| `resolve_studio_home <default> <settings>` | Resuelve `studio_home` (env > settings.json > default) |
| `detect_python [candidates…]` | Devuelve el primer Python disponible |
| `detect_uv` | Devuelve el path de `uv` si está instalado |
| `create_pyenv <env_dir> [python]` | Crea venv usando `uv venv` si está disponible, si no `python -m venv` |
| `pip_install <env_dir> <pkg…>` | Instala paquetes con `uv pip install` o `pip install` |
| `py_install_requirements <env_dir> <req.txt>` | Instala desde requirements |
| `pip_upgrade_base <env_dir>` | Actualiza pip/setuptools/wheel |
| `log_python_manager <env_dir>` | Imprime `"uv"` o `"pip"` según el venv |

> [!TIP]
> **uv y pip son intercambiables.** El helper detecta `uv` y lo usa por velocidad; si no existe, cae a pip sin cambiar de comportamiento. Para forzar pip clásico: `export CHOFYAI_DISABLE_UV=1` antes de invocar el script.

---

## 🩺 Scripts de sistema

### 🚀 `bootstrap.sh`

**Propósito**: Verifica que el entorno de desarrollo tiene los prerequisitos instalados.

**Cuándo usarlo**: Antes de hacer `pnpm install` por primera vez, o al configurar un nuevo Mac.

**Uso**:

```bash
bash scripts/mac/bootstrap.sh
```

**Verifica**: Rust/cargo, Node.js/pnpm, Xcode Command Line Tools, git.

**No modifica** el sistema; solo informa de qué falta.

---

### ✈️ `preflight-build.sh`

**Propósito**: Verifica prerequisitos específicos para generar el build de producción (`.app` / `.dmg`).

**Cuándo usarlo**: Antes de ejecutar `pnpm package:mac`.

**Uso**:

```bash
bash scripts/mac/preflight-build.sh
```

**Verifica**: Tauri CLI instalado, Xcode CLT, versión de Rust, `cargo-bundle` disponible.

---

### 🩺 `doctor.sh`

**Propósito**: Diagnóstico del `studio_home` y de las herramientas instaladas. Muestra estado real de cada herramienta según sus `installed_if`.

**Cuándo usarlo**: Cuando algo no funciona y quieres un informe rápido del estado.

**Uso**:

```bash
bash scripts/mac/doctor.sh "/ruta/a/tu/studio_home"
```

**Argumentos**:

| Argumento | Tipo | Descripción |
|---|---|---|
| `$1` | `string` (obligatorio) | Ruta absoluta al `studio_home`. |

**Salida**: Listado de herramientas con estado `[ OK ]` / `[ MISSING ]` / `[ PARTIAL ]`.

---

### 🧹 `cleanup-tool.sh`

**Propósito**: Elimina la instalación de una herramienta específica dentro de `studio_home`, manteniendo los logs.

**Cuándo usarlo**: Para reintentar una instalación fallida o liberar espacio.

**Uso**:

```bash
bash scripts/mac/cleanup-tool.sh "/ruta/studio_home" "tool_id"
```

**Argumentos**:

| Argumento | Tipo | Descripción |
|---|---|---|
| `$1` | `string` (obligatorio) | Ruta absoluta al `studio_home`. |
| `$2` | `string` (obligatorio) | `id` de la herramienta tal como aparece en el manifest YAML. |

**Ejemplo**:

```bash
bash scripts/mac/cleanup-tool.sh "/Users/tu_usuario/ChofyAIStudio" "whispercpp"
```

> **Cuidado**: esta operación elimina el directorio de la herramienta. Los modelos descargados también se eliminan si están dentro del `studio_home_subdir`.

---

## 🛠️ Scripts de instalación por herramienta

Todos los scripts de instalación comparten la misma estructura:

1. Reciben `STUDIO_HOME` como argumento o variable de entorno.
2. Crean el subdirectorio de la herramienta si no existe.
3. Clonan el repo / descargan binarios.
4. Crean el entorno (`venv`, compilación, etc.).
5. Registran el resultado en `$STUDIO_HOME/logs/<tool_id>.log`.

### 🎤 `install-qwen3-tts.sh`

| Campo | Valor |
|---|---|
| **Herramienta** | Qwen3-TTS |
| **Categoría** | voice |
| **Runtime** | python |
| **Directorio** | `tools/qwen3-tts/` |
| **Puerto** | `7860` |
| **Requiere** | Python 3.10, git, acceso a internet |

```bash
bash scripts/mac/install-qwen3-tts.sh
```

**Qué instala**: Clona `Qwen3-TTS-MLX-WebUI-Enhanced` + `qwen3-tts-apple-silicon`, crea `venv` con Python 3.10, descarga modelos `mlx-community`.

**Tiempo estimado**: 5-15 min (dependiendo de la descarga de modelos, ~4 GB).

---

### 🎙️ `install-whispercpp.sh`

| Campo | Valor |
|---|---|
| **Herramienta** | whisper.cpp |
| **Categoría** | voice / ASR |
| **Runtime** | binary |
| **Directorio** | `tools/whispercpp/` |
| **Puerto** | `8178` |
| **Requiere** | CMake, Xcode CLT, git |

```bash
bash scripts/mac/install-whispercpp.sh
```

**Qué instala**: Clona `ggerganov/whisper.cpp`, compila con CMake y Metal habilitado, descarga el modelo `ggml-base.en.bin` (~150 MB).

**Tiempo estimado**: 3-8 min (compilación incluida).

---

### 🎬 `install-facefusion.sh`

| Campo | Valor |
|---|---|
| **Herramienta** | FaceFusion |
| **Categoría** | video |
| **Runtime** | python |
| **Directorio** | `tools/facefusion/` |
| **Puerto** | — |
| **Requiere** | Python 3.10+, ffmpeg, git |

```bash
bash scripts/mac/install-facefusion.sh
```

**Qué instala**: Clona el repositorio de FaceFusion, crea `venv`, ejecuta `python install.py --onnxruntime default`.

**Tiempo estimado**: 5-10 min.

---

### 🎵 `install-aceforge.sh`

| Campo | Valor |
|---|---|
| **Herramienta** | AceForge |
| **Categoría** | music |
| **Runtime** | python |
| **Directorio** | `tools/aceforge/` |
| **Puerto** | `5056` |
| **Requiere** | Python 3.10+, ffmpeg, git |

```bash
bash scripts/mac/install-aceforge.sh
```

**Qué instala**: Clona el repositorio ACE-Step/AceForge, crea `venv`, instala dependencias. Los modelos se descargan en el primer arranque.

**Tiempo estimado**: 5-10 min (+ descarga de modelos en primer uso, ~varios GB).

---

### 🖼️ `install-comfyui.sh`

| Campo | Valor |
|---|---|
| **Herramienta** | ComfyUI |
| **Categoría** | image |
| **Runtime** | python |
| **Directorio** | `tools/comfyui/` |
| **Puerto** | `8188` |
| **Requiere** | Python 3.11/3.10, git |

```bash
bash scripts/mac/install-comfyui.sh
```

**Qué instala**: clona ComfyUI, crea `venv`, instala PyTorch con MPS (Apple Silicon) y los `requirements.txt`. Crea symlinks `source/{models,inputs,outputs,custom_nodes}` hacia las carpetas externas para sobrevivir a reubicaciones.

**Tiempo estimado**: 5-15 min (sin modelos; estos se copian aparte a `models/checkpoints/`).

---

### 🧼 `clean-appledouble.sh`

| Campo | Valor |
|---|---|
| **Función** | Borra archivos `._*` (AppleDouble) del repo |
| **Cuándo usarlo** | Antes de `cargo build` cuando el repo vive en exFAT/HFS+ |

```bash
bash scripts/mac/clean-appledouble.sh
```

**Por qué**: macOS crea archivos AppleDouble en volúmenes no-APFS. Tauri intenta leerlos como TOML/JSON y la build falla con `stream did not contain valid UTF-8`. El repo ya redirige `target-dir` a `/tmp/chofyai-target` vía `.cargo/config.toml`; este script ataca el problema en el árbol de fuentes (capabilities, schemas, etc.).

---

## ⚙️ Variables de entorno comunes

Todos los scripts de instalación respetan las siguientes variables:

| Variable | Default | Descripción |
|:---|:---|:---|
| `CHOFYAI_STUDIO_HOME` | Leído desde `storage/state/settings.json` (o app data dir si está empaquetada) | Directorio raíz efectivo (post-fallback). Tauri la inyecta antes de spawnar cada script. |
| `STUDIO_HOME` | Alias compatible con `CHOFYAI_STUDIO_HOME` | Honrado por `common.sh::resolve_studio_home`. |
| `LOG_DIR` | `$STUDIO_HOME/logs` | Donde se escriben los logs de instalación. |
| `CHOFYAI_DISABLE_UV` | `0` | Si vale `1`, fuerza `python -m venv` + `pip` aunque `uv` esté instalado. |

---

## 📋 Estructura de logs

Cada herramienta genera un log en:

```text
$STUDIO_HOME/logs/<tool_id>.log
```

Ejemplo:

```text
/Users/tu_usuario/ChofyAIStudio/logs/qwen3-tts.log
```

El log incluye stdout y stderr del script de instalación y del proceso de arranque.
