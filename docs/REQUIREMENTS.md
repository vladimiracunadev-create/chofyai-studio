# 📐 Requisitos de hardware y software

> **Qué necesitas para ejecutar ChofyAI Studio. Mínimos, recomendados y plataformas soportadas.**

Este documento consolida lo que estaba disperso entre `INSTALL_MAC.md`, `STATUS.md` y los manifests YAML. La fuente de verdad para versiones validadas sigue siendo [`STATUS.md`](STATUS.md) (snapshot técnico) — aquí está el marco general.

---

## 🖥️ Matriz de soporte por plataforma

| Plataforma | Estado | Razón |
|---|:---:|---|
| 🟢 **macOS 13+ Apple Silicon (M1/M2/M3/M4)** | ✅ Único soportado | Stack diseñado para MLX/Metal/MPS |
| 🔴 macOS Intel | ❌ No soportado | MLX no compila en x86_64; tampoco aprovecha Neural Engine |
| 🔴 Windows 10/11 | ❌ No soportado | Scripts en `bash`, dependencias en Homebrew, MLX inexistente. La UI Tauri compilaría pero ningún botón "Instalar" funcionaría |
| 🔴 Linux | ❌ No soportado | Mismo motivo que Windows — el catálogo de tools está cableado contra el ecosistema Apple |

> 🧭 **¿Y si necesito Windows?** No es un "todavía no", es un "por diseño". Los 5 modelos integrados dependen de MLX (Qwen3-TTS) o de PyTorch con backend Metal/MPS (ComfyUI, FaceFusion, AceForge). Migrar a CUDA + PowerShell sería una bifurcación de producto, no un parche. Si te interesa explorarla, abre un issue antes de invertir tiempo — la decisión de scope es del mantenedor.

---

## 💻 Hardware

### Mínimo funcional (3/5 tools básicas)

| Recurso | Mínimo |
|---|---|
| 🖥️ Chip | Apple **M1** (cualquier variante) |
| 🧠 Memoria unificada | **8 GB** |
| 💾 Disco libre | **50 GB** (instala 2–3 tools sin modelos pesados) |
| 🌐 Red | Banda ancha para la descarga inicial de modelos (~25 GB acumulados) |
| 🍎 macOS | **13 Ventura** |

> ⚠️ Con 8 GB compartidos, modelos grandes (ComfyUI con SDXL, AceForge con ACE-Step) **fallarán o serán inutilizables**. Sirve para Qwen3-TTS pequeño, whisper.cpp y FaceFusion.

### Recomendado (5/5 tools cómodas)

| Recurso | Recomendado |
|---|---|
| 🖥️ Chip | Apple **M2 Pro / M3 / M4** |
| 🧠 Memoria unificada | **16 GB** |
| 💾 Disco libre | **100 GB** APFS (interno o sparsebundle externo) |
| 🌐 Red | Conexión estable; las descargas de modelos cuelgan a veces y conviene reanudable |
| 🍎 macOS | **14 Sonoma** o **15 Sequoia** |

### Óptimo (workflows pesados sin pensarlo)

| Recurso | Óptimo |
|---|---|
| 🖥️ Chip | Apple **M3 Max / M4 Pro / M4 Max** |
| 🧠 Memoria unificada | **24–64 GB** |
| 💾 Disco libre | **200+ GB** APFS interno (los sparsebundle externos limitan throughput de I/O) |
| 🌐 Red | Mejor todavía — los repos HF pueden bajar a 50–80 MB/s con paralelismo |

---

## 📊 Consumo de disco por herramienta

Datos verificados 2026-05-17 (ver [`POSTMORTEM-2026-05-17.md`](POSTMORTEM-2026-05-17.md)):

| Tool | Venv + binarios | Modelos default | Total típico |
|---|---:|---:|---:|
| 🎙️ whisper.cpp | ~300 MB | **141 MB** (small.en) | ~440 MB |
| 🎬 FaceFusion | ~2.5 GB | **~3 GB** (12 ONNX) | ~5.5 GB |
| 🎤 Qwen3-TTS | ~1.5 GB | **7.6 GB** (3 modelos MLX) | ~9 GB |
| 🎵 AceForge | ~1.2 GB | **7.7 GB** (ACE-Step-v1-3.5B) | ~9 GB |
| 🖼️ ComfyUI | ~3 GB | **4 GB** (SD 1.5 base) | ~7 GB |
| **Total 5/5** | ~8.5 GB | ~22.5 GB | **~31 GB** |

Sumar 5–15 GB extra para outputs (audio, imágenes generadas, videos). Si activas modelos extras (SDXL en ComfyUI, voces custom en Qwen3, etc.) cada uno añade 2–8 GB.

---

## 🛠️ Software

### Lo que ChofyAI Studio necesita en tu Mac antes de arrancar

