# 🏗️ Arquitectura

> **Capas, responsabilidades y flujos del orquestador.**

[![Tauri](https://img.shields.io/badge/Tauri-2.11-FFC131?logo=tauri&logoColor=black)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-1.94-CE422B?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)

---

## 🎯 1. Principio central

> **La app de escritorio _no_ debe ejecutar modelos dentro del proceso de UI.**

Sus responsabilidades:

- 🔍 Descubrir herramientas (lectura de manifests YAML)
- ✅ Validar instalación (`installed_if`)
- 📜 Orquestar scripts (bash con streaming de stdout)
- 🗺️ Centralizar rutas y logs (`studio_home` + `tool_overrides`)
- 🩺 Exponer diagnóstico (health checks + stats)

---

## 🧱 2. Capas

```mermaid
flowchart TD
    UI["⚛️ UI<br/>React + TypeScript + Vite<br/>localhost:1420"]
    Core["🦀 Core<br/>Tauri 2 + Rust<br/>(IPC commands)"]
    Resolver["🧭 Resolver<br/>resolve_effective_home<br/>(disco dual + fallback)"]
    Registry["📋 ProcessRegistry<br/>Mutex<HashMap<id, pid>>"]
    Scripts["📜 Scripts<br/>Bash por herramienta"]
    Tools["🛠️ Herramientas IA<br/>(venv / binarios / modelos)"]
    Storage["💾 Storage<br/>studio_home (APFS recomendado)"]

    UI -->|invoke| Core
    Core --> Resolver
    Core --> Registry
    Core -->|spawn + stream stdout| Scripts
    Scripts -->|instala/arranca en| Storage
    Scripts -->|lanza proceso| Tools
    Tools -->|HTTP :puerto| UI
    Core -->|lee manifests + settings| Storage
    Core -->|stats: top/vm_stat/df| UI

    style UI fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style Core fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    style Resolver fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    style Registry fill:#e8eaf6,stroke:#1a237e,stroke-width:2px
    style Scripts fill:#f1f8e9,stroke:#33691e,stroke-width:2px
    style Tools fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    style Storage fill:#eceff1,stroke:#37474f,stroke-width:2px
```

---

## 🧩 3. Componentes por capa

### ⚛️ UI (React + TypeScript)

| Pieza | Responsabilidad |
|:---|:---|
| `App.tsx` | Estado global, listeners de eventos Tauri |
| `StatusBar` | Barra inferior con CPU/RAM/disco, refresco 3 s |
| `VolumePicker` | Selector de volúmenes con espacio libre |
| `HealthDot` | Indicador pulsante por tool |
| `types.ts` | Contratos tipados con el backend |

### 🦀 Core (Tauri 2 + Rust)

| Módulo | Responsabilidad |
|:---|:---|
| `lib.rs` | Builder Tauri + registro de comandos |
| `system.rs` | Comandos IPC, resolución de paths, ejecución de scripts |
| `models.rs` | Structs serializables (`SystemSummary`, `ToolSummary`, `SystemStats`, …) |
| `ProcessRegistry` | `Mutex<HashMap<id, pid>>` para tracking de procesos |

### 📜 Scripts (Bash)

| Script | Función |
|:---|:---|
| `common.sh` | `resolve_studio_home`, PATH para Homebrew |
| `install-*.sh` | Clona/compila/configura cada herramienta |
| `doctor.sh` | Diagnóstico de entorno |
| `clean-appledouble.sh` | Limpia `._*` (volúmenes no-APFS) |

---

## 💾 4. Resolución de rutas

```mermaid
flowchart LR
    A["📝 settings.json<br/>studio_home"] --> B{"💾 Volumen<br/>usable?"}
    B -->|✅| C["studio_home_effective"]
    B -->|❌| D["fallback_home<br/>o ~/ChofyAIStudio"]
    C --> E{"🔍 Override<br/>en tool_overrides[id]?"}
    D --> E
    E -->|✅| F["📍 Ruta absoluta del override"]
    E -->|❌| G["studio_home/tools/&lt;id&gt;<br/>(o studio_home_subdir del manifest)"]

    style A fill:#fff3e0,stroke:#e65100
    style B fill:#fff8e1,stroke:#f57f17
    style C fill:#e8f5e9,stroke:#1b5e20
    style D fill:#ffebee,stroke:#b71c1c
    style E fill:#f3e5f5,stroke:#4a148c
    style F fill:#e0f2f1,stroke:#004d40
    style G fill:#e3f2fd,stroke:#0d47a1
```

---

## 🔄 5. Flujo de instalación

```mermaid
sequenceDiagram
    participant U as 👤 Usuario
    participant UI as ⚛️ UI
    participant Core as 🦀 Core
    participant Script as 📜 Script
    participant Tool as 🛠️ Tool

    U->>UI: Click "Instalar Qwen3-TTS"
    UI->>Core: invoke('install_tool', {toolId})
    Core->>Core: load_settings + resolve_effective_home
    Core->>Script: bash install-qwen3-tts.sh<br/>CHOFYAI_STUDIO_HOME=...
    loop Cada línea de stdout
        Script-->>Core: stdout
        Core-->>UI: emit('install-progress', {tool_id, line})
        UI-->>U: muestra progreso
    end
    Script-->>Core: exit code
    Core-->>UI: emit('install-done', {tool_id, OK/ERROR})
    Core->>Core: escribe logs/qwen3-tts-install.log
    UI-->>U: ✅ tool marcada como instalada
```

---

## 📐 6. Reglas de diseño

- 💾 `studio_home` debe vivir en SSD interno o APFS (workaround disponible para no-APFS).
- 🏝️ Cada herramienta usa su propio subdirectorio.
- ✅ Estado **instalado** = condición explícita del manifest (`installed_if`).
- 🚫 Nunca confiar solo en un mensaje visual genérico.
- 📋 Cada herramienta debe tener al menos `install_script` y `installed_if` claros.

---

## 📐 7. Estado mínimo por manifest

```yaml
id: nombre-tool
name: Display Name
category: voice|asr|video|image|music|system
runtime: python|binary|node|mlx|mixed
install_script: scripts/mac/install-X.sh
run:
  command: "...comando para arrancar..."
installed_if:
  - rutas/relativas/que/deben/existir
default_port: 8888  # si aplica
```

> Ver detalle completo en [`MANIFEST_SPEC.md`](MANIFEST_SPEC.md).

---

## 🔮 8. Dirección futura

| Eje | De | A |
|:---|:---|:---|
| Procesos | `kill -TERM` directo | Supervisión + autorestart |
| Health | TCP port + PID | HTTP probe + métricas |
| Sidecars | bash | Tauri sidecars binarios |
| Empaquetado | Ad-hoc | Apple Developer ID + notarización |
| Catálogo | 5 tools | Plugins externos por manifest |

> Ver [`../ROADMAP.md`](../ROADMAP.md) y [`decisions.md`](decisions.md).
