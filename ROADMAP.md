# 🗺️ Roadmap

> **Hoja de ruta de ChofyAI Studio — qué está hecho, qué viene y por qué.**

[![Estado](https://img.shields.io/badge/Estado-Fase%204%20activa-2d7a66)](docs/STATUS.md)
[![Versión](https://img.shields.io/badge/versión-0.4.0--dev-7c5cff)](CHANGELOG.md)

---

## ✅ Fase 0 — Base del proyecto

- [x] 🏷️ Nombre de producto
- [x] 📂 Estructura inicial del repositorio
- [x] 🦀 Base Tauri + Rust + React
- [x] 📐 Manifests YAML iniciales
- [x] 📜 Scripts macOS por herramienta

---

## ✅ Fase 1 — MVP local

- [x] 💾 Guardado de `studio_home`
- [x] 🔍 Detección de instalación por `installed_if`
- [x] 📁 Apertura de carpeta desde la UI
- [x] 📋 Apertura de logs desde la UI
- [x] 📦 Instalación desde la UI para Qwen3-TTS, whisper.cpp, FaceFusion, AceForge
- [x] ▶️ Arranque básico desde la UI

---

## ✅ Fase 2 — Robustez del launcher

- [x] 🛑 Stop / Restart por herramienta
- [x] 💚 Health checks reales por proceso / puerto
- [x] ⏱️ Cola de instalación con progreso y streaming
- [x] 📋 Registro interno con `ProcessRegistry`
- [x] ⬆️ Flujo de actualización automática (`update_tool`)
- [ ] 🔌 Detección de puertos ocupados antes de iniciar
- [ ] 🔁 Reintentos y limpieza automática ante fallos

---

## 🟢 Fase 3 — Disco dual, módulos y stats *(implementada)*

- [x] 💾 **Resolución dual de `studio_home`** con fallback automático
- [x] 🔍 **Selector de volúmenes** con espacio libre y permisos
- [x] 📍 **Zona de módulos** (`relocate_module` / `clear_module_override`)
- [x] 📊 **Barra de stats** en vivo (CPU/RAM/disco/uptime/load)
- [x] 🖼️ **ComfyUI operativo** con install script + symlinks
- [x] 🧼 Workaround AppleDouble (`.cargo/config.toml` + `clean-appledouble.sh`)

---

## 🚧 Fase 4 — Producto instalable

- [x] 📦 Base de empaquetado `.app` / `.dmg`
- [x] ✅ Build verificado en macOS real (Apple Silicon)
- [x] 🆓 Build ad-hoc sin Apple Developer ID (uso personal)
- [ ] 🤖 **Configurar Mac Mini como Self-Hosted Runner para GitHub Actions**
- [ ] 🎨 Branding e iconografía final
- [ ] 🔐 Firma Apple Developer ID
- [ ] 🛂 Notarización
- [ ] 📢 Canal de releases automatizado

---

## 🔮 Fase 5 — UX y operación avanzada

- [ ] 🪟 Multi-window
- [ ] 📑 Menús más completos
- [ ] ⚙️ Settings avanzados (`models_dir`, `outputs_dir`, `cache_dir`) en UI
- [ ] 📤 Export / Import de configuración
- [ ] 🩺 Doctor ampliado con reporte exportable
- [ ] 🔌 Detección de puertos ocupados pre-inicio
- [ ] 🧹 Cleanup automático de procesos huérfanos al reiniciar la app

---

## 🌱 Fase 6 — Expansión del catálogo

- [ ] 🛠️ Nuevos adapters creativos (Bark, RVC, etc.)
- [ ] ⚡ Sidecars / binarios dedicados
- [ ] 📦 Gestor avanzado de modelos (descarga, versionado, GC)
- [ ] 🌐 Plugins de comunidad por manifests externos

---

## 📊 Estado consolidado

| Fase | Estado | Progreso |
|:---:|:---|:---:|
| 0 — Base | `✅ COMPLETA` | 100% |
| 1 — MVP local | `✅ COMPLETA` | 100% |
| 2 — Robustez launcher | `🟢 EN CURSO` | 5/7 |
| 3 — Disco dual + módulos | `✅ COMPLETA` | 100% |
| 4 — Producto instalable | `🚧 EN CURSO` | 3/8 |
| 5 — UX avanzada | `🔮 PLANIFICADA` | 0/7 |
| 6 — Expansión catálogo | `🌱 FUTURO` | 0/4 |

> Ver detalle del estado actual en [`docs/STATUS.md`](docs/STATUS.md) y bitácora en [`CHANGELOG.md`](CHANGELOG.md).