| Dependencia | Versión mínima | Cómo instalar |
|---|---|---|
| 🍎 macOS | 13 Ventura | (sistema) |
| 🛠️ Xcode Command Line Tools | reciente | `xcode-select --install` |
| 🍺 Homebrew | 4.x+ | <https://brew.sh> |
| 📦 Node.js | 20 LTS+ | `brew install node` |
| 🧙 pnpm | 10+ | `corepack enable && corepack prepare pnpm@10 --activate` |
| 🦀 Rust + cargo | 1.76+ | `brew install rust` o `rustup` |
| ⚙️ cmake | 3.x+ | `brew install cmake` (whisper.cpp) |
| 🎞️ ffmpeg | reciente | `brew install ffmpeg` (FaceFusion, AceForge) |
| 🐍 python@3.10 | 3.10.x | `brew install python@3.10` (Qwen3-TTS) |
| 🐍 python@3.11 | 3.11.x | `brew install python@3.11` (ComfyUI) |
| ⚡ uv | reciente (opcional) | `brew install uv` — instalaciones Python 10–100× más rápidas |
| 🌿 git | reciente | Incluido con Xcode CLT |

Comando único:

```bash
brew install node rust cmake ffmpeg python@3.10 python@3.11 uv git
corepack enable && corepack prepare pnpm@10 --activate
```

> Los scripts buscan binarios en `/opt/homebrew/bin` (path por defecto de Homebrew en Apple Silicon). Si usas `rustup`/`pyenv`, asegúrate de que estén en el `PATH` cuando Tauri lanza los procesos.

### Lo que sí o sí trae el sistema operativo

- **Metal** (GPU framework) — usado por whisper.cpp y PyTorch MPS
- **Neural Engine** — usado opcionalmente por modelos optimizados con Core ML
- **Memory unificada** — el factor clave: en Apple Silicon RAM y VRAM son lo mismo, así que "16 GB" sirve igual para CPU y modelos

---

## 💾 Filesystem

### Importante para discos externos

| Filesystem | Soporte | Notas |
|---|:---:|---|
| 🟢 **APFS** (interno o externo) | ✅ Out-of-the-box | Lo único realmente recomendado |
| 🟡 **exFAT/HFS+/NTFS** | ⚠️ Con sparsebundle | Crear imagen APFS dentro del externo. Ver [`INSTALL_MAC.md §Disco externo no-APFS`](INSTALL_MAC.md#-disco-externo-no-apfs) |
| 🟢 **APFS sparsebundle** (sobre cualquier filesystem) | ✅ Recomendado para externos | Trabaja como APFS nativo; ChofyAI Studio auto-monta al arrancar |

> Los wheels Python (`numba`, `sympy`, `markupsafe`, `antlr4-python3-runtime`) tienen scripts ejecutables que **fallan** en filesystems no-APFS por los archivos sidecar `._*` (AppleDouble). El sparsebundle es la única vía oficial para discos exFAT.

---

## 🌐 Red y puertos

ChofyAI Studio **no transmite datos**: la app no abre conexiones de salida. Las descargas las hacen las herramientas individuales (HF Hub, GitHub) durante la instalación o por petición del usuario.

| Tráfico | Origen | Destino | Cuándo |
|---|---|---|---|
| Modelos HF | tu Mac | huggingface.co | Al instalar o usar **📥 Descargar** en ModelsPanel |
| Clones git | tu Mac | github.com | Al instalar tools |
| Wheels pip | tu Mac | pypi.org | Al instalar tools |

Puertos locales que abren las tools (todos en `127.0.0.1`):

| Tool | Puerto |
|---|---:|
| Qwen3-TTS | 7860 |
| AceForge | 7857 |
| FaceFusion | 7862 |
| whisper.cpp | 8178 |
| ComfyUI | 8188 |

---

## 🔌 Dependencias por tool (resumen)

| Tool | Runtime | Aceleración | Modelo base |
|---|---|---|---|
| Qwen3-TTS | Python 3.10 + **MLX** | Neural Engine + Metal | Qwen3-TTS-12Hz-0.6B-Base-8bit |
| whisper.cpp | Binario nativo (C++) | Metal | small.en (configurable) |
| FaceFusion | Python + ONNX Runtime | CoreML / CPU | InsightFace + 12 ONNX |
| AceForge | Python + PyTorch | MPS | ACE-Step-v1-3.5B |
| ComfyUI | Python 3.11 + PyTorch | MPS | SD 1.5 (extensible a SDXL/Flux) |

Detalle por tool: [`docs/TOOLS.md`](TOOLS.md).

---

## 🩺 Verificar tu equipo

Antes de instalar nada:

```bash
# Hardware
system_profiler SPHardwareDataType | grep -E "Chip|Memory"

# Espacio en disco
df -h /

# Software
bash scripts/mac/bootstrap.sh
```

`bootstrap.sh` imprime ✅/⚠️ por cada dependencia y te dice exactamente qué falta.

---

## 📌 TL;DR

- **Mac Apple Silicon con 16 GB y 100 GB libres APFS** = usar todo el producto sin pensar.
- **8 GB / 50 GB / M1 base** = funciona pero solo 3 de 5 tools.
- **Intel Mac / Windows / Linux** = no soportado y no en el roadmap.
