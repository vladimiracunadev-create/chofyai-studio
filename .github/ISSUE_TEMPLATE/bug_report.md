---
name: Bug Report
about: Reporta un problema concreto en ChofyAI Studio
title: "[BUG] "
labels: bug
assignees: ''
---

## Descripción del problema

<!-- Una descripción clara y concisa de qué está fallando. -->

## Pasos para reproducir

1. Abre la app desde `npm run tauri:dev` o desde el `.app` empaquetado
2. Configura `studio_home` en: ...
3. Haz clic en: ...
4. Observas: ...

## Comportamiento esperado

<!-- Qué debería ocurrir en lugar del error. -->

## Comportamiento actual

<!-- Qué ocurre realmente. Incluye mensajes de error exactos. -->

## Capturas o logs

<!-- Pega el contenido relevante del log de la herramienta si aplica: -->

```
$STUDIO_HOME/logs/<tool_id>.log
```

## Entorno

| Campo | Valor |
|---|---|
| macOS versión | ej. macOS 15 Sequoia |
| Chip | ej. Apple M4 |
| Versión de ChofyAI Studio | ej. v0.2.0 |
| Node.js | `node --version` |
| Rust | `rustc --version` |
| Tauri CLI | `cargo tauri --version` |
| Modo de ejecución | `tauri:dev` / `.app` empaquetado |

## Contexto adicional

<!-- Cualquier información que pueda ayudar a diagnosticar el problema. -->
