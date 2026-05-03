# 🗺️ Roadmap

> **Hoja de ruta de ChofyAI Studio — qué está hecho, qué viene y por qué.**

[![Estado](https://img.shields.io/badge/Estado-release-2d7a66)](docs/STATUS.md)
[![Versión](https://img.shields.io/badge/versión-0.5.0-7c5cff)](CHANGELOG.md)
[![Tools live](https://img.shields.io/badge/Tools%20live-5%2F5-brightgreen)](docs/STATUS.md)

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
- [x] 🔌 **Detección de puertos ocupados** y huérfanos (`list_orphan_ports` + UI banner)
- [x] 🔁 **Limpieza automática ante fallos** (PIDs persistidos en `processes.json`, restore filtrado por `kill -0` al startup)

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
- [x] 💾 Soporte oficial de **APFS sparsebundle** para discos externos no-APFS
- [ ] 🤖 **Configurar Mac Mini como Self-Hosted Runner para GitHub Actions**
- [ ] 🎨 Branding e iconografía final
- [ ] 🔐 Firma Apple Developer ID
- [ ] 🛂 Notarización
- [ ] 📢 Canal de releases automatizado

---

## ✅ Fase 5 — UX profesional, comandos y seguridad *(release v0.5.0)*

- [x] 💎 **Cola de instalación pro** (parser de fases, MB/s, mini-terminal)
- [x] 👁 **Vista embebida** del tool reemplazando la sección Herramientas con header + back button
- [x] 🔄 **Auto-refresh** + health probe global + estado `starting` con tolerancia 60s
- [x] 🛡 **Sprint 1**: toasts globales, ErrorBoundary con crash log, persistencia de PIDs, logs in-app, empty state
- [x] 🚀 **Sprint 2**: onboarding wizard (4 pasos), update checker, notificaciones nativas macOS
- [x] 🎛 **Sprint 3**: paleta `⌘K`, Settings UI completo, gestión de modelos, tests baseline
- [x] ✨ **Sprint 4**: catálogo de atajos `⌘K/⌘,/⌘/⌘R/⌘L/⌘B`, help panel, tema dark/light/system, pre-install check
- [x] 🛡 **Sprint 5**: security workflow portable (TruffleHog + npm/cargo audit + CodeQL + Dependabot), huérfanos, crash log
- [x] 🧱 **Sprint 6**: **Marketplace MVP** con 10 tools curadas (Bark, RVC, MusicGen, etc.) y `import_marketplace_tool`
- [x] 🔗 **Sprint 7**: **Workflows** declarativos en YAML con runner HTTP secuencial
- [x] 🌐 **Sprint 8**: **i18n ES/EN** sin deps con ~85 keys y hot-swap reactivo
- [x] 🎨 **Sprint 9**: **Visual Workflow Builder** drag&drop, iconos custom por tool, UI overhaul profesional con design tokens
- [x] 🪟 **Sidebar agrupada** (Workspace/Tools/Sistema) con badges y atajos visibles
- [x] 📊 **Modales para Resumen/Huérfanos/Doctor/Settings/Marketplace/Workflows/Help** sustituyendo cards permanentes

---

## 🌱 Fase 6 — Expansión del catálogo

- [ ] 🛠️ Nuevos adapters creativos (Bark, RVC, etc.)
- [ ] ⚡ Sidecars / binarios dedicados
- [ ] 📦 Gestor avanzado de modelos (descarga, versionado, GC)
- [ ] 🌐 Plugins de comunidad por manifests externos
- [ ] 🤖 Workflows guiados (audio → STT → LLM → TTS → video lipsync)

---

## 📊 Estado consolidado

| Fase | Estado | Progreso |
|:---:|:---|:---:|
| 0 — Base | `✅ COMPLETA` | 100% |
| 1 — MVP local | `✅ COMPLETA` | 100% |
| 2 — Robustez launcher | `✅ COMPLETA` | 7/7 (huérfanos resueltos en Sprint 5) |
| 3 — Disco dual + módulos | `✅ COMPLETA` | 100% |
| 4 — Producto instalable | `🚧 EN CURSO` | 4/9 (falta firma + notarización + canal releases) |
| 5 — UX profesional | `✅ COMPLETA` | 14/14 (release v0.5.0) |
| 6 — Expansión catálogo | `🌱 FUTURO` | 0/5 |

> Ver detalle del estado actual en [`docs/STATUS.md`](docs/STATUS.md) y bitácora en [`CHANGELOG.md`](CHANGELOG.md).
