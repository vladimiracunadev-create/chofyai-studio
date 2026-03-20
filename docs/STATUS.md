# Estado actual del proyecto

> Última actualización: **2026-03-20** · Ver [CHANGELOG.md](../CHANGELOG.md) para historial completo · Ver [ROADMAP.md](../ROADMAP.md) para fases futuras

## Versión del repositorio

**v0.2.0** — Estado funcional de referencia: MVP operativo + base de robustez (Fase 2 iniciada).

## Funciones reales disponibles

### UI

- ver resumen del sistema
- ver `studio_home`
- guardar `studio_home`
- listar herramientas desde manifests
- ver si una herramienta esta instalada segun checks
- instalar herramienta desde boton cuando existe integracion real
- iniciar herramienta desde boton
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

### Herramientas con integracion operativa

- Qwen3-TTS
- whisper.cpp
- FaceFusion
- AceForge

### Herramientas no operativas aun

- ComfyUI

## Limitaciones actuales

- no hay stop / restart desde backend
- no hay health check de red o proceso desde backend
- no hay cola de instalaciones
- no hay manejo avanzado de procesos huerfanos
- ComfyUI sigue declarado pero sin integracion operativa
- no hay builds `.app/.dmg` validados en este contenedor
- la firma y notarizacion Apple no estan incluidas

## Estado de empaquetado

El repo si quedo preparado para:

- `npm run tauri:build:app`
- `npm run tauri:build:dmg`
- `npm run package:mac`

En desarrollo, los settings viven en `storage/state/settings.json`.
En una app empaquetada, los settings pasan al directorio de datos de usuario de Tauri.

Pero esos builds deben ejecutarse en un **Mac real** con:

- Xcode / Xcode Command Line Tools
- Rust / cargo
- Node.js / npm

## Recomendacion practica

Usar este repositorio como:

- base tecnica
- repo de producto
- orquestador local controlado

No tratar todavia esta version como distribucion final para terceros.
