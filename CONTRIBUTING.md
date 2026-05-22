# 🤝 Guía de contribución

> **Cómo aportar a ChofyAI Studio: entorno, flujo y estándares.**

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-2d7a66?logo=github)](https://github.com/vladimiracunadev-create/chofyai-studio/pulls)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-FE5196?logo=conventionalcommits&logoColor=white)](https://www.conventionalcommits.org/)

¡Gracias por tu interés en contribuir! Este documento explica cómo preparar el entorno, el flujo de trabajo esperado y cómo añadir soporte para una nueva herramienta.

---

## 📋 Requisitos previos

| Herramienta | Versión mínima | Notas |
|:---|:---:|:---|
| 🍎 macOS | `13 Ventura` | Apple Silicon requerido para uso real |
| 🛠️ Xcode CLT | reciente | `xcode-select --install` |
| 🦀 Rust + cargo | `1.76+` | Instalado vía `rustup` |
| 📦 Node.js | `22 LTS` | Recomendado: `nvm` |
| 📥 pnpm | `10+` | `corepack enable && corepack prepare pnpm@10 --activate` |
| ⚡ Tauri CLI | `v2` | `cargo install tauri-cli` |

> [!NOTE]
> Los builds de `.app` / `.dmg` **requieren un Mac real**. El desarrollo del frontend puede hacerse en cualquier sistema con `pnpm dev:web`.
>
> Este proyecto usa **pnpm** (no npm) como gestor de paquetes — ver [`docs/PACKAGE_MANAGER.md`](docs/PACKAGE_MANAGER.md) para la justificación de seguridad.

---

## 🚀 Preparar el entorno de desarrollo

```bash
# 1️⃣ Clonar el repositorio
git clone https://github.com/vladimiracunadev-create/chofyai-studio.git
cd chofyai-studio

# 2️⃣ Verificar requisitos (solo macOS)
bash scripts/mac/bootstrap.sh

# 3️⃣ Instalar dependencias del frontend
pnpm install --frozen-lockfile

# 4️⃣ Modo web (sin Rust, solo para UI)
pnpm dev:web

# 5️⃣ App de escritorio completa (requiere macOS + Rust)
pnpm tauri:dev
```

---

## 🔄 Flujo de trabajo

```mermaid
flowchart LR
    A["🍴 Fork"] --> B["🌿 Branch<br/>feat/mi-cambio"]
    B --> C["💻 Código<br/>+ tipos"]
    C --> D["📝 Docs<br/>actualizadas"]
    D --> E["📋 CHANGELOG<br/>[Unreleased]"]
    E --> F["✅ Tests<br/>locales"]
    F --> G["📤 PR"]

    style A fill:#fff3e0,stroke:#e65100
    style B fill:#fff8e1,stroke:#f57f17
    style C fill:#e3f2fd,stroke:#0d47a1
    style D fill:#f3e5f5,stroke:#4a148c
    style E fill:#e8f5e9,stroke:#1b5e20
    style F fill:#fce4ec,stroke:#880e4f
    style G fill:#e0f2f1,stroke:#004d40
```

1. **🍴 Crea un fork** del repositorio y trabaja sobre una rama descriptiva:

   ```bash
   git checkout -b feat/nombre-de-tu-cambio
   ```

2. **💻 Escribe código limpio**: TypeScript tipado, Rust con manejo de errores explícito.
3. **📝 Actualiza la documentación** relevante en `docs/` si tu cambio afecta arquitectura, tools o scripts.
4. **📋 Actualiza `CHANGELOG.md`** en la sección `[Unreleased]` describiendo tu cambio.
5. **📤 Abre un Pull Request** con una descripción clara del problema y la solución.

---

## 🛠️ Añadir una nueva herramienta

ChofyAI Studio usa manifests YAML en `apps/` para declarar herramientas. El proceso completo:

### 1️⃣ Crear el manifest

Crea `apps/tu-herramienta.yaml` siguiendo la especificación en [`docs/MANIFEST_SPEC.md`](docs/MANIFEST_SPEC.md).

### 2️⃣ Crear el script de instalación

Crea `scripts/mac/install-tu-herramienta.sh` con:

- ✅ verificación de `studio_home`
- 📥 clonación o descarga de la herramienta
- 🐍 creación de entorno (`venv` o similar)
- 📋 registro del resultado en el log de la herramienta

### 3️⃣ Declarar el `installed_if`

Define en el manifest al menos una condición de instalación real (ruta de archivo o binario que debe existir).

### 4️⃣ Probar localmente

```bash
pnpm tauri:dev
# Verificar que la tool aparece, el check de instalación funciona
# y los botones de instalar/iniciar responden correctamente
```

### 5️⃣ Correr la suite de tests

```bash
pnpm test                       # Vitest — unit tests del frontend (parsers, formatters)
pnpm test:rust                  # cargo test — tests del backend (PIDs, paths, traversal)
pnpm exec tsc --noEmit          # typecheck TypeScript estricto
pnpm dlx markdownlint-cli2 "**/*.md"   # lint de docs
```

CI corre automáticamente todo lo anterior + auditoría de seguridad (TruffleHog, pnpm/cargo audit, CodeQL) en cada PR. Ver [`docs/SECURITY_WORKFLOW.md`](docs/SECURITY_WORKFLOW.md).

### 6️⃣ Documentar

Añade la herramienta a [`docs/TOOLS.md`](docs/TOOLS.md) con su rol, script, checks de instalación y observaciones relevantes.

---

## 📐 Convenciones

### 📝 Commits — Conventional Commits

```text
feat: añadir integración de Bark TTS
fix: corregir detección de puerto ocupado en whisper.cpp
docs: actualizar MANIFEST_SPEC con campo optional_port
chore: actualizar dependencias pnpm
```

### ⚛️ TypeScript

- ✅ Usa tipos explícitos; evita `any`.
- ✅ Los comandos Tauri deben estar tipados en `src/types.ts`.

### 📜 Scripts Bash

- ✅ Siempre checar `CHOFYAI_STUDIO_HOME` antes de operar (vía `common.sh::resolve_studio_home`).
- ✅ Redirigir stdout/stderr al log de la herramienta.
- ✅ Usar `set -euo pipefail` al inicio del script.
- ✅ Probar en disco externo no-APFS — los `._*` no deben aparecer en el árbol del repo.

---

## 🐛 Reportar bugs

Usa la plantilla en `.github/ISSUE_TEMPLATE/bug_report.md`. Incluye:

- 🍎 versión del OS y chip (M1/M2/M3/M4)
- 💻 comando exacto que falló
- 📋 contenido del log relevante (en `studio_home/logs/<tool_id>.log`)

---

## 💛 Código de conducta

Tratar a todos los colaboradores con respeto. Discusiones técnicas con argumentos, sin descalificaciones personales.
