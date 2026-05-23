# 🔀 Guía de port a otras plataformas

> **Análisis técnico para quien quiera bifurcar ChofyAI Studio a Windows, Linux o Intel Mac. No es una guía de instalación — es una evaluación de esfuerzo.**

Antes de leer esto: si solo quieres **usar** la app, ve a [`REQUIREMENTS.md`](REQUIREMENTS.md). El producto soporta exclusivamente **macOS 13+ Apple Silicon**. Este documento existe para quien evalúa portar el código.

---

## 🧭 Resumen ejecutivo

**Update 2026-05-22**: Esqueleto Windows aterrizado. Soporte realista a la fecha:

| Camino | Estado | Resultado |
|---|---|---|
| **A. macOS Apple Silicon** | ✅ Validado E2E | 5/5 tools con inferencia real |
| **B. Windows 11 + GPU NVIDIA** | 🧪 Esqueleto funcional | 4/5 tools (Qwen3-TTS bloqueado por MLX). Scripts `scripts/win/*.ps1` existen, backend Rust detecta plataforma, manifests soportan `install_scripts:` dict por plataforma. **Falta validación en una Windows real.** |
| **C. Linux + GPU NVIDIA** | ⚪ TODO | Scripts `scripts/linux/` referenciados en manifests pero no escritos. El backend Rust ya soporta `linux-x64` como key. |

La UI Tauri y el backend Rust son cross-platform por construcción. **El bloqueador duro real es MLX** (Qwen3-TTS) — todos los demás tools usan PyTorch/ONNX/C++ que sí compilan fuera de Apple Silicon, era cuestión de escribir los scripts equivalentes.

Si tu objetivo final es "que muchos usuarios Windows/Linux usen TTS/STT/imágenes sin instalar nada local", el camino más eficiente sigue siendo la **migración AWS** ya documentada (servir las tools desde GPU EC2 + cliente cross-platform desde el navegador).

---

## 📊 Matriz de portabilidad por capa

| Capa del stack | mac-arm64 | Windows | Linux | Intel Mac |
|---|:---:|:---:|:---:|:---:|
| Frontend React + Vite | ✅ | ✅ | ✅ | ✅ |
| Tauri runtime | ✅ | ✅ | ✅ | ✅ |
| Backend Rust (detección de plataforma + shell) | ✅ | ✅ desde 2026-05-22 | ✅ | ✅ |
| Scripts `scripts/mac/*.sh` | ✅ | — | — | ✅ |
| Scripts `scripts/win/*.ps1` | — | ✅ esqueleto | — | — |
| Scripts `scripts/linux/*.sh` | — | — | ⚪ TODO | — |
| Tool: whisper.cpp | ✅ Metal | ✅ CUDA/CPU | ⚪ TODO | ⚠️ CPU only |
| Tool: ComfyUI | ✅ MPS | ✅ CUDA | ⚪ TODO | ⚠️ CPU only |
| Tool: FaceFusion | ✅ CoreML EP | ✅ CUDA EP | ⚪ TODO | ⚠️ CPU only |
| Tool: AceForge | ✅ MPS | ✅ CUDA | ⚪ TODO | ⚠️ CPU only |
| Tool: **Qwen3-TTS (MLX)** | ✅ | ❌ bloqueador | ❌ | ❌ |
| Bundle `.dmg` (Tauri) | ✅ macos-latest CI | — | — | — |
| Bundle `.msi`/`.exe` | — | ⚪ TODO añadir target | — | — |
| Bundle `.AppImage`/`.deb` | — | — | ⚪ TODO | — |
| Filesystem (APFS sparsebundle) | ✅ | — | — | ✅ |

Leyenda: ✅ funciona · ⚠️ requiere trabajo · ❌ no existe / bloqueador duro · — no aplica.

---

## 🔴 Bloqueador duro: MLX (Qwen3-TTS)

