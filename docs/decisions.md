# 📐 Architecture Decision Records (ADRs)

> **Decisiones técnicas significativas — qué se eligió y por qué.**

[![ADR](https://img.shields.io/badge/Format-ADR-7c5cff)](https://adr.github.io/)
![Decisions](https://img.shields.io/badge/ADRs-5-2d7a66)

Las decisiones técnicas significativas del proyecto se documentan aquí en formato ADR.

---

## 🦀 ADR-001: Tauri 2 + Rust como núcleo del launcher

**Estado**: ✅ Aceptada

### 🧭 Contexto

Se necesita un shell de escritorio nativo en macOS que pueda ejecutar comandos del sistema, leer el sistema de archivos y lanzar procesos externos sin necesitar un runtime pesado. Las alternativas evaluadas fueron Electron y una app Swift nativa.

### 💡 Decisión

Usar **Tauri 2 con Rust** como core y **React + TypeScript** como capa de UI.

### 📊 Consecuencias

- **Positivas**: binario ligero (~5 MB vs ~150 MB de Electron), control fino sobre los comandos del sistema, FFI directo con el OS.
- **Negativas**: la compilación requiere Rust + Xcode en el entorno de desarrollo; no hay hot-reload del backend Rust.
- **Neutras**: el frontend React puede desarrollarse en cualquier OS con `npm run dev:web`.

---

## 🐍 ADR-002: Python como adapter, no como core

**Estado**: ✅ Aceptada

### 🧭 Contexto

La mayoría de las herramientas de IA objetivo (Qwen3-TTS, FaceFusion, AceForge) están escritas en Python. Integrarlas como módulos dentro del proceso principal generaría conflictos de dependencias y acoplaría el ciclo de vida del launcher al de cada herramienta.

### 💡 Decisión

Python solo existe como **proceso externo controlado**: cada herramienta corre en su propio `venv`, es iniciada por un script Bash y el launcher solo gestiona el proceso (start / stop / logs).

### 📊 Consecuencias

- **Positivas**: aislamiento completo de dependencias, crash de una tool no afecta el launcher, actualizaciones independientes.
- **Negativas**: comunicación con la herramienta solo vía HTTP o archivos; no hay API interna tipada.

---

## 💾 ADR-003: APFS o SSD interno como `studio_home`

**Estado**: ✅ Aceptada

### 🧭 Contexto

macOS genera archivos `._*` en volúmenes no nativos (exFAT, FAT32). Los modelos de IA pesan múltiples GB y en discos externos la velocidad de acceso puede ser insuficiente para inferencia local. Algunos installers asumen permisos POSIX que exFAT no soporta.

### 💡 Decisión

El `studio_home` debe residir en un volumen **APFS interno**. El script `bootstrap.sh` advierte si se detecta un esquema no compatible.

### 📊 Consecuencias

- **Positivas**: sin archivos fantasma, permisos correctos, velocidad IO adecuada para modelos grandes.
- **Negativas**: los usuarios con solo un disco pequeño deben gestionar espacio manualmente.

---

## 🎯 ADR-004: Launcher controlado, no marketplace genérico

**Estado**: ✅ Aceptada

### 🧭 Contexto

Herramientas como Pinokio ofrecen un explorador universal de repositorios de IA. El objetivo aquí es diferente: un stack curado y controlado para un perfil de uso específico (creación: voz, video, música).

### 💡 Decisión

ChofyAI Studio solo integra herramientas explícitamente declaradas en `apps/*.yaml`. No hay descubrimiento automático de repositorios externos.

### 📊 Consecuencias

- **Positivas**: comportamiento predecible, sin superficie de ataque por repos arbitrarios, documentación por herramienta posible y completa.
- **Negativas**: añadir una herramienta nueva requiere crear un manifest + script; no hay "un clic para cualquier repo".

---

## 📐 ADR-005: Manifests YAML como contrato de integración

**Estado**: ✅ Aceptada

### 🧭 Contexto

El estado de instalación de una herramienta puede determinarse de múltiples formas: registros del sistema, bases de datos internas, o checks explícitos de rutas. Para mantener el sistema auditable y sencillo de depurar se necesita un contrato legible por humanos.

### 💡 Decisión

Cada herramienta se describe en un archivo YAML (`apps/<id>.yaml`) con campos obligatorios que incluyen `installed_if`: lista de rutas que deben existir para considerar la herramienta instalada.

### 📊 Consecuencias

- **Positivas**: estado de instalación siempre auditable manualmente, fácil de extender sin tocar código Rust, documentación y configuración co-localizadas.
- **Negativas**: requiere mantener los manifests sincronizados con los scripts de instalación; un cambio de ruta en el script que no se refleje en el manifest rompe la detección.

---

## 📐 ADR-006: Sparsebundle APFS como solución oficial para discos externos no-APFS

**Estado**: ✅ Aceptada (v0.5.0)

### 🧭 Contexto

Muchos usuarios mantienen modelos pesados (10–200 GB) en discos externos. Los discos comerciales suelen venir formateados **exFAT** o **HFS+** para portabilidad cross-platform. Pero macOS escribe archivos sidecar `._*` (AppleDouble) en filesystems no-APFS, que rompen la extracción de wheels Python (`numba`, `sympy`, `markupsafe`, `antlr4-python3-runtime`).

Alternativas evaluadas:

- ❌ **Reformatear el disco a APFS** — destruye los datos existentes, no portable a Windows.
- ❌ **Limpiar `._*` periódicamente** (`clean-appledouble.sh`) — frágil, race condition durante instalación.
- ❌ **`UV_LINK_MODE=copy`** — no resuelve el problema porque el contenido del wheel ya tiene entradas problemáticas.

### 💡 Decisión

Crear una imagen elástica APFS sparsebundle (`.sparsebundle`) dentro del disco externo exFAT. La imagen aparece como volumen APFS nativo al montarla; los datos físicamente viven en el disco externo.

```bash
hdiutil create -size 100g -fs APFS -volname ChofyAIStudio \
  -type SPARSEBUNDLE /Volumes/Externo/ChofyAIStudio.sparsebundle
hdiutil attach <bundle> -mountpoint /Volumes/ChofyAIStudio -nobrowse
```

El `Onboarding` paso 1 detecta heurísticamente cuando `studio_home` apunta a `/Volumes/...` y sugiere la receta. `INSTALL_MAC.md` y `TROUBLESHOOTING.md §12` la documentan.

### 📊 Consecuencias

- **Positivas**: wheels Python funcionan sin trampas; portable entre Macs; tamaño elástico (crece on-demand); compresión APFS.
- **Negativas**: requiere `hdiutil attach` al reconectar el disco; no portable a no-Mac; tamaño máximo fijo al crear (resize manual con `hdiutil resize`).

---

## 📐 ADR-007: i18n sin dependencias externas

**Estado**: ✅ Aceptada (v0.5.0, sprint 8)

### 🧭 Contexto

Soporte ES + EN minimal para alcanzar audiencia LATAM y angloparlante. Opciones evaluadas:

- ❌ `react-i18next` — 30 KB gz, configuración compleja, namespaces, lazy load
- ❌ `formatjs` — overkill para 2 idiomas
- ❌ Hardcoded strings — sin opción de switch

### 💡 Decisión

Implementación propia en `src/i18n.ts` (~250 líneas, 0 deps externas):

- Type `Lang = 'es' | 'en'` y `dictionaries: Record<Lang, Dict>`
- `t(key, params?)` con sustitución `{name}` estilo MessageFormat lite
- Hook `useT()` con listener pattern para re-render reactivo
- Persistencia en `localStorage`
- Fallback automático: key faltante → ES → key cruda
- Test de paridad: todas las keys ES deben existir en EN

### 📊 Consecuencias

- **Positivas**: bundle pequeño, comportamiento totalmente controlado, refactor trivial si se decide migrar a una lib.
- **Negativas**: sin pluralización avanzada; sin lazy loading de catálogos (irrelevante para 85 keys).

---

## 📐 ADR-008: Workflow de seguridad portable vía `workflow_call`

**Estado**: ✅ Aceptada (v0.5.0, sprint 5)

### 🧭 Contexto

El usuario mantiene varios repositorios (`chofyai-studio`, `trihorn-chat`, futuros). Replicar el mismo `security.yml` en cada uno crea drift y sobrecarga de mantenimiento. GitHub Actions tiene `workflow_call` para reuso pero requiere diseño portable.

### 💡 Decisión

`security.yml` con `on: workflow_call` habilitado y todos los jobs gated por step-level `if: steps.check.outputs.skip != 'true'` que detectan dinámicamente la presencia de `package-lock.json`, `Cargo.lock`, `package.json`. Los jobs irrelevantes para un repo se saltan silenciosamente.

```yaml
# repo cliente:
jobs:
  security:
    uses: vladimiracunadev-create/chofyai-studio/.github/workflows/security.yml@main
```

### 📊 Consecuencias

- **Positivas**: una sola fuente de verdad; un fix en `chofyai-studio` propaga a N repos clientes; cobertura adaptada por repo (no falla si no hay Cargo.lock).
- **Negativas**: si el repo `chofyai-studio` se cae o el archivo se renombra, los repos clientes pierden CI de seguridad — se mitiga pinneando con SHA específico (`@<sha>` en lugar de `@main`).

---

## 📐 ADR-009: Workflows declarativos en YAML con runner en frontend

**Estado**: ✅ Aceptada (v0.5.0, sprint 7)

### 🧭 Contexto

Los workflows (chains entre tools) requieren un orquestador que ejecute steps secuencialmente, pasando outputs entre ellos. Opciones:

- ❌ Backend Rust con HTTP client + estado de ejecución → mucho código Rust nuevo, errores de tipos
- ❌ Lenguaje custom de scripting → reinventa lo conocido
- ❌ Bash con `jq` → frágil, sin tipos

### 💡 Decisión

Schema declarativo YAML (`workflows/*.yaml`) con steps `type: http|stub`. El **runner vive en el frontend** (`runWorkflowStep` en `App.tsx`) y usa `fetch()` para llamar a los tool servers locales. Sustitución `{{inputs.X}}` en URL/fields/body. Backend Rust solo expone `list_workflows`, `save_workflow`, `delete_workflow` (CRUD).

### 📊 Consecuencias

- **Positivas**: simplicidad — los workflows son data, no código; el runner es trivial (~30 líneas TS); fácil de extender con nuevos `type:` en el frontend.
- **Negativas**: el frontend debe estar abierto para que el workflow corra; sin retry automático ni queueing; auth headers entre tools no soportados (suficiente para servicios locales sin auth).

> Para v1.0 considerar mover el runner al backend (Rust) o a Step Functions en cloud — la migración es mecánica gracias al schema YAML estable.

---

## 📐 ADR-010: Marketplace MVP con catálogo curado local

**Estado**: ✅ Aceptada (v0.5.0, sprint 6)

### 🧭 Contexto

El catálogo base de 5 tools no es suficiente para todos los casos de uso. Los usuarios quieren añadir tools de la comunidad (Bark, RVC, Stable Audio, etc.) pero las opciones eran:

- ❌ Endpoint remoto desde el día 1 → requiere infra cloud, gestión de versiones, rate limit
- ❌ Permitir cualquier URL de manifest → riesgo de seguridad, validación compleja

### 💡 Decisión

Catálogo curado en `marketplace/registry.yaml` empaquetado dentro del `.app`. 10 tools iniciales con descripción, repo, requisitos. Comando `import_marketplace_tool(id)` traduce una entrada a `apps/<id>.yaml` mínimo con notas/hint embebidos como comentarios para que el dev complete `install_script`/`run.command`.

### 📊 Consecuencias

- **Positivas**: experiencia fluida de descubrimiento, sin red ni infra; cada entrada está revisada; UI consistente con manifests locales.
- **Negativas**: añadir tool al catálogo requiere PR a este repo y nuevo release del `.app`; no hay versionado por entrada todavía.

> Migración a catálogo remoto (S3 + repo `community-tools` separado) documentada en `docs/cloud/AWS_MIGRATION.md §3.5`.
