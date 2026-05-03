# 📋 Changelog

> **Historial completo de versiones de ChofyAI Studio.**

[![Keep a Changelog](https://img.shields.io/badge/Keep%20a%20Changelog-1.0.0-orange?logo=keepachangelog&logoColor=white)](https://keepachangelog.com/en/1.0.0/)
[![SemVer](https://img.shields.io/badge/SemVer-2.0.0-blue)](https://semver.org/spec/v2.0.0.html)

Formato basado en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) · Versionado siguiendo [SemVer](https://semver.org/spec/v2.0.0.html).

---

## 🚧 [Unreleased]

### 🛡 Added (Sprint 5 — seguridad portable, huérfanos, crash log)

- **Workflow `security.yml` portable**: nuevo job dedicado de seguridad en CI con 5 checks paralelos:
  - 🔐 **TruffleHog** secret scan (verified only) en push/PR + cron lunes 06:00 UTC.
  - 📦 **npm audit** que falla PRs con `high+critical` (auto-detecta `package-lock.json`).
  - 🦀 **cargo audit** que cruza todos los `Cargo.lock` del repo contra RustSec advisories.
  - 🔬 **CodeQL** análisis SAST con queries `security-extended,security-and-quality` para JS/TS.
  - 📌 **Pin actions check** que avisa si alguna `uses:` no está pinneada a SHA.
  - Habilitado `workflow_call:` para invocación desde otros repos del ecosistema (`trihorn-chat`, etc.).
  - TruffleHog removido de `ci.yml` (consolidado en `security.yml`).
- **`docs/SECURITY_WORKFLOW.md`**: guía portable de ~250 líneas con instrucciones de drop-in para repos npm/pnpm/cargo/python, ejemplo de `workflow_call`, checklist "secure-by-default", recetas de pre-commit hooks y mejoras opcionales por capas (SBOM, container scan, license check).
- **`.github/dependabot.yml`**: PRs semanales agrupados (`@tauri-apps/*`, React, Vitest, etc.) para npm + cargo + github-actions.
- **`SECURITY.md`** actualizado: nueva sección "Workflow de seguridad automatizado" con tabla de cobertura, link al doc portable, comandos de auditoría local actualizados.

### 👻 Added (Sprint 5 — detección y resolución de procesos huérfanos)

- **Comando Rust `list_orphan_ports(app, registry)`**: para cada manifest con `default_port`, ejecuta `lsof -nP -iTCP:<port> -sTCP:LISTEN -Fpc` y compara los PIDs encontrados contra el `ProcessRegistry`. Devuelve `Vec<OrphanPort { tool_id, tool_name, port, pid, command }>`.
- **`adopt_orphan(tool_id, pid)`**: añade un PID huérfano al registry tras validar `pid_is_alive`. Persiste a `processes.json`.
- **`kill_orphan(pid)`**: envía SIGTERM al proceso sin adoptarlo.
- **UI `OrphanBanner`**: tarjeta destacada amarilla en el dashboard cuando se detectan huérfanos. Auto-escaneo cada 60 s. Cada fila tiene botones `👋 Adoptar` y `🛑 Matar` con confirmación.

### 💥 Added (Sprint 5 — crash log persistente)

- **`append_crash_log(message)`** y **`read_crash_log()`** en Rust: append-only log en `<studio_home>/storage/state/crash.log` con timestamp Unix.
- **`AppErrorBoundary` extendido**: en `componentDidCatch`, además de toast y `console.error`, persiste el error + componentStack al crash log (truncado a 4 KB).
- **Documentación**: nueva entrada §15 en `TROUBLESHOOTING.md` explicando cómo recuperarse del crash y leer el histórico desde DevTools.

### 📚 Docs (Sprint 5 — barrido completo)

- **`ROADMAP.md`**: Fase 4 actualizada con sparsebundle como completado, **Fase 5 reescrita** con los 5 sprints aplicados (8/11 items), Fase 2 marcada como completa (huérfanos + cleanup ahora implementados).
- **`docs/STATUS.md`**: bullet list completa de funciones nuevas por sprint, tabla de comandos Tauri ampliada con los 8 nuevos.
- **`docs/TROUBLESHOOTING.md`**: §14 (huérfanos) + §15 (crash log).
- **`README.md`**: sección Seguridad ampliada con link al workflow + comandos locales.

### ✨ Added (Sprint 4 — comandos visibles, atajos, tema claro, pre-install check, CI con tests)

- **Atajos de teclado expandidos**: `⌘K` (paleta), `⌘,` (Settings), `⌘/` (Help), `⌘R` (refrescar), `⌘L` (logs del último tool), `⌘B` (toggle tema), `Esc` (cierra modal/panel actual). Listener global con detección de `metaKey`/`ctrlKey`.
- **Help panel `⌘/`**: nuevo modal `HelpPanel` con catálogo agrupado de todos los atajos disponibles. Render con `<kbd>` styled.
- **Hints de atajos visibles en sidebar**: cada nav-item relevante muestra el shortcut (`⌘,` para Settings, `⌘K` para Comandos, `⌘/` para Atajos) en un `<kbd>` pequeño alineado a la derecha.
- **Toggle de tema** dark/light/system con persistencia en `localStorage` (`chofyai_theme`) y respeto a `prefers-color-scheme` cuando `system`. Aplicado vía `data-theme` en `:root`. Override CSS específico para sidebar, cards, modales, kbds, toasts, statusbar, input/log surfaces.
- **Pre-install check** (`PreInstallCheck`): modal de confirmación antes de instalar mostrando estimación de tamaño por tool (ranges 250 MB–8 GB), espacio libre detectado del studio_home, comparación con buffer 1.2× y bloqueo del botón si no alcanza.
- **`lastTouchedToolId`** rastreado en handlers (Install/Start/Logs) para que `⌘L` abra el log del último tool tocado.

### 🤖 Added (Sprint 4 — CI con tests)

- **GitHub Actions**: dos jobs nuevos en `.github/workflows/ci.yml`:
  - `test-frontend`: `npm ci && npm test` (Vitest 13 tests).
  - `test-rust`: instala deps GTK/WebKit/AppIndicator en Ubuntu, cachea `cargo` con `Swatinem/rust-cache@v2`, ejecuta `cargo test --no-default-features` (4 tests).
- Ambos disparados solo si `src/**` o `src-tauri/**` cambia (path-filter).

### 🎛 Added (Sprint 3 — paleta ⌘K, Settings UI, gestión de modelos, tests baseline)

- **Command palette `⌘K` / `Ctrl+K`** (`CommandPalette`): modal con search, navegación con flechas, ejecución con `↵`. Auto-genera comandos por tool: instalar / iniciar / detener / reiniciar / ver UI / ver logs / ver modelos / abrir carpeta + comandos globales (refrescar, abrir settings, abrir tour, limpiar cola). Atajo global registrado en `window`.
- **Settings modal completo** (`SettingsModal`): selector visual de volúmenes (chips con espacio libre y permisos, deshabilitados si solo lectura), input de `studio_home` editable, lista de overrides activos con botón `↺ Reset`, sección de diagnóstico con OS/arch/versión y aviso de fallback. Sustituye la edición manual de `settings.json` para los cambios comunes.
- **Models panel** (`ModelsPanel`): nuevo panel inline por tool que escanea `<install_dir>/models/` recursivo (depth 3), lista archivos ordenados por tamaño descendente, muestra total agregado y permite borrar individual con confirmación.
- **Comandos Rust nuevos**: `list_tool_models(tool_id)` con filtrado de `._*`/`.DS_Store`, ordenado por tamaño. `delete_tool_model(tool_id, relative_path)` con guarda anti-traversal vía canonicalización (rechaza `..`, valida que el path resuelto esté dentro del directorio `models/` real).
- **Botón `📦` en cada tarjeta** de tool instalada → abre/cierra el ModelsPanel.
- **Botones nuevos en sidebar**: `⚙️ Settings` y `⌘K Comandos` (además del `👋 Tour` previo).

### 🧪 Added (Sprint 3 — tests baseline)

- **Vitest** + scripts npm (`test`, `test:watch`) + `jsdom` para futuros tests de DOM. **13 tests** unitarios sobre `src/utils.ts`: `fmtBytes` (incluyendo edge cases), `fmtElapsed`, `parseInstallLine` (todas las fases: clonado, receiving, deltas, venv, modelo, deps Python, cmake, linking, INSTALL_OK, ANSI strip, preservación de prev).
- **Refactor `src/utils.ts`**: extraídos `fmtBytes`, `fmtElapsed`, `parseInstallLine`, tipo `LineParse` desde `App.tsx` para que sean testables sin React.
- **Cargo tests** en `src-tauri/src/system.rs`: **4 tests** (`pid_alive_for_self_is_true`, `pid_alive_for_zero_is_false`, `delete_model_rejects_path_traversal`, `read_disk_usage_returns_two_values`).
- **Script `npm run test:rust`** que dispara `cargo test` con `CARGO_TARGET_DIR=/tmp/chofyai-target` (consistente con el target redirect del proyecto).

### 🚀 Added (Sprint 2 — onboarding, update checker, notificaciones nativas)

- **First-run wizard de 4 pasos** (`Onboarding`): bienvenida → selector de `studio_home` con detección heurística de volumen externo y aviso para crear sparsebundle APFS si aplica → instalación opcional de whisper.cpp con un click → confirmación final con tips de UI. Persistencia en `localStorage` (`chofyai_onboarding_done`). Botón "👋 Tour" en la sidebar para reabrir cuando quieras.
- **Update checker** (`UpdateChecker`): banner flotante arriba-derecha que consulta la API de GitHub Releases (`/repos/.../releases/latest`) al arrancar. Compara con `APP_VERSION` y, si hay versión más nueva, muestra link directo al release. Silent fail si offline o sin releases publicados. Sin telemetría.
- **Notificaciones nativas macOS**: nuevo comando Rust `notify_macos(title, body)` que invoca `osascript display notification` (sin nuevo plugin Tauri ni dependencia adicional). Hooked en eventos `install-done` (éxito y error) — ahora aunque la app esté en segundo plano te enteras cuando termina una instalación. Helper `notifyNative()` en frontend hace silent fail fuera de Tauri.
- **Banner CSS** y **modal del wizard** con animaciones `fadeIn` + `slideInUp`, dot-progress 4 pasos, validación de input.

### 🛡 Added (Sprint 1 — toasts, persistencia, logs in-app, empty state, health retry)

- **Sistema de toasts global** (`Toaster` + helper `notify()` + wrapper de `tauriInvoke`): toda llamada a comando Tauri que falla emite un toast con título y mensaje. Toasts por kind (`info`/`success`/`warn`/`error`) con auto-dismiss (4–8 s) y botón cierre. Animación slide-in.
- **`AppErrorBoundary`** envuelve toda la UI: si un componente React crasheaba antes era pantalla en blanco; ahora muestra fallback con stack y botón `🔄 Recargar`. También dispara un toast.
- **Persistencia de procesos entre reinicios** (Rust): nuevo `processes.json` en `storage/state/` se escribe en cada `start_tool` / `stop_tool` / `restart_tool` / health-fail. En el `setup` de Tauri, `restore_registry` carga el archivo y filtra PIDs con `kill -0` antes de adoptarlos al `ProcessRegistry`. Cuando se cierra y reabre la app, los servidores que siguen vivos vuelven a aparecer como activos.
- **Comando Rust `list_running_pids`** + adopción al primer load de la UI: si hay procesos restaurados se notifica con un toast info.
- **Comando Rust `read_tool_log(tool_id, kind, last_lines)`** que lee `<studio_home>/logs/<tool>-{install,run}.log` y devuelve las últimas N líneas.
- **`LogsViewer` panel inline**: el botón `📋` ahora abre un panel embebido en la ventana principal (no más TextEdit) con: selector `install|run`, input de filtro por substring, checkbox `auto` (refresh cada 2 s) y botón refresh manual. Mini-terminal de 50vh con scroll automático al final.
- **Health retry tolerante**: nuevo estado `starting` por tool. Cuando inicias un servidor (Start/Restart) entra en `starting` y durante **60 s** el probe NO lo declara muerto aunque el puerto aún no responda. `HealthDot` pinta amarillo pulsante en starting, verde glow en activo, gris en detenido.
- **Empty state con CTA**: si las 5 tools están sin instalar, se muestra una tarjeta destacada con `🚀` y dos botones: "⚡ Instalar whisper.cpp ahora" (la más rápida y ligera) y "📦 Encolar las 5 herramientas".
- **Notificaciones de éxito**: Start/Stop/Restart emiten toast con el mensaje del backend.

### ☁️ Added (docs — migración a AWS)

- **Suite `docs/cloud/`** con 6 documentos (~1 800 líneas) que cubren el plan completo de migración a AWS: visión global ([`AWS_MIGRATION.md`](docs/cloud/AWS_MIGRATION.md)), arquitectura objetivo con diagramas Mermaid ([`AWS_ARCHITECTURE.md`](docs/cloud/AWS_ARCHITECTURE.md)), mapa de 22 servicios ([`AWS_SERVICES.md`](docs/cloud/AWS_SERVICES.md)), análisis de costos por escenario ([`AWS_COSTS.md`](docs/cloud/AWS_COSTS.md)), modelo de seguridad y hardening ([`AWS_SECURITY.md`](docs/cloud/AWS_SECURITY.md)), guía hands-on con Terraform ([`AWS_STEP_BY_STEP.md`](docs/cloud/AWS_STEP_BY_STEP.md)).
- **README principal** con sección dedicada y enlace en la tabla "Por dónde empezar".

### 💎 Added (Fase 5 — UX profesional + sparsebundle APFS)

- **Cola de instalación profesional**: parser inteligente que extrae fase (`Clonando` / `Compilando` / `Descargando modelo` / `Instalando dependencias Python`), porcentaje, velocidad de descarga (MB/s) y tiempo transcurrido en vivo desde los logs `cmake`, `git`, `curl` y `uv`. Render con barra de progreso animada (gradiente violeta→verde), badges por fase, contador `⏱ MM:SS` y mini-terminal con las últimas 8 líneas (estilo `pre` monoespacio).
- **Auto-refresh de tools cada 8 s** — la UI detecta instalaciones lanzadas desde CLI sin necesidad de relanzar la app.
- **Health probe de TODAS las tools con puerto** (no solo `runningIds`) — el `🟢` aparece para servicios externos arrancados manualmente o por scripts.
- **Botón `🔄 Refrescar estado`** en la sección Herramientas para forzar `list_tools` + health check inmediato.
- **Vista embebida `<iframe>` en la ventana principal**: nuevo botón `👁 Ver UI` en cada tool con server activo abre un panel inline cargando `http://127.0.0.1:<port>/` — todo dentro de ChofyAI Studio, sin saltar al navegador. Botón `🔄 Reload` por iframe.
- **Bottom bar arreglado**: `.stat-bar` cambia de `<span>` inline (que ignoraba `width: 60px`) a `inline-block` 90 px con `display: block` en `.stat-bar-fill` → la barra ahora pinta proporción real de CPU/RAM/Disco con `box-shadow` glow.
- **Métrica "App"** en lugar de "Uptime" del sistema: cuenta el tiempo transcurrido desde que la sesión actual de ChofyAI Studio abrió (timestamp en JS, no `kern.boottime`). Se refresca cada 30 s.

### 🐛 Fixed (Fase 5)

- **exFAT incompatible con wheels Python**: discos formateados exFAT/HFS+ generan archivos AppleDouble (`._*`) que rompen la extracción de wheels (`numba`, `sympy`, `antlr4-python3-runtime`) por `uv`. Documentado y resuelto vía **imagen APFS sparsebundle** (`hdiutil create -size Ng -fs APFS -volname ChofyAIStudio -type SPARSEBUNDLE`) montada desde el disco externo. La imagen es elástica (crece on-demand), portátil entre Macs y respeta semántica APFS para todo el contenido. Ver [`docs/INSTALL_MAC.md`](docs/INSTALL_MAC.md#-disco-externo-no-apfs).
- **FaceFusion requiere conda**: su `install.py` aborta con `conda is not activated` si no detecta `CONDA_PREFIX`. El script `install-facefusion.sh` ahora documenta el requisito y se incluye runbook para crear un env conda en la ruta esperada (`<studio_home>/tools/facefusion/env`). Ver [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md#-11-facefusion-conda-is-not-activated).
- **Colisión de puerto Qwen3-TTS / FaceFusion**: ambos usaban `:7860` por defecto. `apps/facefusion.yaml` ahora declara `default_port: 7862` y el `run.command` exporta `GRADIO_SERVER_PORT=7862` y `GRADIO_SERVER_NAME=127.0.0.1`.

### 📚 Docs

- **`docs/INSTALL_MAC.md`** ampliado con sección "Disco externo no-APFS" + receta de sparsebundle.
- **`docs/TROUBLESHOOTING.md`** con 3 nuevas entradas: 11 (conda en FaceFusion), 12 (exFAT y AppleDouble en wheels Python), 13 (colisión de puertos).
- **`docs/STATUS.md`** actualizado al estado real con 5/5 tools verificadas en runtime + URLs locales.

---

### ✨ Added (Fase 4 — disco dual, zona de módulos, stats y empaquetado ad-hoc)

- **Resolución dual de `studio_home`**: `resolve_effective_home` decide en runtime si el path solicitado es usable; si el volumen externo está desmontado o sin permisos, fallback automático a `~/ChofyAIStudio` (configurable vía `fallback_home`). El `SystemSummary` expone `studio_home`, `studio_home_effective` y `using_fallback`.
- **Selector de volúmenes**: nuevo comando `list_volume_candidates` devuelve home + todos los `/Volumes/*` con `free_bytes`, `total_bytes` y flag `writable`. UI lista los candidatos y permite cambiar `studio_home` con un clic.
- **Zona de módulos / reubicación**: nuevos comandos `relocate_module(tool_id, target_dir)` y `clear_module_override(tool_id)`. `AppSettings` extendido con `tool_overrides: HashMap<String, String>` (tool_id → ruta absoluta). `manifest_install_dir` honra el override en install/start/restart/open. La UI sugiere `studio_home/modules/<id>` como destino por defecto.
- **Traslado cross-volumen**: `relocate_module` usa `rename` cuando origen y destino comparten volumen (instantáneo); cae a copia recursiva (incluyendo symlinks) + borrado en cross-device.
- **Barra inferior de stats del equipo**: nuevo comando `get_system_stats` lee CPU% (`top -l 1`), RAM (`vm_stat` + `sysctl hw.memsize`), disco del `studio_home_effective` (`df -k`), uptime (`sysctl kern.boottime`) y load average. UI con barra fija inferior, refresco cada 3 s, sin dependencias Rust extra.
- **ComfyUI operativo**: `apps/comfyui.yaml` con `install_script` + `run.command`. Nuevo `scripts/mac/install-comfyui.sh` que clona ComfyUI, crea venv Python 3.11/3.10, instala PyTorch con MPS y enlaza simbólicamente `models/`, `inputs/`, `outputs/`, `custom_nodes/` a la zona externa.
- **Detección runtime de Tauri**: el frontend detecta `__TAURI_INTERNALS__` y degrada limpio en `npm run dev:web` (sin backend) sin lanzar errores en cada botón.
- **`.cargo/config.toml`** con `target-dir = /tmp/chofyai-target` para evitar archivos AppleDouble (`._*`) que rompen `cargo build` cuando el repo vive en exFAT/HFS+.
- **`scripts/mac/clean-appledouble.sh`** — utilidad para borrar `._*` cuando reaparezcan.
- **`QUICKSTART.md`** en raíz con guía rápida de arranque, fallback, módulos y empaquetado.
- **Build `.app` ad-hoc** verificado sin Apple Developer ID (uso personal): `npm run tauri:build:app`.

### ⚡ Added (uv como acelerador opcional para herramientas Python)

- **`common.sh` extendido** con helpers `detect_python`, `detect_uv`, `create_pyenv`, `pip_install`, `py_install_requirements`, `pip_upgrade_base`, `log_python_manager`. La detección es **transparente**: si `uv` está disponible se usa (10-100× más rápido); si no, cae a `python -m venv` + `pip` clásico. **uv y pip coexisten — ninguno anula al otro.**
- **Refactorizados** `install-aceforge.sh`, `install-facefusion.sh`, `install-comfyui.sh` para usar los nuevos helpers. Cada script ahora imprime `Python manager: uv|pip` al final, y un marker `.chofyai-uv` en el venv permite recordar el manager elegido.
- **Variable `CHOFYAI_DISABLE_UV=1`** fuerza el path clásico (pip) aunque `uv` esté instalado — útil para reproducibilidad estricta o debugging.
- **Manifest opcional `python_manager: auto|uv|pip`** documenta la intención por herramienta. Añadido a los 4 manifests Python (`aceforge`, `facefusion`, `comfyui`, `qwen3-tts`).
- **`bootstrap.sh` y `doctor.sh`** detectan e informan sobre `uv` con instrucciones de instalación cuando falta.

### 🔄 Changed

- `@tauri-apps/api` actualizado a `^2.11.0` para alinear con el crate `tauri 2.11`.
- `lib.rs::setup` simplificado (eliminada llamada `get_webview_window` no compatible con `&mut tauri::App`).
- `ToolSummary` añade campo `relocated: bool` para que la UI marque herramientas con override.

### 🐛 Fixed

- Build de Tauri en disco externo no-APFS — antes fallaba con `stream did not contain valid UTF-8` al leer archivos `._default.toml` / `._default.json`.

---

## 🟢 [0.3.0] — 2026-04-06

### ✨ Added (Fase 3 — control de procesos y cola de instalaciones)

- **Stop / Restart por herramienta** desde la UI: botones dinámicos que aparecen sólo cuando la herramienta está en ejecución
- **Health checks en tiempo real**: sondeo de PID vivo + puerto TCP cada 5 s, con indicador visual (punto verde pulsante)
- **Cola de instalaciones**: instalación secuencial de múltiples herramientas con progreso visible por ítem
- **Streaming de salida de instalación**: cada línea de stdout del script llega en tiempo real al frontend vía eventos Tauri (`install-progress` / `install-done`)
- **Flujo de actualización automática** (`update_tool`): re-ejecuta el script de instalación sobre una herramienta ya instalada para actualizar versión / modelos
- **`ProcessRegistry`** en backend Rust: `Mutex<HashMap<String, u32>>` para rastrear PIDs activos entre invocaciones
- **`HealthResult`** y **`InstallEvent`** structs en `models.rs` serializados al frontend
- **Nuevos comandos Tauri**: `stop_tool`, `restart_tool`, `health_check_tool`, `update_tool`
- **`.markdownlint-cli2.jsonc`** para ignorar archivos `._*` de macOS en volúmenes exFAT y mantener CI de documentación limpio
- **CI `validate-manifests`** reescrito: valida campos requeridos, categorías y runtimes; `install_script`/`run` como condicional (permite `comfyui.yaml` sin script aún)

### 🛠️ Added (entorno y robustez)

- Despliegue local verificado en disco externo ORICO `/Volumes/ORICO/ChofyIA/chofyai-studio`
- `Studio Home` configurado en `/Volumes/ORICO/ChofyIA/ChofyAIStudio`
- `.npmrc` con registry público `registry.npmjs.org` para evitar registros corporativos hardcodeados
- `._*` añadido a `.gitignore` para archivos de recursos macOS en volúmenes exFAT
- `common.sh` inyecta `PATH=/opt/homebrew/bin:...` para scripts lanzados desde Tauri/Rust
- Dependencias del sistema verificadas: Homebrew 5.0.14, cmake 4.3.1, ffmpeg 8.1, python 3.10.20 / 3.11.15, rust 1.94.1, uv 0.11.3

### 🐛 Fixed

- `package-lock.json` regenerado desde `registry.npmjs.org` (el anterior apuntaba a un registro interno inaccesible)
- `package.json` version alineada a `0.2.0`
- `storage/state/settings.json` corregido (eliminado placeholder `CHANGE_ME`)
- CI `lint-docs` ahora descubre `.markdownlint-cli2.jsonc` automáticamente (sin parámetro `config` explícito)
- MD032 en `docs/INSTALL_MAC.md` y MD040 en `docs/STATUS.md` corregidos

---

## 🟢 [0.2.0] — 2026-03-20

### ✨ Added

- Scripts de limpieza `cleanup-tool.sh` con argumento de `tool_id`
- Script `doctor.sh` con diagnóstico de `studio_home` y herramientas
- Script `preflight-build.sh` para verificar prerequisitos antes de empaquetar
- Base de empaquetado macOS: `npm run package:mac` genera `.app` y `.dmg` mediante Tauri
- Manifests YAML para las 5 herramientas (Qwen3-TTS, whisper.cpp, FaceFusion, AceForge, ComfyUI)
- Campo `installed_if` en manifests para detectar instalación real por rutas de archivo
- Integración operativa de **AceForge** (workstation musical local-first)
- Documentación en `docs/`: `PROJECT_OVERVIEW.md`, `STATUS.md`, `INSTALL_MAC.md`, `TOOLS.md`, `TROUBLESHOOTING.md`, `packaging.md`, `architecture.md`, `decisions.md`

### 🔄 Changed

- `studio_home` en modo empaquetado ahora usa el directorio de datos de Tauri en lugar de `storage/state/settings.json`
- Refactorización de comandos Rust: separación clara entre `save_studio_home`, `list_tools`, `install_tool`, `start_tool`, `open_tool_directory`, `open_tool_log`

### 🐛 Fixed

- Detección de instalación ahora usa `installed_if` del manifest en lugar de estado interno
- Guardado de settings persiste correctamente al relanzar la app

---

## 🟢 [0.1.0] — 2026-03-01

### ✨ Added

- Estructura inicial del repositorio: `apps/`, `docs/`, `scripts/mac/`, `src/`, `src-tauri/`, `storage/`
- Shell de escritorio con **Tauri 2 + Rust + React/TypeScript + Vite**
- Lectura de manifests YAML desde `apps/`
- Guardado de `studio_home` en `storage/state/settings.json` (modo desarrollo)
- Detección de instalación básica por archivos declarados en el manifest
- Botones de UI: **Instalar**, **Iniciar**, **Abrir carpeta**, **Abrir log**
- Scripts de instalación operativos para: **Qwen3-TTS**, **whisper.cpp**, **FaceFusion**
- `bootstrap.sh`: verificación de prerequisitos (Rust, Node.js, Xcode CLT)
- `install-qwen3-tts.sh`: TTS + clonación de voz con backend MLX
- `install-whispercpp.sh`: compilación desde fuente con CMake + Metal
- `install-facefusion.sh`: face swap y procesamiento facial + venv

[Unreleased]: https://github.com/vladimiracunadev-create/chofyai-studio/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/vladimiracunadev-create/chofyai-studio/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/vladimiracunadev-create/chofyai-studio/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/vladimiracunadev-create/chofyai-studio/releases/tag/v0.1.0
