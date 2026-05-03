# 🛡️ Política de seguridad

> **Cómo reportar vulnerabilidades en ChofyAI Studio.**

[![Security](https://img.shields.io/badge/Security-Responsible%20Disclosure-2d7a66?logo=shieldsdotio&logoColor=white)](https://github.com/vladimiracunadev-create/chofyai-studio/security)

---

## 📦 Versiones soportadas

| Versión | Soporte de seguridad |
|:---:|:---:|
| `0.5.x` (Fase 5 actual) | ✅ Activa |
| `0.4.x` | ⚠️ Solo bugs críticos |
| `< 0.4.0` | ❌ Sin soporte |

---

## 🤖 Workflow de seguridad automatizado

| Job | Cobertura | Cuándo |
|:---|:---|:---:|
| 🔐 **TruffleHog** | Secret scan (verified only) | push + PR + cron lunes |
| 📦 **npm audit** | Falla PR si hay `high+critical` | si existe `package-lock.json` |
| 🦀 **cargo audit** | Cruza `Cargo.lock` con RustSec | si existe `Cargo.lock` |
| 🔬 **CodeQL** | SAST `security-extended` JS/TS | si existe `package.json` |
| 📌 **Pin actions** | Avisa si alguna acción no está pinneada | siempre |
| 🤖 **Dependabot** | PRs semanales (npm + cargo + actions) | configurado en `.github/dependabot.yml` |

> El workflow `security.yml` es **portable a otros repos** del ecosistema vía `workflow_call` o copia directa. Ver guía completa en [`docs/SECURITY_WORKFLOW.md`](docs/SECURITY_WORKFLOW.md).

---

## 🎯 Alcance

Esta política cubre **exclusivamente el código de ChofyAI Studio**: el launcher Tauri/Rust, el frontend React/TypeScript y los scripts Bash incluidos en este repositorio.

### ❌ Fuera de alcance

- 🤖 Las herramientas de IA de terceros (Qwen3-TTS, whisper.cpp, FaceFusion, AceForge, ComfyUI). Reporta vulnerabilidades en sus repositorios originales.
- 📦 Modelos de ML descargados durante la instalación.
- ⚙️ Configuraciones del sistema operativo o del entorno Python del usuario.

---

## 🚨 Cómo reportar una vulnerabilidad

> [!WARNING]
> **No abras un issue público** para vulnerabilidades de seguridad.

Envía un reporte privado a través de una de estas vías:

| Vía | Cómo |
|:---|:---|
| 🔒 **GitHub Security Advisories** | Botón *"Report a vulnerability"* en la pestaña [Security](https://github.com/vladimiracunadev-create/chofyai-studio/security/advisories) |
| 📧 **Email directo** | Asunto: `[SECURITY] chofyai-studio — <resumen breve>` |

### 📝 Qué incluir en el reporte

- 📋 Descripción clara de la vulnerabilidad y su impacto potencial.
- 🔄 Pasos para reproducir o un proof-of-concept mínimo.
- 🍎 Versión afectada y entorno (macOS, chip Apple Silicon).
- 🛠️ Cualquier mitigación o workaround que hayas identificado.

---

## ⏱️ Tiempo de respuesta esperado

| Fase | Tiempo objetivo |
|:---|:---:|
| 📨 Confirmación de recepción | `48 horas` |
| 🔍 Evaluación inicial | `5 días hábiles` |
| 🩹 Parche liberado (si aplica) | `30 días` |

---

## 🔒 Consideraciones de seguridad del proyecto

### 📜 Ejecución de scripts externos

Los scripts de instalación en `scripts/mac/` ejecutan comandos con privilegios del usuario. Se recomienda:

- 👀 Revisar el contenido de los scripts antes de ejecutarlos.
- 💾 Usar un `studio_home` en un volumen **APFS interno**, no en discos compartidos.

### 🔐 Secretos y credenciales

> [!NOTE]
> ChofyAI Studio **no solicita, almacena ni transmite credenciales**. No hay comunicación de red desde el launcher — toda actividad de red ocurre dentro de las herramientas de IA de terceros.

### 📦 Integridad de dependencias

Las dependencias npm están fijadas en `package-lock.json` y las de Rust en `Cargo.lock`. **Auditar localmente**:

```bash
npm audit --omit=dev --audit-level=high
cd src-tauri && cargo install --locked cargo-audit && cargo audit
```

CI las audita automáticamente en cada push/PR (ver `.github/workflows/security.yml`). Dependabot abre PRs semanales con upgrades agrupados (`@tauri-apps/*`, React, Vitest, etc.).

### 🦀 Memory safety

El backend está escrito en **Rust**, lo que mitiga clases enteras de vulnerabilidades de memoria (use-after-free, buffer overflow). Las llamadas a `unsafe` están limitadas a las generadas por Tauri.
