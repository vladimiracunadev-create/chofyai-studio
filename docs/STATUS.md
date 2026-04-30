# 📋 Estado actual del proyecto

> **Snapshot técnico — qué funciona hoy, qué está pendiente y con qué versiones se ha verificado.**

[![Versión](https://img.shields.io/badge/versión-0.4.0--dev-7c5cff)](../CHANGELOG.md)
[![Fase](https://img.shields.io/badge/Fase-4%20activa-2d7a66)](../ROADMAP.md)
[![Última actualización](https://img.shields.io/badge/Actualizado-2026--04--30-informational)](../CHANGELOG.md)

> Última actualización: **2026-04-30** · Ver [CHANGELOG](../CHANGELOG.md) para historial · Ver [ROADMAP](../ROADMAP.md) para fases futuras.

---

## 🏷️ Versión del repositorio

**`v0.4.0-dev`** — Fase 4 implementada: disco dual, zona de módulos, stats en vivo, ComfyUI operativo y empaquetado `.app` ad-hoc.

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
Solicitado:  /Volumes/ORICO/ChofyIA/ChofyAIStudio
Efectivo:    /Volumes/ORICO/ChofyIA/ChofyAIStudio  (fallback: ~/ChofyAIStudio si el volumen no está disponible)
```

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
- **Barra inferior fija** con CPU%, RAM, disco libre, uptime y load average — refresco cada 3 s.

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

| Herramienta | Categoría | Puerto | Requisitos | uv ⚡ |
|:---|:---|:---:|:---|:---:|
| 🎤 **Qwen3-TTS** | Voz / TTS | `7860` | python 3.10 | ✅ |
| 🎙️ **whisper.cpp** | ASR | `8178` | cmake, curl | — |
| 🎬 **FaceFusion** | Video / Cara | — | ffmpeg, python 3.x | ✅ |
| 🎵 **AceForge** | Música | `5056` | ffmpeg, python 3.x | ✅ |
| 🖼️ **ComfyUI** | Imagen | `8188` | python 3.11/3.10, PyTorch MPS | ✅ |

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
