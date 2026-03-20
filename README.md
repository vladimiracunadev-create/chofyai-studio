# ChofyAI Studio

ChofyAI Studio es una **aplicación de escritorio local para macOS Apple Silicon** orientada a centralizar la instalación, arranque y organización de herramientas creativas de IA.

Su objetivo no es ser un launcher genérico para cualquier repositorio, sino un **orquestador controlado** para un conjunto concreto de herramientas:

- **voz**: TTS y clonación de voz
- **ASR**: transcripción local
- **video/cara**: utilidades de face swap y procesamiento facial
- **música**: herramientas musicales locales
- **gestión**: rutas, logs, scripts, settings y empaquetado macOS

## Estado real del proyecto

**Lo que ya está implementado**

- shell de escritorio con **Tauri 2 + Rust + React/TypeScript**
- lectura de manifests YAML desde `apps/`
- guardado de `studio_home` en `storage/state/settings.json` durante desarrollo
- guardado de `studio_home` en el directorio de datos de la app cuando esta empaquetada
- detección de instalación por archivos/carpetas declarados en `installed_if`
- botones desde la UI para:
  - **Instalar**
  - **Iniciar**
  - **Abrir carpeta**
  - **Abrir log**
- scripts reales de instalación para:
  - **Qwen3-TTS**
  - **whisper.cpp**
  - **FaceFusion**
  - **AceForge**
- preparación de empaquetado macOS (`.app` / `.dmg`) con Tauri

**Lo que todavía no está terminado**

- firma y notarización Apple
- flujo de actualización automática
- cola de instalaciones
- stop / restart / health checks avanzados desde UI
- integración operativa de **ComfyUI**

## Stack técnico

- **Desktop shell**: Tauri 2
- **Core**: Rust
- **UI**: React + TypeScript + Vite
- **Integración de herramientas**: scripts Bash + Python + binarios externos
- **Configuración de herramientas**: manifests YAML

## Herramientas incluidas en esta fase

### Operativas desde la UI
- **Qwen3-TTS**
- **whisper.cpp**
- **FaceFusion**
- **AceForge**

### Declarada pero no integrada en esta fase
- **ComfyUI**

## Estructura del repositorio

```text
chofyai-studio/
├─ apps/                  # manifests YAML por herramienta
├─ docs/                  # documentación del proyecto
├─ public/                # assets estáticos
├─ scripts/mac/           # scripts operativos para macOS
├─ src/                   # frontend React/TypeScript
├─ src-tauri/             # backend Tauri/Rust
├─ storage/               # estado local y placeholders de runtime
├─ package.json
└─ README.md
```

## Documentación incluida

- `docs/PROJECT_OVERVIEW.md` → visión general
- `docs/STATUS.md` → estado actual del repositorio
- `docs/INSTALL_MAC.md` → instalación y ejecución en tu Mac
- `docs/TOOLS.md` → herramientas integradas y sus requisitos
- `docs/TROUBLESHOOTING.md` → problemas comunes
- `docs/packaging.md` → empaquetado `.app` / `.dmg`
- `docs/architecture.md` → arquitectura general
- `docs/decisions.md` → decisiones de diseño
- `ROADMAP.md` → siguientes fases

## Instalación en tu Mac

### 1. Clonar o descomprimir el proyecto

```bash
git clone <TU-REPO>.git
cd chofyai-studio
```

### 2. Verificar prerequisitos

```bash
bash scripts/mac/bootstrap.sh
bash scripts/mac/preflight-build.sh
```

### 3. Instalar dependencias del frontend

```bash
npm install
```

### 4. Ejecutar en modo desarrollo web

```bash
npm run dev:web
```

### 5. Ejecutar como app de escritorio

```bash
npm run tauri:dev
```

## Studio Home

La ruta principal de trabajo se guarda en:

```text
Desarrollo: storage/state/settings.json
App empaquetada: directorio de datos de Tauri + /state/settings.json
```

Ejemplo:

```json
{
  "studio_home": "/Users/tu_usuario/ChofyAIStudio"
}
```

Se recomienda:
- **SSD interno** o volumen **APFS**
- evitar exFAT u otros volúmenes que puedan meter archivos `._*`

## Scripts útiles

```bash
bash scripts/mac/doctor.sh "/ruta/a/tu/studio_home"
bash scripts/mac/install-qwen3-tts.sh
bash scripts/mac/install-whispercpp.sh
bash scripts/mac/install-facefusion.sh
bash scripts/mac/install-aceforge.sh
bash scripts/mac/cleanup-tool.sh "/ruta/studio_home" "tool_id"
```

## Empaquetado macOS

Para generar `.app` y `.dmg` en tu Mac:

```bash
npm ci
npm run package:mac
```

Salidas esperadas:

```text
src-tauri/target/release/bundle/macos/
src-tauri/target/release/bundle/dmg/
```

## Licencia

Este repositorio incluye `LICENSE` de base. Ajusta branding, nombre legal y licencia definitiva antes de distribución pública.
