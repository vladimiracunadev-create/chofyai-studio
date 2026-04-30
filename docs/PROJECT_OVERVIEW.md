# 🎯 Visión general del proyecto

> **Por qué existe ChofyAI Studio y qué pretende ser (y no ser).**

[![Platform](https://img.shields.io/badge/Platform-macOS%20Apple%20Silicon-black?logo=apple&logoColor=white)](INSTALL_MAC.md)
[![Filosofía](https://img.shields.io/badge/Filosofía-Local%20First-2d7a66)](decisions.md)

---

## 🎨 Qué es ChofyAI Studio

ChofyAI Studio es un **launcher local para macOS Apple Silicon** construido para centralizar herramientas creativas de IA **sin depender de un orquestador genérico externo**.

Está pensado para un entorno como un **Mac mini M4 con 64 GB de RAM**, donde tiene más sentido:

- 🪶 una app principal **ligera**
- 🏝️ herramientas pesadas **aisladas**
- 🗺️ rutas de trabajo **controladas**
- 📋 logs **claros**
- ⚙️ configuración **explícita**

---

## 🩹 Qué problema intenta resolver

Muchos launchers externos…

- 👀 ocultan demasiado el estado real de instalación
- 🌀 mezclan UI con runtime
- ❓ no dejan claro qué está instalado y qué no
- 💥 se rompen por rutas, permisos, discos externos o installers ambiguos

ChofyAI Studio intenta resolver eso con:

- 📐 **Manifests YAML** legibles
- 📜 **Scripts explícitos** por herramienta
- ✅ **Checks de instalación** definidos por archivos reales (`installed_if`)
- 🖥️ **Shell de escritorio propia** (Tauri + Rust)
- 💾 **Resolución dual de disco** (externo + principal con fallback)

---

## 💡 Filosofía

| # | Principio | Cómo se materializa |
|:-:|:---|:---|
| 1 | 🎨 La GUI **no corre modelos** dentro del proceso principal | Cada tool tiene proceso separado registrado en `ProcessRegistry` |
| 2 | 🏝️ Cada herramienta vive en su **propia carpeta y runtime** | `studio_home/tools/<id>/` o `studio_home/modules/<id>/` |
| 3 | ✅ El estado **instalado** se decide por checks explícitos | `installed_if` en cada manifest YAML |
| 4 | 🍎 Orientado **primero a macOS Apple Silicon** | Scripts `mac/`, MPS para PyTorch, Metal para llama.cpp |
| 5 | 💾 **Discos críticos** deben ser internos o APFS | Workaround AppleDouble + fallback automático |
| 6 | 🔍 **Visibilidad operativa** ante todo | Logs por tool, health checks, stats en vivo |

---

## 📦 Qué contiene hoy

- 🦀 Shell **Tauri 2 / Rust**
- ⚛️ Frontend **React + TypeScript + Vite**
- ⚙️ Gestión de `settings.json` con `tool_overrides` y `fallback_home`
- 📐 Lectura de manifests + checks de instalación
- 🛠️ **5 herramientas integradas**: Qwen3-TTS, whisper.cpp, FaceFusion, AceForge, ComfyUI
- 💾 **Resolución dual de disco** con selector de volúmenes
- 📍 **Zona de módulos** con reubicación cross-volumen
- 📊 **Stats en vivo** del equipo (CPU/RAM/disco)
- 📦 **Empaquetado** base `.app` / `.dmg` ad-hoc

---

## 🚫 Qué no pretende ser

- ❌ Un clon completo de **Pinokio**
- ❌ Un **marketplace universal** de repositorios IA
- ❌ Una suite terminada y **distribuible profesionalmente** hoy mismo (falta firma Apple)

> [!NOTE]
> Es, en esta fase, un **producto base serio** desde el cual seguir creciendo. Cada decisión de diseño está documentada en [`decisions.md`](decisions.md) como ADR.

---

## 🧭 Para profundizar

| 📚 Tema | 📖 Doc |
|:---|:---|
| Arquitectura por capas | [`architecture.md`](architecture.md) |
| Decisiones de diseño (ADRs) | [`decisions.md`](decisions.md) |
| Estado actual y limitaciones | [`STATUS.md`](STATUS.md) |
| Roadmap y fases futuras | [`../ROADMAP.md`](../ROADMAP.md) |
