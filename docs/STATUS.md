# Estado actual del proyecto

> Última actualización: **2026-04-07** · Ver [CHANGELOG.md](../CHANGELOG.md) para historial completo · Ver [ROADMAP.md](../ROADMAP.md) para fases futuras

## Versión del repositorio

**v0.2.0** — MVP operativo + base de robustez (Fase 2 iniciada).

## Entorno verificado

| Dependencia | Versión instalada | Estado |
|---|---|---|
| Homebrew | 5.0.14 | ✅ |
| Node.js | 25.6.0 | ✅ |
| npm | 11.8.0 | ✅ |
| Rust / cargo | 1.94.1 | ✅ |
| cmake | 4.3.1 | ✅ |
| ffmpeg | 8.1 | ✅ |
| python 3.10 | 3.10.20 | ✅ |
| python 3.11 | 3.11.15 | ✅ |
| uv | 0.11.3 | ✅ |
| git | 2.50.1 | ✅ |

## Studio Home configurado

```
/Volumes/ORICO/ChofyIA/ChofyAIStudio
```

## Funciones reales disponibles

### UI

- ver resumen del sistema
- ver y guardar `studio_home`
- listar herramientas desde manifests
- ver si una herramienta está instalada según checks
- instalar herramienta desde botón (con backend Tauri activo)
- iniciar herramienta desde botón
- abrir carpeta de herramienta
- abrir log de herramienta

### Backend Rust

- `get_system_summary`
- `save_studio_home`
- `list_tools`
- `install_tool`
- `start_tool`
- `open_tool_directory`
- `open_tool_log`

### Herramientas con integración operativa

- ✅ Qwen3-TTS — requiere python3.10, uv
- ✅ whisper.cpp — requiere cmake, curl
- ✅ FaceFusion — requiere ffmpeg, python3.x
- ✅ AceForge — requiere ffmpeg, python3.x

### Herramientas no operativas aún

- 🚧 ComfyUI — declarada, sin script de instalación

## Limitaciones actuales

- no hay stop / restart desde backend
- no hay health check de red o proceso desde backend
- no hay cola de instalaciones
- no hay manejo avanzado de procesos huérfanos
- ComfyUI sigue declarada pero sin integración operativa
- firma y notarización Apple no incluidas

## Nota sobre modo web vs modo Tauri

| Modo | Comando | Botones de herramientas |
|---|---|---|
| Web (solo frontend) | `npm run dev:web` | ❌ No funcionan (sin backend) |
| Escritorio completo | `npm run tauri:dev` | ✅ Funcionan (Rust activo) |

## Estado de empaquetado

El repo está preparado para:

- `npm run tauri:build:app`
- `npm run tauri:build:dmg`
- `npm run package:mac`

Requiere ejecutarse en Mac real con Rust + Xcode CLT instalados.
