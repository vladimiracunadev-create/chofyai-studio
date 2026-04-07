# Estado actual del proyecto

> Última actualización: **2026-04-06** · Ver [CHANGELOG.md](../CHANGELOG.md) para historial completo · Ver [ROADMAP.md](../ROADMAP.md) para fases futuras

## Versión del repositorio

**v0.3.0-dev** — Fase 3 implementada: control de procesos, cola de instalaciones y flujo de actualización.

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

```text
/Volumes/ORICO/ChofyIA/ChofyAIStudio
```

## Funciones disponibles

### UI

- Ver resumen del sistema
- Ver y guardar `studio_home`
- Listar herramientas desde manifests YAML
- Detectar si una herramienta está instalada según `installed_if`
- **Instalar** herramienta con progreso en tiempo real (streaming stdout)
- **Actualizar** herramienta ya instalada (re-ejecuta script de instalación)
- **Iniciar** herramienta desde botón
- **Detener** herramienta en ejecución (SIGTERM)
- **Reiniciar** herramienta (stop + start automático)
- **Cola de instalaciones**: encola múltiples herramientas e instala una a una
- **Health check visual**: indicador pulsante verde cuando la herramienta responde en su puerto
- Abrir carpeta de herramienta
- Abrir log de herramienta

### Backend Rust (comandos Tauri)

- `get_system_summary`
- `save_studio_home`
- `list_tools`
- `install_tool` — con streaming de salida vía eventos `install-progress` / `install-done`
- `update_tool` — re-instala sobre una herramienta existente
- `start_tool` — registra PID en `ProcessRegistry`
- `stop_tool` — envía SIGTERM y elimina PID del registro
- `restart_tool` — stop + start en secuencia
- `health_check_tool` — verifica PID vivo + puerto TCP abierto
- `open_tool_directory`
- `open_tool_log`

### Herramientas con integración operativa

- ✅ Qwen3-TTS — requiere python 3.10, uv
- ✅ whisper.cpp — requiere cmake, curl
- ✅ FaceFusion — requiere ffmpeg, python 3.x
- ✅ AceForge — requiere ffmpeg, python 3.x

### Herramientas no operativas aún

- 🚧 ComfyUI — declarada en manifest, sin script de instalación

## Limitaciones actuales

- No hay manejo avanzado de procesos huérfanos entre reinicios de la app
- ComfyUI sigue declarada pero sin integración operativa
- Firma y notarización Apple no incluidas
- Settings avanzados (`models_dir`, `outputs_dir`, `cache_dir`) pendientes

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