[MLX](https://github.com/ml-explore/mlx) es el framework de Apple para machine learning en Apple Silicon. Ventajas: memoria unificada, lazy evaluation, optimizado para Neural Engine. **Limitación**: solo corre en `arm64-darwin`. No hay binarios para Linux ni Windows ni Intel Mac. Tampoco hay roadmap público para portarlo.

**Implicaciones para Qwen3-TTS:**

- Los modelos `mlx-community/Qwen3-TTS-*` están en formato MLX (no compatible con PyTorch directamente)
- El servidor que sirve Qwen3-TTS importa `mlx`, `mlx-lm`, `mlx-audio` — todas fallan en `pip install` en Windows/Linux

**Alternativas si necesitas TTS en Windows/Linux:**

| Reemplazo | Tradeoff |
|---|---|
| Coqui XTTS-v2 | Modelos PyTorch, cross-platform, pero más lento y mayor RAM |
| Piper TTS | Muy ligero (ONNX), excelente CPU, pero menos calidad de voz que Qwen3 |
| F5-TTS | PyTorch, calidad alta, requiere CUDA para velocidad |
| OpenVoice v2 | PyTorch, optimizable a ONNX |

Cualquier alternativa implica:

1. Crear `apps/<nuevo-tts>.yaml` con su manifest
2. Escribir `scripts/<plataforma>/install-<nuevo-tts>.sh` (o `.ps1`)
3. Cambiar UI si la API/output difiere de Qwen3

---

## 🟠 Bloqueador medio: Scripts en bash

`scripts/mac/` tiene **10 scripts bash** que no funcionan tal cual en Windows. Inventario:

| Script | Qué hace | Reescritura Windows |
|---|---|---|
| `common.sh` | Resolución de `studio_home`, detección de Python/uv, helpers de venv | `common.ps1` con `$env:CHOFYAI_STUDIO_HOME`, `Get-Command python` |
| `install-qwen3-tts.sh` | Clona repo + venv + `pip install mlx...` | **No portable** — MLX bloqueador duro |
| `install-whispercpp.sh` | `git clone` + `cmake -B build` con flag Metal | Cambiar a `-DGGML_CUDA=ON` o `-DGGML_VULKAN=ON` |
| `install-comfyui.sh` | venv + PyTorch MPS + symlinks `inputs/outputs` | Cambiar PyTorch a CUDA. Symlinks → junctions en Windows (`mklink /J`) |
| `install-facefusion.sh` | conda-less install + ONNX | Cambiar ONNX provider de CoreML a DirectML/CUDA |
| `install-aceforge.sh` | venv + PyTorch MPS | Cambiar a CUDA |
| `bootstrap.sh` | Verifica brew, python, rust | Verificar chocolatey/winget en Windows |
| `preflight-build.sh` | Pre-flight para `.dmg` | Reescribir para `.msi` |
| `build-release.sh` | Pipeline completo `.app+.dmg` | Reescribir para `.exe`/`.msi` |
| `clean-appledouble.sh` | Borra `._*` (mac-only) | No aplica |
| `doctor.sh` | Diagnóstico | Reescribir; los problemas son distintos |

Backend Rust también tiene asunciones a desmontar:

```rust
// src-tauri/src/system.rs
Command::new("bash")   // ← asume bash en PATH
    .arg(&script)
    .env("CHOFYAI_STUDIO_HOME", ...)
```

En Windows reemplazar por `Command::new("pwsh")` (PowerShell 7) y los scripts a `.ps1`. También revisar:

- Path separators: usar `Path::join` (ya se hace) en vez de literales `/`
- `/Volumes` (mac) vs `D:\` (Windows) — el selector de volúmenes asume `/Volumes/*`
- `hdiutil sparsebundle` no existe en Windows; el equivalente es VHDX dinámico

---

## 🟢 Lo que sí es trivial portar

**El frontend React/Vite es 100% cross-platform.** Si haces:

```bash
# En Windows
git clone <repo>
cd chofyai-studio
pnpm install --frozen-lockfile
pnpm dev:web
```

Levanta `http://localhost:1420` con toda la UI funcionando (los botones invocan a Tauri que no está corriendo en modo web; degradan limpio).

Para el modo desktop completo en Windows necesitas:

```bash
pnpm tauri:dev
```

Esto compila Rust → genera `.exe` Windows nativo. **Compila** sin problemas. Lo que falla es **funcionalidad**: cuando hagas click en "Instalar Qwen3-TTS", el backend Rust intenta `bash scripts/mac/install-qwen3-tts.sh` y falla por dos razones:

1. `bash` no está en el PATH (solucionable con WSL o `git bash`)
2. El script asume MLX, que no instala

---

## 🛠️ Si decides hacer un fork Windows/Linux

Orden razonable de trabajo:

1. **Semana 1** — UI compila y arranca como `.exe`/`.AppImage` con backend Rust degradado (botones deshabilitados con un toast "tool no soportada en esta plataforma"). Esto requiere:
   - Añadir `tauri.windows.conf.json` con `targets: ["msi", "nsis"]`
   - Detectar plataforma en backend Rust (`#[cfg(target_os = "windows")]`) y desactivar `install_tool` cuando manifest no soporte la plataforma
   - Filtrar tools en `list_tools` por `platforms:` del manifest contra `cfg!(target_os = ...)`

2. **Semanas 2–3** — Port de whisper.cpp y FaceFusion (ambos cross-platform en su upstream). Crear `scripts/win/install-whispercpp.ps1` y `scripts/linux/install-whispercpp.sh`. Actualizar manifest:

   ```yaml
   platforms:
     - mac-arm64
     - win-x64
     - linux-x64
   install_scripts:
     mac-arm64: scripts/mac/install-whispercpp.sh
     win-x64: scripts/win/install-whispercpp.ps1
     linux-x64: scripts/linux/install-whispercpp.sh
   ```

   Esto requiere extender `RawManifest` en Rust para soportar el dict por plataforma.

3. **Semanas 4–6** — Port ComfyUI y AceForge a PyTorch CUDA. Refactor de UI para mostrar selector de backend (CUDA/CPU/MPS) en el primer arranque.

4. **Semana 7+** — Decidir destino de Qwen3-TTS. Tres opciones reales:
   - **Marcarla mac-only** y mostrar mensaje en Windows ("esta tool requiere macOS Apple Silicon")
   - **Reemplazarla con alternativa cross-platform** (Coqui/F5/Piper)
   - **Servirla desde un backend cloud** (la migración AWS ya documentada)

---

## 🧪 Test de viabilidad rápido

Si solo quieres confirmar que tu interés es real antes de invertir semanas, haz esto:

```powershell
# Windows: WSL2 con Ubuntu 22
wsl --install -d Ubuntu-22.04
# dentro de WSL:
sudo apt install -y nodejs npm rust cmake ffmpeg python3.10 python3.11 git
git clone https://github.com/vladimiracunadev-create/chofyai-studio
cd chofyai-studio
corepack enable && corepack prepare pnpm@10 --activate
pnpm install --frozen-lockfile
pnpm tauri:dev
```

La UI levantará. Los botones de **whisper.cpp y ComfyUI** funcionarán con tweaks mínimos al script (Metal → CPU). **Qwen3-TTS no instalará** — verás el error de pip al intentar instalar MLX. Eso te da la medida concreta del trabajo restante.

---

## 🔗 Referencias

- [`REQUIREMENTS.md`](REQUIREMENTS.md) — matriz de soporte para usuarios finales (no técnicos)
- [`docs/cloud/AWS_MIGRATION.md`](cloud/AWS_MIGRATION.md) — alternativa: servir las tools desde la nube y dejar el cliente Windows trivialmente cross-platform
- [`decisions.md`](decisions.md) — ADRs que explican por qué Tauri, por qué MLX, etc.
- MLX: <https://github.com/ml-explore/mlx>
- Tauri cross-platform targets: <https://v2.tauri.app/distribute/>
