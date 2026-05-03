# 📋 Estado actual del proyecto

> **Snapshot técnico — qué funciona hoy, qué está pendiente y con qué versiones se ha verificado.**

[![Versión](https://img.shields.io/badge/versión-0.5.0--dev-7c5cff)](../CHANGELOG.md)
[![Fase](https://img.shields.io/badge/Fase-5%20activa-2d7a66)](../ROADMAP.md)
[![Última actualización](https://img.shields.io/badge/Actualizado-2026--05--03-informational)](../CHANGELOG.md)
[![Tools live](https://img.shields.io/badge/Tools%20live-5%2F5-brightgreen)](../CHANGELOG.md)

> Última actualización: **2026-05-03** · Ver [CHANGELOG](../CHANGELOG.md) para historial · Ver [ROADMAP](../ROADMAP.md) para fases futuras.

---

## 🏷️ Versión del repositorio

**`v0.5.0-dev`** — Fase 5 en curso: cola de instalación profesional, vista embebida, sparsebundle APFS, 5/5 tools verificadas en runtime.

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

### 🛠️ Herramientas con integración operativa

Verificado **2026-05-03** — los 5 servicios responden HTTP y son visibles desde el panel embebido en la ventana principal.

| Herramienta | Categoría | Puerto | Estado runtime | Manager Python |
|:---|:---|:---:|:---:|:---:|
| 🎤 **Qwen3-TTS** | Voz / TTS | `7860` | ✅ HTTP 307 (redirect a /static) | uv ⚡ (python 3.10) |
| 🎙️ **whisper.cpp** | ASR | `8178` | ✅ HTTP 200 (Metal/MPS) | — (binario nativo) |
| 🎬 **FaceFusion** | Video / Cara | `7862` | ✅ HTTP 200 (Gradio) | conda (python 3.11) |
| 🎵 **AceForge** | Música | `5056` | ✅ HTTP 200 (Gradio) | uv ⚡ (python 3.11) |
| 🖼️ **ComfyUI** | Imagen | `8188` | ✅ HTTP 200 (PyTorch MPS) | uv ⚡ (python 3.11) |

> [!NOTE]
> **FaceFusion requiere `conda`** — su `install.py` aborta sin `CONDA_PREFIX`. Ver [`TROUBLESHOOTING.md` § 11](TROUBLESHOOTING.md#-11-facefusion-conda-is-not-activated).
> **Qwen3-TTS y FaceFusion** comparten familia de puertos Gradio — FaceFusion declara `default_port: 7862` para evitar colisión.

---

## ⚠️ Limitaciones actuales

- 🚫 No hay cleanup automático de procesos huérfanos entre reinicios de la app (el `ProcessRegistry` vive solo en memoria).
- 🔌 No se verifica si el puerto declarado está ocupado antes de iniciar.
- ⚙️ Settings avanzados (`models_dir`, `outputs_dir`, `cache_dir`) declarados en manifests pero sin controles UI.
- 🔐 Firma y notarización Apple no incluidas — el `.app` se ejecuta ad-hoc en este equipo (click derecho → Abrir la primera vez).

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
