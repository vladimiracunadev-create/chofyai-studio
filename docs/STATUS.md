# 📋 Estado actual del proyecto

> **Snapshot técnico — qué funciona hoy, qué está pendiente y con qué versiones se ha verificado.**

[![Versión](https://img.shields.io/badge/versión-0.5.1-7c5cff)](../CHANGELOG.md)
[![Estado](https://img.shields.io/badge/Estado-operativo-2d7a66)](../ROADMAP.md)
[![Última actualización](https://img.shields.io/badge/Actualizado-2026--05--17-informational)](../CHANGELOG.md)
[![Tools live](https://img.shields.io/badge/Tools%20live-5%2F5-brightgreen)](../CHANGELOG.md)
[![Inferencia](https://img.shields.io/badge/Inferencia%20real-5%2F5-brightgreen)](POSTMORTEM-2026-05-17.md)
[![Tests](https://img.shields.io/badge/Tests-20%2F20-brightgreen)](../CHANGELOG.md)

> Última actualización: **2026-05-17** · Ver [CHANGELOG](../CHANGELOG.md) para historial · Ver [POSTMORTEM-2026-05-17.md](POSTMORTEM-2026-05-17.md) para detalles del hardening v0.5.1.

---

## 🏷️ Versión del repositorio

**`v0.5.1`** — maintenance release con hardening de operatividad: auto-mount
del sparsebundle al arranque, validación cruzada de `installed_if`, pre-flight
de puertos huérfanos, patch del puerto AceForge para evitar colisión con
Chrome `intecom-ps1`, fix de symlinks ComfyUI, UI oculta detalles de transporte
al usuario final. **5/5 tools probadas con inferencia real (no solo boot HTTP)**.

> 🧭 ¿Solo quieres entender qué fallaba y por qué? → [PORQUE-NO-FUNCIONABA.md](PORQUE-NO-FUNCIONABA.md) (explicación en lenguaje claro, sin jerga).

---

## ✅ Entorno verificado

| Dependencia | Versión instalada | Estado |
|---|---|---|
| Homebrew | 5.0.14 | ✅ |
| Node.js | 22.21.1 | ✅ |
| npm | 10.9.4 | ✅ |
| Rust / cargo | 1.94.1 | ✅ |
| cmake | 4.3.1 | ✅ |
| ffmpeg | 8.1 | ✅ |
| python 3.10 | 3.10.20 | ✅ |
| python 3.11 | 3.11.15 | ✅ |
| uv ⚡ | 0.9.18 | ✅ (opcional — pip clásico si falta) |
| git | 2.50.1 | ✅ |

---

## 💾 Studio Home configurado

```text
Solicitado:  /Volumes/ChofyAIStudio        (sparsebundle APFS)
Físicamente: /Volumes/ORICO/ChofyIA/ChofyAIStudio.sparsebundle  (100 GB elásticos sobre exFAT)
Fallback:    ~/ChofyAIStudio (APFS interno) si el sparsebundle no está montado
```

> [!IMPORTANT]
> El disco externo `/Volumes/ORICO` es **exFAT** → wheels Python con scripts ejecutables fallan por archivos AppleDouble. La solución oficial del proyecto es una imagen sparsebundle APFS montada desde el disco externo. Ver [`INSTALL_MAC.md` § Disco externo no-APFS](INSTALL_MAC.md#-disco-externo-no-apfs).

---

## ✨ Funciones disponibles

### 🖥️ UI

- Resumen del sistema con `studio_home` solicitado vs. efectivo y bandera de fallback.
- **Selector de volúmenes**: lista `~` y todos los `/Volumes/*` con espacio libre y permisos.
- Guardar `studio_home` con un clic o con ruta personalizada.
- Listar herramientas desde manifests YAML, con detección de instalación por `installed_if`.
- **Instalar** / **Actualizar** / **Iniciar** / **Detener** / **Reiniciar** herramientas.
- **Cola de instalaciones** secuencial con progreso por ítem.
- **Health check visual**: indicador pulsante cuando la herramienta responde en su puerto TCP.
- **📍 Mover** herramienta a `studio_home/modules/<id>` (o cualquier ruta absoluta) y **↺ Reset ruta** para quitar el override.
- Abrir carpeta / log de herramienta.
- **Barra inferior fija** con CPU%, RAM, disco libre, **App** (tiempo de la sesión actual) y load average — refresco cada 3 s, barras proporcionales con gradiente glow.
- **🆕 Cola de instalación profesional** — fase detectada (`Clonando` / `Compilando` / `Descargando modelo` / `Instalando dependencias`), barra de progreso animada %, MB/s, tiempo `⏱ MM:SS` y mini-terminal con últimas 8 líneas por ítem.
- **🆕 Vista embebida `<iframe>`** — botón `👁 Ver UI` en cada tool con server activo abre la herramienta dentro de la ventana de ChofyAI Studio (sin saltar al navegador).
- **🆕 Botón `🔄 Refrescar estado`** + auto-refresh cada 8 s — detecta tools instaladas o arrancadas desde CLI sin relanzar la app.
- **🆕 Health probe global** — todas las tools con `default_port` se chequean en cada ciclo, no solo las arrancadas desde la UI.
- **🆕 Toasts globales** + `AppErrorBoundary` (Sprint 1).
- **🆕 LogsViewer inline** con filtro y auto-refresh; **ModelsPanel** por tool con tamaños y borrado seguro.
- **🆕 Onboarding wizard** de 4 pasos + **UpdateChecker** banner + **notificaciones nativas macOS** (Sprint 2).
- **🆕 Paleta `⌘K`** + **Settings modal** completo + **gestión de modelos** (Sprint 3).
- **🆕 Catálogo de atajos** `⌘K`/`⌘,`/`⌘/`/`⌘R`/`⌘L`/`⌘B`/`Esc` + **Help panel** + **tema claro/oscuro/sistema** + **pre-install check** (Sprint 4).
- **🆕 Banner de procesos huérfanos** con opciones Adoptar/Matar + **crash log** persistente exportable (Sprint 5).

### 🦀 Backend Rust (comandos Tauri)

| Comando | Función |
|:---|:---|
| `get_system_summary` | 📋 Resumen + studio_home solicitado/efectivo + flag fallback |
| `get_system_stats` | 📊 CPU/RAM/disco/uptime/load (barra inferior) |
| `list_volume_candidates` | 🔍 Volúmenes home + externos para el selector |
| `save_studio_home` | 💾 Persiste el path solicitado |
| `list_tools` | 🛠️ Manifests + estado de instalación (incluye `relocated`) |
| `install_tool` | 📦 Ejecuta script con streaming `install-progress` / `install-done` |
| `update_tool` | ⬆️ Re-ejecuta script sobre instalación existente |
| `start_tool` | ▶️ Lanza proceso y registra PID en `ProcessRegistry` |
| `stop_tool` | ⏹️ SIGTERM + elimina del registro |
| `restart_tool` | 🔄 Stop + Start con espera de 800 ms |
| `health_check_tool` | 💚 PID vivo (`kill -0`) + puerto TCP |
| `relocate_module` | 📍 Mueve directorio + registra `tool_overrides` |
| `clear_module_override` | ↺ Quita override (no mueve archivos) |
| `open_tool_directory` | 📁 Abre Finder en la carpeta del tool |
| `open_tool_log` | 📋 Abre log de install/run con app por defecto |
| `read_tool_log` | 📋 Lee últimas N líneas del log para el panel inline |
| `list_running_pids` | 📋 Devuelve los PIDs adoptados (UI sync) |
| `notify_macos` | 🔔 Notificación nativa vía `osascript` |
| `list_tool_models` / `delete_tool_model` | 📦 Listar y borrar modelos (con guarda anti-traversal) |
| `list_orphan_ports` / `adopt_orphan` / `kill_orphan` | 👻 Detectar puertos LISTEN sin owner registrado y resolverlos |
| `append_crash_log` / `read_crash_log` | 💥 Crash log persistente para post-mortem |

### 🛠️ Herramientas con integración operativa

Verificado **2026-05-17** — los 5 servicios responden HTTP **y pasan una
prueba de inferencia real**, no solo arranque.

| Herramienta | Categoría | Puerto | HTTP | Inferencia real | Modelo |
|:---|:---|:---:|:---:|---|---:|
| 🎙️ **whisper.cpp** | ASR | `8178` | 200 | Transcribe JFK → texto correcto | 141 MB |
| 🖼️ **ComfyUI** | Imagen | `8188` | 200 | Genera PNG 256×256 (SD 1.5) | 4.0 GB |
| 🎤 **Qwen3-TTS** | Voz / TTS | `7860` | 307 | WAV 221 KB español sintetizado | 7.6 GB |
| 🎬 **FaceFusion** | Video / Cara | `7862` | 200 | Gradio + 12 ONNX + API `face_swapper` | ~3 GB |
| 🎵 **AceForge** | Música | `7857` | 200 | `/healthz`=`ok` + ACE-Step-v1-3.5B cargado | 7.7 GB |

> [!NOTE]
> **AceForge cambió de puerto** `5056` → `7857` en v0.5.1. El puerto `5056`
> (`intecom-ps1`) colisiona con un servicio interno de Google Chrome que satura
> los worker threads de `waitress`. Ver [POSTMORTEM § I9](POSTMORTEM-2026-05-17.md#i9--puerto-5056-aceforge-colisiona-con-intecom-ps1-saturado-por-chrome).
>
> **FaceFusion install** ahora añade `--skip-conda` automáticamente — ya no
> requiere conda. Ver [POSTMORTEM § I6](POSTMORTEM-2026-05-17.md#i6--facefusion-installpy-exigía-conda).

---

## ⚠️ Limitaciones actuales

- ⚙️ Settings avanzados (`models_dir`, `outputs_dir`, `cache_dir`) declarados en manifests pero sin controles UI.
- 🔐 Firma y notarización Apple no incluidas — el `.app` se ejecuta ad-hoc en este equipo (click derecho → Abrir la primera vez).
- 📦 La descarga de modelos pesados (SD 1.5, ACE-Step, Qwen-TTS) se hace fuera de la UI; aún no hay flujo guiado.

> Cerradas en v0.5.1: ✅ cleanup automático de huérfanos en `start_tool` ·
> ✅ verificación de puerto antes de iniciar · ✅ auto-mount del sparsebundle.

---

## 🌐 Modo web vs modo Tauri

| Modo | Comando | Botones de herramientas |
|:---|:---|:---:|
| 🌐 Web (solo frontend) | `npm run dev:web` | ❌ Sin backend (degrada limpio) |
| 🖥️ Escritorio completo | `npm run tauri:dev` | ✅ Todo funciona |
| 📦 `.app` instalada | doble clic en `/Applications` | ✅ Todo funciona |

---

## 📦 Estado de empaquetado

| Comando | Salida |
|:---|:---|
| `npm run tauri:build:app` | `/tmp/chofyai-target/release/bundle/macos/ChofyAI Studio.app` |
| `npm run tauri:build:dmg` | `/tmp/chofyai-target/release/bundle/dmg/ChofyAI Studio_*.dmg` |
| `npm run package:mac` | Pipeline completo `bash scripts/mac/build-release.sh` |

> [!IMPORTANT]
> `target-dir` está redirigido a `/tmp/chofyai-target` por `.cargo/config.toml` para evitar archivos AppleDouble (`._*`) en volúmenes externos no-APFS. Si reaparecen, ejecuta `bash scripts/mac/clean-appledouble.sh`.

Build verificado el **2026-04-30** sin Apple Developer ID — funcional para uso personal en este equipo.
