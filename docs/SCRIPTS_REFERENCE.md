# Referencia de Scripts macOS — ChofyAI Studio

Todos los scripts operativos se encuentran en `scripts/mac/`. Se ejecutan desde la raíz del repo o desde la UI del launcher.

---

## Scripts de sistema

### `bootstrap.sh`

**Propósito**: Verifica que el entorno de desarrollo tiene los prerequisitos instalados.

**Cuándo usarlo**: Antes de hacer `npm install` por primera vez, o al configurar un nuevo Mac.

**Uso**:

```bash
bash scripts/mac/bootstrap.sh
```

**Verifica**: Rust/cargo, Node.js/npm, Xcode Command Line Tools, git.

**No modifica** el sistema; solo informa de qué falta.

---

### `preflight-build.sh`

**Propósito**: Verifica prerequisitos específicos para generar el build de producción (`.app` / `.dmg`).

**Cuándo usarlo**: Antes de ejecutar `npm run package:mac`.

**Uso**:

```bash
bash scripts/mac/preflight-build.sh
```

**Verifica**: Tauri CLI instalado, Xcode CLT, versión de Rust, `cargo-bundle` disponible.

---

### `doctor.sh`

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

### `cleanup-tool.sh`

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

## Scripts de instalación por herramienta

Todos los scripts de instalación comparten la misma estructura:

1. Reciben `STUDIO_HOME` como argumento o variable de entorno.
2. Crean el subdirectorio de la herramienta si no existe.
3. Clonan el repo / descargan binarios.
4. Crean el entorno (`venv`, compilación, etc.).
5. Registran el resultado en `$STUDIO_HOME/logs/<tool_id>.log`.

### `install-qwen3-tts.sh`

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

### `install-whispercpp.sh`

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

### `install-facefusion.sh`

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

### `install-aceforge.sh`

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

## Variables de entorno comunes

Todos los scripts de instalación respetan las siguientes variables:

| Variable | Default | Descripción |
|---|---|---|
| `STUDIO_HOME` | Leído desde `storage/state/settings.json` | Directorio raíz de trabajo. |
| `LOG_DIR` | `$STUDIO_HOME/logs` | Donde se escriben los logs de instalación. |

---

## Estructura de logs

Cada herramienta genera un log en:

```text
$STUDIO_HOME/logs/<tool_id>.log
```

Ejemplo:

```text
/Users/tu_usuario/ChofyAIStudio/logs/qwen3-tts.log
```

El log incluye stdout y stderr del script de instalación y del proceso de arranque.
