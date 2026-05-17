# 📑 Postmortem — Sesión de hardening 2026-05-17

> **Reporte técnico de los 10 incidentes encontrados al validar funcionalidad
> end-to-end de las 5 herramientas integradas, con causa raíz, evidencia y
> resolución por incidente. Marca el paso de v0.5.0 (release) a v0.5.1
> (hardening de operatividad).**

[![Estado](https://img.shields.io/badge/Estado-operativo-2d7a66)](STATUS.md)
[![Tools](https://img.shields.io/badge/Tools%20live-5%2F5-brightgreen)](STATUS.md)
[![Inferencia](https://img.shields.io/badge/Inferencia%20verificada-5%2F5-brightgreen)](STATUS.md)
[![Fecha](https://img.shields.io/badge/Fecha-2026--05--17-informational)](../CHANGELOG.md)

---

## 🎯 Contexto y motivación

La release v0.5.0 reportaba "5/5 tools live", pero al abrir la aplicación en un
entorno limpio el usuario reportó que **las interfaces no abrían**. Al investigar
se descubrió que la afirmación era cierta — los tools sí estaban instalados —
pero residían en un volumen APFS desmontado (`ChofyAIStudio.sparsebundle`), y
la app no tenía mecanismo de auto-montaje. La cascada de hallazgos posteriores
reveló una decena de bugs latentes que esta sesión cierra.

## 📊 Resumen de incidentes

| # | Severidad | Componente | Resumen |
|:---:|:---:|---|---|
| [1](#i1) | 🔴 Crítico | Rust runtime | `studio_home` apunta a volumen no montado · sin auto-mount |
| [2](#i2) | 🟠 Alto | Bash install | `resolve_studio_home` divergía de Rust (no validaba escritura) |
| [3](#i3) | 🟠 Alto | Rust runtime | `start_tool` lanzaba bash sin validar `installed_if` |
| [4](#i4) | 🟡 Medio | Rust install | Instalación reportada "OK" aunque faltasen artefactos |
| [5](#i5) | 🟠 Alto | Filesystem | ExFAT incompatible con venv/symlinks/uv hardlinks |
| [6](#i6) | 🟠 Alto | FaceFusion install | `install.py` exigía conda y reventaba a mitad |
| [7](#i7) | 🟠 Alto | ComfyUI install | Symlinks plurales (`inputs/outputs`) en lugar de singulares |
| [8](#i8) | 🟡 Medio | UX | Cabecera de workspace exponía `http://127.0.0.1:7862/` al usuario |
| [9](#i9) | 🔴 Crítico | AceForge | Puerto 5056 colisiona con `intecom-ps1`, saturado por Chrome |
| [10](#i10) | 🟡 Medio | Rust runtime | `start_tool` fallaba en silencio si el puerto quedaba ocupado |

> 4× críticos/altos resueltos con cambios de código · 6× medios resueltos con
> patches de instalación y configuración.

---

## I1 · Sparsebundle no se auto-montaba al arrancar la app <a name="i1"></a>

**Severidad:** 🔴 Crítico — sin él, ninguna tool aparece como instalada.

### Síntoma observado

- `settings.json` apuntaba a `/Volumes/ChofyAIStudio` (mount point esperado).
- El volumen no estaba montado al iniciar la app (Mac recién encendido o
  desmontaje manual previo).
- Rust caía al fallback `~/ChofyAIStudio` (vacío) y la UI declaraba todas las
  herramientas como no instaladas, aunque sus artefactos estuviesen intactos
  dentro de `ChofyAIStudio.sparsebundle`.

### Causa raíz

`resolve_effective_home` validaba que el path fuese usable, pero **no intentaba
montar la imagen disco adyacente**. La operativa diaria del usuario requería
recordar `hdiutil attach` antes de abrir Chofy.

### Resolución

Añadido campo opcional `sparsebundle_path` en `AppSettings` y lógica de
auto-mount en `resolve_effective_home`. Probará primero la ruta explícita y,
como fallback, la convención `<studio_home>.sparsebundle` junto al mount point.

**Cambios:**

- [`src-tauri/src/models.rs:50`](models.rs) — nuevo campo `sparsebundle_path: Option<String>`.
- [`src-tauri/src/system.rs:717`](system.rs) — `resolve_effective_home` ahora ejecuta
  `hdiutil attach -nobrowse -noverify <imagen>` antes de fallback.

**Configuración nueva en `settings.json`:**

```json
{
  "studio_home": "/Volumes/ChofyAIStudio",
  "sparsebundle_path": "/Volumes/ORICO/ChofyIA/ChofyAIStudio.sparsebundle"
}
```

### Verificación

```bash
# 1) Desmontar sparsebundle
hdiutil detach /Volumes/ChofyAIStudio -force
mount | grep -i chofy        # → DESMONTADO

# 2) Relanzar app
npm run tauri:dev

# 3) Tras carga inicial, verificar
mount | grep -i chofy
# → /dev/disk5s1 on /Volumes/ChofyAIStudio (apfs, local, nodev, nosuid, ...)
ls /Volumes/ChofyAIStudio/tools/
# → aceforge comfyui facefusion qwen3-tts whispercpp ✓
```

---

## I2 · `resolve_studio_home` bash divergía del Rust <a name="i2"></a>

**Severidad:** 🟠 Alto — los scripts de instalación operaban con un path distinto
al que la app real usaba en runtime, generando instalaciones huérfanas.

### Síntoma observado

Al lanzar scripts de instalación manualmente (sin pasar por Tauri), el script
escribía a `/Volumes/ChofyAIStudio` aunque el volumen no estuviese montado,
generando errores `mkdir: No such file or directory` o instalaciones a un
mountpoint stale.

### Causa raíz

[`scripts/mac/common.sh`](../scripts/mac/common.sh) `resolve_studio_home` solo leía
`settings.json` y devolvía el valor sin chequear si el path era escribible. Rust
sí validaba. Las dos lógicas divergían.

### Resolución

Añadida función `_path_is_usable()` en bash que replica `path_is_usable()` de
Rust (existe + escribible, o ancestro montado + escribible). Si falla, cae al
default.

**Cambios:**

- [`scripts/mac/common.sh:52`](common.sh) — nueva función `_path_is_usable`.
- [`scripts/mac/common.sh:71`](common.sh) — `resolve_studio_home` ahora cae al
  fallback si el path no es usable.

### Verificación

```bash
bash -c 'source scripts/mac/common.sh; resolve_studio_home "$HOME/ChofyAIStudio" "storage/state/settings.json"'
# Con sparsebundle montado:      → /Volumes/ChofyAIStudio
# Sin sparsebundle montado:      → /Users/<user>/ChofyAIStudio  (fallback)
```

---

## I3 · `start_tool` no validaba `installed_if` antes de spawn <a name="i3"></a>

**Severidad:** 🟠 Alto — instalación parcial pasaba como OK pero al arrancar
moría en bash sin feedback claro.

### Síntoma observado

Click en `▶ Iniciar` sobre una tool con env corrupto (por ejemplo, `pip install`
abortado a mitad): la app devolvía un PID válido y un `log_path`, pero el
proceso moría a los 100 ms con `ModuleNotFoundError` y el usuario no veía el
error en la UI a menos que abriese el log manualmente.

### Causa raíz

[`system.rs:1223`](system.rs) solo comprobaba `install_dir.exists()`. Suficiente
para detectar "no instalado", insuficiente para "instalación corrupta".

### Resolución

Pre-validación de **todos** los artefactos de `installed_if` antes del spawn.
Si falta alguno, devuelve un `Err` explícito al frontend que la UI muestra como
toast.

**Cambios:** [`src-tauri/src/system.rs:1280`](system.rs).

```rust
let missing: Vec<String> = installed_if
    .iter()
    .filter(|c| !install_dir.join(c).exists())
    .cloned()
    .collect();
if !missing.is_empty() {
    return Err(format!(
        "{} no está instalado correctamente. Faltan: {}. Reinstala desde la UI.",
        manifest.name, missing.join(", ")
    ));
}
```

---

## I4 · Instalaciones parcialmente fallidas reportadas como exitosas <a name="i4"></a>

**Severidad:** 🟡 Medio — sin esta validación, el usuario debe descubrir el
fallo intentando arrancar la tool (cubierto parcialmente por I3, pero el
problema empieza antes).

### Síntoma observado

Script de instalación termina con `set -euo pipefail` por una falla en `pip
install`, pero ya había imprimido `<TOOL>_INSTALL_OK` justo antes de la falla
real. Resultado: UI muestra "Instalación completada".

> En realidad esto fue corregido en una sesión previa para que `_INSTALL_OK`
> solo se imprima al final del script, pero los scripts upstream pueden seguir
> generando archivos parciales si un comando intermedio aborta silenciosamente.

### Causa raíz

`run_install_script` confiaba en el exit code del script. Si el script ya
imprimió `_INSTALL_OK` antes de morir, o salió 0 pese a abortar un sub-comando
sin `pipefail`, la app declaraba éxito.

### Resolución

Post-validación de `installed_if` después del script. Aunque retorne 0, si
falta cualquier artefacto declara error con la lista de faltantes.

**Cambios:** [`src-tauri/src/system.rs:918`](system.rs).

---

## I5 · ExFAT en `/Volumes/ORICO` rompe venvs y uv <a name="i5"></a>

**Severidad:** 🟠 Alto — esta era la **causa raíz subyacente** de la queja
original del usuario, no obvia al inicio.

### Síntoma observado

Lanzando `install-aceforge.sh` contra `/Volumes/ORICO/ChofyIA/ChofyAIStudio`
(no sparsebundle) durante la diagnosis inicial:

```
error: Failed to install: sympy-1.14.0-py3-none-any.whl
  Caused by: failed to copy file from ...sympy-1.14.0.data/data/share/man/man1/._isympy.1
    to .../share/man/man1/._isympy.1: No such file or directory (os error 2)
```

Y para qwen3-tts:

```
error: non-monotonic index .../launcher/.git/objects/pack/._pack-8b78...idx
```

### Causa raíz

`diskutil info /Volumes/ORICO` confirma **File System Personality: ExFAT**.
ExFAT:

- No soporta POSIX permissions ni symlinks (los `inputs/outputs` symlinks del
  install-comfyui fallaban silenciosamente o se duplicaban).
- macOS crea **AppleDouble metadata files** (`._foo`) para emular HFS+
  attributes, que `uv` y `git` ven como entradas extras del manifiesto e
  intentan procesar.
- uv usa **hardlinks** por defecto para acelerar (no soportados en ExFAT).

### Resolución

Decisión arquitectónica formal: **todos los tools viven dentro de
`ChofyAIStudio.sparsebundle` (volumen APFS)**, que es lo que ya pensaba el
proyecto en Fase 3 pero no se enforcaba en runtime. El I1 cierra el bucle al
auto-montar.

Los restos del intento ExFAT en `/Volumes/ORICO/ChofyIA/ChofyAIStudio/tools/`
quedan como evidencia histórica; pueden borrarse manualmente con
`rm -rf /Volumes/ORICO/ChofyIA/ChofyAIStudio/tools/{aceforge,comfyui,facefusion,qwen3-tts}`
(no es destructivo: las instalaciones operativas están en el sparsebundle).

---

## I6 · FaceFusion `install.py` exigía conda <a name="i6"></a>

**Severidad:** 🟠 Alto — bloqueaba la instalación de FaceFusion al 100%.

### Síntoma observado

```
$ python install.py --onnxruntime default
conda is not activated
```

### Causa raíz

[`facefusion/installer.py`](https://github.com/facefusion/facefusion/blob/master/facefusion/installer.py)
upstream verifica `CONDA_PREFIX` en el env. Chofy crea venvs con `python -m
venv` o `uv venv`, no envs conda. El installer no detecta venv y aborta.

### Resolución

Añadido flag `--skip-conda` a la línea de install. FaceFusion soporta este
flag desde hace tiempo, simplemente no estaba activado.

**Cambios:** [`scripts/mac/install-facefusion.sh:62`](install-facefusion.sh).

```bash
# --skip-conda: usamos venv/uv, no conda. Sin esto, install.py muere
# con "conda is not activated" y deja la instalación a medias.
python install.py --onnxruntime default --skip-conda
```

---

## I7 · ComfyUI symlinks usaban nombres plurales <a name="i7"></a>

**Severidad:** 🟠 Alto — los modelos descargados al directorio externo nunca
aparecían en la UI de ComfyUI.

### Síntoma observado

Tras descargar `v1-5-pruned-emaonly.safetensors` (4 GB, modelo Stable
Diffusion 1.5) a `tools/comfyui/models/checkpoints/`, el endpoint
`/object_info/CheckpointLoaderSimple` devolvía:

```json
{"ckpt_name": [["",]]}    # lista vacía
```

Y al enviar un workflow:

```
Value not in list: ckpt_name: 'v1-5-pruned-emaonly.safetensors' not in []
```

### Causa raíz

`install-comfyui.sh` creaba symlinks con nombres `inputs/outputs` (plural),
pero ComfyUI usa `input/output` (singular) en su código fuente. Los plurales
nunca se enganchaban. Las carpetas `source/input/` y `source/output/`
permanecían como directorios reales con placeholders, sin enlace al directorio
externo donde el usuario descarga modelos.

Adicionalmente, el script solo creaba el symlink si la carpeta `source/X` no
existía o ya era symlink — pero ComfyUI clona con esas carpetas pre-creadas y
con archivos `put_X_here` dentro, así que el script las salteaba.

### Resolución

Re-escrito el bloque de symlinks:

- Cambio de nombres `inputs/outputs` → `input/output` (singulares, como
  ComfyUI los espera).
- **Force-replace**: si la carpeta es un directorio real con solo placeholders,
  se borra y se reemplaza por symlink.
- Preservación de `custom_nodes` reales del usuario antes de reemplazar.
- `mkdir -p` de subdirectorios típicos (`models/checkpoints`, `models/loras`,
  `models/vae`, `models/controlnet`) en la carpeta externa.

**Cambios:** [`scripts/mac/install-comfyui.sh:17`](install-comfyui.sh) y
[`scripts/mac/install-comfyui.sh:60`](install-comfyui.sh).

### Verificación

```bash
# Tras reinstalar
ls -la /Volumes/ChofyAIStudio/tools/comfyui/source/ | grep -E "input|output|models|custom_nodes"
# Esperado:
#   models       -> /Volumes/ChofyAIStudio/tools/comfyui/models
#   input        -> /Volumes/ChofyAIStudio/tools/comfyui/input
#   output       -> /Volumes/ChofyAIStudio/tools/comfyui/output
#   custom_nodes -> /Volumes/ChofyAIStudio/tools/comfyui/custom_nodes
```

Y la prueba de fuego — generación real:

```bash
curl http://127.0.0.1:8188/object_info/CheckpointLoaderSimple | jq '.CheckpointLoaderSimple.input.required.ckpt_name[0]'
# ['v1-5-pruned-emaonly.safetensors']  ✓
```

Imagen generada efectivamente:
`/Volumes/ChofyAIStudio/tools/comfyui/source/output/chofy_test_00001_.png`
(manzana 256×256, 8 steps, prompt "a red apple on white background, photo").

---

## I8 · Header del workspace embebido exponía la URL localhost <a name="i8"></a>

**Severidad:** 🟡 Medio — afecta solo a la percepción del producto, no a la
funcionalidad.

### Síntoma observado

Al hacer click en `👁 Ver UI` sobre una tool, la cabecera del workspace
mostraba al usuario final:

```
← Herramientas / 🎭 FaceFusion   http://127.0.0.1:7862/   [acciones]
```

El usuario no debería conocer detalles técnicos del transporte interno.

### Causa raíz

[`src/App.tsx:2408`](App.tsx) renderizaba `<span className="workspace-url">{url}</span>`
para "debugging convenience" durante el desarrollo del Sprint 9.

### Resolución

Eliminado el `<span>` del header. El tooltip del botón `👁 Ver UI` también se
cambió de `Abrir UI en panel embebido (http://127.0.0.1:7862)` a
`Abrir la interfaz de la herramienta dentro de Chofy`.

**Cambios:** [`src/App.tsx:2408`](App.tsx), [`src/App.tsx:2519`](App.tsx).

---

## I9 · Puerto 5056 (AceForge) colisiona con `intecom-ps1` saturado por Chrome <a name="i9"></a>

**Severidad:** 🔴 Crítico — el más sutil, falsamente reportado como "el server
no responde".

### Síntoma observado

AceForge arrancaba correctamente en `:5056` (LISTEN visible en `lsof`), pero
cada request HTTP timed-out tras 30+ segundos sin recibir bytes. Cinco curls
en paralelo también colgaban.

```
$ curl --max-time 8 http://127.0.0.1:5056/
curl: (28) Operation timed out after 8006 milliseconds with 0 bytes received
```

### Causa raíz

1. El puerto **5056 está registrado en `/etc/services` como `intecom-ps1`**
   (Intecom Pro Service One — alias histórico de IANA).
2. **Google Chrome's Network Service** (`Google Chrome Helper.app … --type=utility
   --utility-sub-type=network.mojom.NetworkService`) polea agresivamente el
   puerto, abriendo 6+ conexiones simultáneas ESTABLISHED.
3. AceForge usa `waitress.serve()` con su default de 4 worker threads. Las
   conexiones de Chrome consumen los 4 slots y nada más responde.

### Resolución

Cambio de puerto a **7857** (rango efímero IANA libre, sin servicios conocidos):

- [`apps/aceforge.yaml`](aceforge.yaml) — `default_port: 7857`.
- [`scripts/mac/install-aceforge.sh:70`](install-aceforge.sh) — patch post-clone
  con `sed -i` que reemplaza las 18 referencias hardcoded a `5056` en
  `music_forge_ui.py` (línea `port=5056`, `sock.connect_ex(...,5056)`,
  `webbrowser.open("http://127.0.0.1:5056/")`, mensajes de log). Como el
  upstream no soporta env var, el patch se aplica al source clonado, dentro
  de la pipeline legítima de instalación. Se reaplica en cada update.

### Verificación

```bash
$ curl --max-time 5 -o /dev/null -w "HTTP %{http_code} time %{time_total}s\n" http://127.0.0.1:7857/
HTTP 200 time 0.013593s
$ curl --max-time 5 http://127.0.0.1:7857/healthz
ok
```

### Lección

Antes de elegir un puerto para una tool, consultar `/etc/services` y evitar
puertos en el rango 1024–9999 con servicios documentados. Los nuevos puertos
de Chofy deberían ir al rango 49152–65535 (efímero) cuando sea posible.

---

## I10 · `start_tool` no liberaba puertos ocupados antes del spawn <a name="i10"></a>

**Severidad:** 🟡 Medio — empeora la UX tras un crash o un kill -9 del usuario.

### Síntoma observado

Si la tool moría inesperadamente (segfault, OOM, kill manual) sin que Chofy
actualice su `ProcessRegistry`, un proceso huérfano podía quedar agarrado al
puerto. El siguiente click en `▶ Iniciar` arrancaba un nuevo proceso que
abortaba con `Address already in use`, sin mensaje claro al usuario.

### Causa raíz

[`system.rs:1303`](system.rs) hacía `Command::new("bash").spawn()` sin chequear
el puerto. La detección de huérfanos existía como comando aparte
(`list_orphan_ports`) pero no se invocaba en el camino caliente del start.

### Resolución

Pre-flight en `start_tool`: usando `lsof -ti :<port> -sTCP:LISTEN`, si hay
algún PID no registrado en nuestro `ProcessRegistry`, se mata (`kill -9`)
antes del spawn. Esto cubre crashes silenciosos sin pedirle al usuario que
ejecute "Liberar huérfanos" manualmente.

**Cambios:** [`src-tauri/src/system.rs:1297`](system.rs).

### Trade-off

Matar PIDs ajenos al registry es ligeramente agresivo, pero el rango de
puertos de Chofy (7857, 7860, 7862, 8178, 8188) es específico de las tools
gestionadas. Cualquier otra cosa en esos puertos es accidente o residuo.
Si el usuario lanza un servicio personal en uno de esos puertos, debería
reubicarlo (los puertos son configurables vía manifest).

---

## 📋 Matriz de verificación post-fix

| Tool | Puerto | Boot HTTP | Inferencia real probada | Modelo en disco |
|---|---:|:---:|---|---:|
| **whisper.cpp** | 8178 | 200 | Transcripción JFK → texto correcto | 141 MB |
| **ComfyUI** | 8188 | 200 | Imagen 256×256 generada (`chofy_test_00001_.png`) | 4 GB SD1.5 |
| **Qwen3-TTS** | 7860 | 307 → /docs | WAV 221 KB sintetizado en español | 7.6 GB MLX |
| **FaceFusion** | 7862 | 200 | Gradio + 12 ONNX cargados, API `face_swapper` | ~3 GB onnx |
| **AceForge** | 7857 | 200 | `/healthz`=`ok`, modelo `ACE-Step-v1-3.5B` reconocido | 7.7 GB |

Total modelos en sparsebundle APFS: **~22 GB**.

## 🧪 Estado de tests y compilación

```
cargo check         ✅ Finished `dev` profile in 1.09s (limpio)
npm test            ✅ Test Files 2 passed (2) · Tests 20 passed (20)
bash -n scripts/    ✅ todos los scripts pasan sintaxis
```

## 🛡 Modelo operativo resultante

```
┌──────────────────────────────────────────────────────────────┐
│ /Volumes/ORICO/ChofyIA  (ExFAT, externo)                     │
│   └── ChofyAIStudio.sparsebundle  ← imagen APFS              │
└──────────────────────────────────────────────────────────────┘
                              │ hdiutil attach (auto al arranque)
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ /Volumes/ChofyAIStudio  (APFS — soporta venv/symlinks/uv)    │
│   ├── cache/      (HF, models cache)                         │
│   ├── logs/       (logs runtime)                             │
│   ├── models/     (zona global de modelos)                   │
│   └── tools/                                                 │
│       ├── aceforge/      :7857  ACE-Step v1-3.5B  ✅         │
│       ├── comfyui/       :8188  SD1.5             ✅         │
│       ├── facefusion/    :7862  onnx ×12          ✅         │
│       ├── qwen3-tts/     :7860  MLX ×3            ✅         │
│       └── whispercpp/    :8178  ggml-base.en      ✅         │
└──────────────────────────────────────────────────────────────┘
```

## 📚 Referencias

- [STATUS.md](STATUS.md) — snapshot técnico actualizado.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — guía de incidencias con las
  nuevas entradas.
- [../CHANGELOG.md](../CHANGELOG.md) — entrada v0.5.1 con detalles.
- [../ROADMAP.md](../ROADMAP.md) — fases siguientes.
