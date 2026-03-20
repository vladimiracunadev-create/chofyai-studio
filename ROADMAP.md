# ROADMAP

## Fase 0 - Base del proyecto
- [x] Nombre de producto
- [x] Estructura inicial del repositorio
- [x] Base Tauri + Rust + React
- [x] Manifests YAML iniciales
- [x] Scripts macOS por herramienta

## Fase 1 - MVP local
- [x] Guardado de `studio_home`
- [x] Detección de instalación por `installed_if`
- [x] Apertura de carpeta desde la UI
- [x] Apertura de logs desde la UI
- [x] Instalación desde la UI para Qwen3-TTS
- [x] Instalación desde la UI para whisper.cpp
- [x] Instalación desde la UI para FaceFusion
- [x] Instalación desde la UI para AceForge
- [x] Arranque básico desde la UI

## Fase 2 - Robustez del launcher
- [ ] Stop / Restart por herramienta
- [ ] Health checks reales por proceso / puerto
- [ ] Detección de puertos ocupados
- [ ] Cola de instalación con progreso
- [ ] Reintentos y limpieza automática
- [ ] Registro interno de herramientas instaladas

## Fase 3 - UX y operación
- [ ] Multi-window
- [ ] Menús más completos
- [ ] Settings avanzados (`models_dir`, `outputs_dir`, `cache_dir`)
- [ ] Export / Import de configuración
- [ ] Doctor ampliado
- [ ] Reporte de diagnóstico exportable

## Fase 4 - Producto instalable
- [x] Base de empaquetado `.app` / `.dmg`
- [ ] **Configurar Mac Mini como Self-Hosted Runner para GitHub Actions**
- [ ] Build validado en macOS real
- [ ] Branding e iconografía final
- [ ] Firma Apple
- [ ] Notarización
- [ ] Canal de releases

## Fase 5 - Expansión de herramientas
- [ ] Integración real de ComfyUI
- [ ] Nuevos adapters creativos
- [ ] Sidecars / binarios dedicados
- [ ] Gestión de modelos más avanzada
