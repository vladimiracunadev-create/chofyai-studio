# 📖 About ChofyAI Studio

> **Un orquestador honesto de IA creativa local.**

[![Landing](https://img.shields.io/badge/Sitio-vladimiracunadev--create.github.io%2Fchofyai--studio-7c5cff?logo=github&logoColor=white)](https://vladimiracunadev-create.github.io/chofyai-studio/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🎯 La idea en una frase

Quería un launcher para mis cinco herramientas creativas de IA favoritas
que **respetara mi disco externo**, **controlara los procesos de verdad**
y **dijera la verdad cuando algo no funcionara**. Como no existía,
lo escribí.

---

## 🧭 Por qué existe

Los launchers genéricos al estilo Pinokio resuelven "instala cualquier cosa
que veas en GitHub". Esa generalidad tiene un costo:

- 🌪️ Scripts mantenidos por terceros que rompen sin avisar
- 📦 Modelos pesados sin gestión real (descargar manual, borrar manual, copiar entre máquinas a mano)
- 👻 Procesos zombis que dejan puertos ocupados después de un crash
- 🗣️ Promesas optimistas sobre compatibilidad que se desinflan en el primer error

ChofyAI Studio toma el camino opuesto:

> **Un set acotado de 5 herramientas curadas, con scripts auditables, control real de procesos y mensajes claros cuando algo no funciona.**

Si necesitas el ecosistema Pinokio completo, usa Pinokio. Esto es otra cosa.

---

## 🏛️ Los cuatro pilares

### 🔒 Local-first

- **Sin nube**, sin cuotas, sin telemetría.
- Los modelos viven en tu disco — el que tú elijas.
- La app **no abre conexiones de salida**. Las descargas las hacen las
  herramientas directamente (Hugging Face, GitHub) cuando tú lo pides.
- Soporte oficial para **disco externo APFS** y **sparsebundle sobre exFAT**
  con fallback automático al disco principal si el volumen externo no está
  disponible.

### 🧰 Reproducible

- Cada herramienta tiene un **manifest YAML** en `apps/<id>.yaml`.
- Cada manifest declara `installed_if`: la lista de rutas que deben existir
  para considerarla instalada. Si falta una, la UI te lo dice exactamente.
- Cada manifest declara `install_scripts:` por plataforma — la app elige
  el script correcto para tu OS.
- Los scripts son **Bash auditable** (`scripts/mac/`) y **PowerShell auditable**
  (`scripts/win/`). Cualquiera puede leer qué hace, antes de ejecutarlo.

### ⚖️ Honesto

- El soporte multi-plataforma muestra ✅ validado / 🧪 experimental / ⚪ pendiente
  con criterios públicos, no marketing.
- Si una herramienta requiere algo que tu plataforma no tiene (ej. **MLX**
  es Apple-only), la UI te lo dice y te sugiere alternativas — no falla en silencio.
- Cuando algo crashea, hay un **crash log persistente** (`storage/state/crash.log`)
  y un panel para inspeccionarlo desde la UI.

### 🦀 Sin Electron

- **Backend Rust + frontend React vía Tauri 2.**
- Binario nativo de ~5 MB, no ~150 MB.
- Memoria `O(MB)`, no `O(GB)`.
- FFI directo con el OS: spawn de procesos, file watchers, native notifications.

---

## 🛠️ Las 5 herramientas

| Categoría | Herramienta | Modelo base | Rol |
|---|---|---|---|
| 🎤 Voz / TTS | Qwen3-TTS | Qwen3-TTS-12Hz-0.6B-Base-8bit | Síntesis y clonación de voz |
| 🎙️ ASR | whisper.cpp | ggml-base.en | Transcripción local |
| 🎬 Video / Cara | FaceFusion | InsightFace + 12 ONNX | Face swap y utilidades de video |
| 🎵 Música | AceForge | ACE-Step-v1-3.5B | Workstation musical |
| 🖼️ Imagen | ComfyUI | Stable Diffusion 1.5 | Workflows nodales de imagen |

Las 5 fueron **validadas con inferencia real** el 2026-05-17 — no solo
respuesta HTTP, sino transcripción correcta, imagen generada, voz sintetizada,
modelos ONNX cargados y face swap funcional. Detalle en [`docs/POSTMORTEM-2026-05-17.md`](docs/POSTMORTEM-2026-05-17.md).

---

## 🗺️ Estado actual (mayo 2026)

### Lo que funciona

- ✅ **macOS Apple Silicon (M1+, 13 Ventura+)**: 5/5 tools validadas end-to-end
- ✅ **Release `.dmg` automatizado** en `macos-latest` hosted runner
- ✅ **Settings UI completo**: `studio_home`, `models_dir`, `outputs_dir`, `cache_dir`
- ✅ **Descarga guiada de modelos** con progreso en vivo desde la UI
- ✅ **Marketplace MVP** con 10 tools curadas adicionales
- ✅ **Workflows declarativos** con Visual Workflow Builder drag & drop
- ✅ **i18n ES/EN** sin dependencias
- ✅ **Supply-chain hardening**: pnpm con `onlyBuiltDependencies` allowlist,
  lockfile SHA-512, CI con TruffleHog + pnpm audit + cargo audit + CodeQL
- ✅ **Landing page** en <https://vladimiracunadev-create.github.io/chofyai-studio/>

### Lo que está en curso

- 🧪 **Windows + GPU NVIDIA**: scripts `scripts/win/*.ps1` funcionales,
  backend Rust con detección de plataforma. Validación end-to-end en máquina
  real pendiente. Qwen3-TTS no estará disponible (MLX es Apple-only).
- ⚪ **Linux + GPU NVIDIA**: backend lo soporta, scripts `scripts/linux/`
  pendientes. Patrón análogo a Windows pero con bash en vez de PowerShell.

### Lo que sigue

- 🛂 **Firma + notarización Apple Developer ID** para distribución pública
  sin el right-click → Abrir. Guía con los 6 secrets en [`docs/NOTARIZATION.md`](docs/NOTARIZATION.md).
- 🎤 **TTS cross-platform**: reemplazo de Qwen3-TTS para Win/Linux con
  Coqui XTTS-v2, Piper TTS, F5-TTS u OpenVoice v2.
- 📦 **Bundles `.msi` / `.exe` / `.AppImage` / `.deb`** en `tauri.conf.json`.
- 🛒 **Catálogo expandido**: Bark, RVC, MusicGen, Stable Audio, etc.

Detalle completo en [`ROADMAP.md`](ROADMAP.md).

---

## 🧱 Stack técnico

| Capa | Tecnología | Rol |
|---|---|---|
| Backend | **Rust** + Tauri 2.11 | `ProcessRegistry`, manifest loader, IPC, FFI |
| Frontend | **React 18** + Vite 5 + TypeScript 5.6 estricto | UI declarativa, paleta `⌘K`, design tokens |
| Tests frontend | **Vitest 3.2** + jsdom 25 | Unit tests de parsers/formatters |
| Tests backend | **cargo test** | Tests de `ProcessRegistry`, paths, anti-traversal |
| Lint MD | **markdownlint-cli2** | CI fail si hay MD### violations |
| Package manager | **pnpm 10** con `onlyBuiltDependencies` | Bloqueo de postinstall arbitrarios |
| Python tooling | **uv** (opcional) + venv fallback | Instalaciones 10-100× más rápidas |
| Empaquetado | Tauri 2 → `.app` + `.dmg` (ad-hoc) | Automatizado en `macos-latest` hosted runner |
| CI/CD | GitHub Actions | `ci.yml` + `security.yml` + `release.yml` + `pages.yml` |
| Hosting docs | GitHub Pages | Landing en `landing/` con auto-deploy |

---

## 👤 Autor

Vladimir Acuña Valdebenito

- GitHub: [@vladimiracunadev-create](https://github.com/vladimiracunadev-create)
- Repo: [vladimiracunadev-create/chofyai-studio](https://github.com/vladimiracunadev-create/chofyai-studio)

Construido como producto personal con disciplina de proyecto comercial
(CI/CD completo, security workflow portable, docs exhaustivas, ADRs).

---

## ⚖️ Licencia

[MIT](LICENSE). Eres libre de usar, modificar, redistribuir, hacer fork —
con o sin atribución. Las **herramientas integradas** (Qwen3-TTS, whisper.cpp,
FaceFusion, AceForge, ComfyUI) tienen sus propias licencias en sus repos
upstream — respétalas.

---

## 🔗 Enlaces rápidos

| Recurso | Link |
|---|---|
| 🌐 Sitio | <https://vladimiracunadev-create.github.io/chofyai-studio/> |
| 📦 Releases | <https://github.com/vladimiracunadev-create/chofyai-studio/releases> |
| 📋 README técnico | [README.md](README.md) |
| 🚀 Quick start | [QUICKSTART.md](QUICKSTART.md) |
| 📐 Requisitos HW/SW | [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) |
| 🗺️ Roadmap | [ROADMAP.md](ROADMAP.md) |
| 📜 Changelog | [CHANGELOG.md](CHANGELOG.md) |
| 🛡️ Seguridad | [SECURITY.md](SECURITY.md) |
| 🤝 Contribuir | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 🏗️ Arquitectura | [docs/architecture.md](docs/architecture.md) |
| 🧭 Decisiones (ADRs) | [docs/decisions.md](docs/decisions.md) |

---

> Si llegaste aquí, gracias por el interés. Si encuentras un bug, abre un
> [issue](https://github.com/vladimiracunadev-create/chofyai-studio/issues).
> Si quieres aportar, lee [`CONTRIBUTING.md`](CONTRIBUTING.md) y abre un PR.
