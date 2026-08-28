# 19 · Matriz de trazabilidad

> Estado: completo · Última revisión: 2026-08-27 · Versión analizada: 0.5.1 (commit f840055)

Permite seguir cualquier funcionalidad desde el control de la interfaz hasta el comando, la
función del backend, el recurso externo, la persistencia afectada y su prueba. Sirve para
auditar cobertura, para medir el impacto de un cambio y para saber dónde mirar cuando algo
falla.

Estados de validación usados:

- **Verificado en código**: existe y se ha leído la implementación completa.
- **Requiere validación**: existe, pero su comportamiento en ejecución no se pudo comprobar
  en este análisis.
- **No implementado**: declarado en algún sitio pero sin implementación.

## 1. Matriz principal

| ID | Funcionalidad | Regla de negocio | Entrada en la interfaz | Comando Tauri | Backend | Script o recurso | Persistencia | Prueba | Documento | Estado |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| F-01 | Ver resumen del sistema | Debe distinguirse la ruta solicitada de la efectiva | `OverviewModal`, `StatusBar` | `get_system_summary` | `system.rs` → `get_system_summary` | — | Lee `settings.json` | Sin prueba | [03](03-architecture.md) | Verificado en código |
| F-02 | Elegir Studio Home | Cualquier ruta es aceptada; vacío ⇒ `~/ChofyAIStudio` | `VolumePicker`, `SettingsModal`, `Onboarding` | `save_studio_home` | `save_studio_home` | — | Escribe `settings.json` | Sin prueba | [10](10-configuration.md) | Verificado en código |
| F-03 | Listar volúmenes candidatos | Disco principal más todo `/Volumes`, con espacio y permisos | `VolumePicker` | `list_volume_candidates` | `list_volume_candidates`, `read_disk_usage`, `is_writable_dir` | `df` | Sonda temporal en disco | Sin prueba | [05](05-technical-reference.md) | Verificado en código |
| F-04 | Reserva automática de ruta | Si la ruta no es usable: montar sparsebundle; si falla, usar la de reserva | Aviso en `StatusBar` | Implícito en todos | `resolve_effective_home`, `path_is_usable` | `hdiutil attach` | Puede crear directorios | **Sin prueba** | [06](06-deep-code-explanation.md) | Verificado en código |
| F-05 | Configurar modelos, salidas y caché | Cadena vacía limpia el override | `SettingsModal` | `save_path_settings`, `get_effective_paths` | `effective_models_dir` y análogas, `apply_path_env` | Variables `CHOFYAI_*_DIR` | Escribe `settings.json` | Sin prueba | [10](10-configuration.md) | Verificado en código |
| F-06 | Listar herramientas | `installed` se calcula comprobando `installed_if` en disco | Rejilla de tarjetas | `list_tools` | `collect_manifests`, `manifest_install_dir` | `apps/*.yaml` | Sólo lectura | Validación de campos en CI | [04](04-code-map.md) | Verificado en código |
| F-07 | Instalar una herramienta | Plataforma soportada, script existente y `installed_if` cumplido al terminar | Botón *Instalar* + `PreInstallCheck` | `install_tool` | `run_install_script` | `scripts/mac/install-*.sh` | Log de instalación, árbol de la herramienta | Sin prueba | [06](06-deep-code-explanation.md) | Verificado en código |
| F-08 | Instalar por lotes | Secuencial, nunca en paralelo | Cola de instalación | `install_tool` repetido | Igual que F-07 | Igual que F-07 | Igual que F-07 | Sin prueba | [08](08-data-flow.md) | Verificado en código |
| F-09 | Ver progreso de instalación | Traducir la salida cruda a fases legibles | Barra y mini-terminal de la cola | Eventos `install-progress` / `install-done` | Hilo lector en `run_install_script` | — | — | **`src/utils.test.ts`** (10 pruebas de `parseInstallLine`) | [05](05-technical-reference.md) | Verificado en código |
| F-10 | Actualizar una herramienta | Sólo si ya está instalada | Botón *Actualizar* | `update_tool` | `update_tool` → `run_install_script` | `git pull --ff-only` en el script | Log de instalación | Sin prueba | [05](05-technical-reference.md) | Verificado en código |
| F-11 | Arrancar una herramienta | Validar `installed_if` y liberar el puerto antes del arranque | Botón *Iniciar* | `start_tool` | `start_tool` | `lsof`, `kill -9`, `bash -lc` | `processes.json`, `<tool>-run.log` | Sin prueba | [06](06-deep-code-explanation.md) | Verificado en código |
| F-12 | Detener una herramienta | `SIGTERM` y baja del registro | Botón *Detener* | `stop_tool` | `stop_tool` | `kill -TERM` | `processes.json` | Sin prueba | [05](05-technical-reference.md) | Verificado en código |
| F-13 | Reiniciar una herramienta | Detener, esperar 800 ms y arrancar | Botón *Reiniciar* | `restart_tool` | `restart_tool` | `kill -TERM`, `bash -lc` | `processes.json`, `<tool>-run.log` | Sin prueba | [15](15-risks-and-technical-debt.md) | Verificado en código |
| F-14 | Comprobar salud | Proceso vivo y puerto abierto; tolerancia de 60 s tras el arranque | Indicador de la tarjeta | `health_check_tool` | `health_check_tool`, `pid_is_alive` | `kill -0`, TCP con 2 s de espera | Limpia PID muertos | Parcial: `pid_alive_*` en Rust | [06](06-deep-code-explanation.md) | Verificado en código |
| F-15 | Restaurar procesos al arrancar | Conservar sólo los PID vivos | Aviso al iniciar | `list_running_pids` | `restore_registry` | `kill -0` | Reescribe `processes.json` | Sin prueba | [06](06-deep-code-explanation.md) | Verificado en código |
| F-16 | Ver la interfaz embebida | Sólo si hay puerto y responde | Botón *Ver UI* | Ninguno: `iframe` directo | — | `http://127.0.0.1:<puerto>/` | — | Sin prueba | [09](09-apis-and-integrations.md) | Verificado en código |
| F-17 | Abrir la carpeta de la herramienta | Crear el directorio si no existe | Botón 📁 | `open_tool_directory` | `open_in_system` | `open` | Puede crear el directorio | Sin prueba | [05](05-technical-reference.md) | Verificado en código |
| F-18 | Ver registros | Sólo `install` o `run`; cola de 500 líneas por defecto | `LogsViewer` | `read_tool_log` | `read_tool_log` | Archivos de log | Sólo lectura | Sin prueba | [13](13-deployment-and-operations.md) | Verificado en código |
| F-19 | Abrir el log en el sistema | Prioriza `run.log` sobre `install.log` | Botón 📋 | `open_tool_log` | `open_in_system` | `open` | — | Sin prueba | [05](05-technical-reference.md) | Verificado en código |
| F-20 | Listar modelos en disco | Profundidad 3, sin archivos de sistema, ordenados por tamaño | `ModelsPanel` | `list_tool_models` | `list_tool_models` | `walkdir` | Sólo lectura | Sin prueba | [07](07-database.md) | Verificado en código |
| F-21 | Listar modelos declarados | Cruce entre `manifest.models` y el disco | `ModelsPanel` | `list_declared_models` | `safe_model_name`, `dir_size` | `apps/*.yaml` | Crea el directorio de modelos | Sin prueba | [07](07-database.md) | Verificado en código |
| F-22 | Descargar un modelo | Sólo repositorios declarados en el manifiesto | Botón *Descargar* | `download_tool_model` | `download_tool_model` | `scripts/mac/download-hf-model.sh`, Hugging Face | Modelo y log de descarga | Sin prueba | [09](09-apis-and-integrations.md) | Verificado en código |
| F-23 | Borrar un modelo | Prohibido salir del directorio de modelos; sólo archivos | Botón de borrado | `delete_tool_model` | Guardia con `canonicalize` | — | Borra del disco | **Prueba existente que no ejercita la función** | [11](11-security.md) | Verificado en código |
| F-24 | Reubicar una herramienta | Destino absoluto, distinto y vacío | Botón *Mover* | `relocate_module` | `relocate_module`, `copy_dir_recursive` | — | Mueve archivos y escribe `settings.json` | Sin prueba | [05](05-technical-reference.md) | Verificado en código |
| F-25 | Quitar el override de ubicación | No mueve archivos | Botón *Reset ruta* | `clear_module_override` | `clear_module_override` | — | Escribe `settings.json` | Sin prueba | [05](05-technical-reference.md) | Verificado en código |
| F-26 | Detectar procesos huérfanos | Identificación por puerto declarado | `OrphanBanner`, `OrphansModal` | `list_orphan_ports` | `list_orphan_ports` | `lsof -Fpc` | Sólo lectura | Sin prueba | [08](08-data-flow.md) | Verificado en código |
| F-27 | Adoptar un huérfano | Sólo si el PID sigue vivo | Botón *Adoptar* | `adopt_orphan` | `adopt_orphan` | `kill -0` | `processes.json` | Sin prueba | [05](05-technical-reference.md) | Verificado en código |
| F-28 | Matar un huérfano | Envía `SIGTERM` | Botón *Matar* | `kill_orphan` | `kill_orphan` | `kill -TERM` | — | Sin prueba | [05](05-technical-reference.md) | Verificado en código |
| F-29 | Estadísticas del sistema | Refresco cada 3 s, sin histórico | `StatusBar` | `get_system_stats` | `read_cpu_usage` y análogas | `sysctl`, `vm_stat`, `top`, `df` | — | Parcial: `read_disk_usage_returns_two_values` | [05](05-technical-reference.md) | Verificado en código |
| F-30 | Ejecutar el doctor | Devuelve la salida cruda del script | `DoctorModal` | `run_doctor` | `run_doctor` | `scripts/mac/doctor.sh` | — | Sin prueba | [13](13-deployment-and-operations.md) | Verificado en código |
| F-31 | Notificación nativa | Al terminar una instalación | Automática | `notify_macos` | `notify_macos` | `osascript` | — | Sin prueba | [11](11-security.md) | Verificado en código |
| F-32 | Registrar fallos de la interfaz | Persistir el error para poder investigarlo | `AppErrorBoundary` | `append_crash_log`, `read_crash_log` | Ambos comandos | — | `crash.log` | Sin prueba | [07](07-database.md) | Verificado en código |
| F-33 | Listar workflows | Ordenados por `id`, ignorando `._*` | `WorkflowsPanel` | `list_workflows` | `list_workflows` | `workflows/*.yaml` | Sólo lectura | Sin prueba | [09](09-apis-and-integrations.md) | Verificado en código |
| F-34 | Crear y guardar un workflow | Id restringido y cuatro campos obligatorios | `WorkflowBuilder` | `save_workflow` | `validate_workflow_id`, `buildYaml` | `workflows/<id>.yaml` | Escribe el archivo | Sin prueba | [05](05-technical-reference.md) | Verificado en código |
| F-35 | Borrar un workflow | Debe existir | Botón de borrado | `delete_workflow` | `delete_workflow` | — | Borra el archivo | Sin prueba | [05](05-technical-reference.md) | Verificado en código |
| F-36 | Ejecutar un workflow HTTP | Sustituir variables y ejecutar paso a paso | `WorkflowRunner` | Ninguno: `fetch` directo | `runWorkflowStep`, `substituteVars` | API HTTP de la herramienta | — | Sin prueba | [09](09-apis-and-integrations.md) | Requiere validación |
| F-37 | Pasos `stub` de workflow | Devuelven una nota sin ejecutar nada | `WorkflowRunner` | — | `runWorkflowStep` | — | — | Sin prueba | [09](09-apis-and-integrations.md) | Verificado en código |
| F-38 | Listar el marketplace | Catálogo local en YAML | `MarketplacePanel` | `list_marketplace_tools` | `list_marketplace_tools` | `marketplace/registry.yaml` | Sólo lectura | Sin prueba | [05](05-technical-reference.md) | Verificado en código |
| F-39 | Importar del marketplace | Nunca sobrescribe; el manifiesto queda incompleto a propósito | Botón *Importar* | `import_marketplace_tool` | `import_marketplace_tool` | — | Escribe `apps/<id>.yaml` | Sin prueba | [15](15-risks-and-technical-debt.md) | Verificado en código |
| F-40 | Asistente inicial | Se muestra una sola vez | `Onboarding` | `save_studio_home`, `install_tool` | — | — | `localStorage` | Sin prueba | [01](01-system-overview.md) | Verificado en código |
| F-41 | Paleta de comandos | Acciones dependientes del estado de cada herramienta | `CommandPalette` (`⌘K`) | Varios | — | — | — | Sin prueba | [04](04-code-map.md) | Verificado en código |
| F-42 | Atajos de teclado | Once atajos globales | Efecto de teclado en `App` | Varios | — | — | — | Sin prueba | [04](04-code-map.md) | Verificado en código |
| F-43 | Tema claro, oscuro y del sistema | Persistente entre sesiones | Botón de tema (`⌘B`) | — | `applyTheme` | — | `localStorage` | Sin prueba | [10](10-configuration.md) | Verificado en código |
| F-44 | Idioma español e inglés | Cambio en caliente, con paridad de diccionarios | Botón de idioma | — | `setLang`, `t`, `useT` | — | `localStorage` | **`src/i18n.test.ts`** (7 pruebas) | [05](05-technical-reference.md) | Verificado en código |
| F-45 | Aviso de nueva versión | Compara con el último release publicado | `UpdateChecker` | Ninguno: `fetch` directo | — | API de GitHub | — | Sin prueba | [09](09-apis-and-integrations.md) | Verificado en código |
| F-46 | Modo web sin backend | La interfaz sigue navegable con datos simulados | Toda la aplicación | Ninguno | `tauriInvoke`, `fallbackTools` | — | — | Sin prueba | [13](13-deployment-and-operations.md) | Verificado en código |
| F-47 | Instalación en Windows | Paridad funcional con macOS | Igual que F-07 | `install_tool` | `run_install_script`, `script_shell` | `scripts/win/*.ps1` | Igual que F-07 | Sin prueba | [15](15-risks-and-technical-debt.md) | Requiere validación |
| F-48 | Instalación en Linux | Igual que F-07 | Igual que F-07 | `install_tool` | Falla con `No existe script` | `scripts/linux/*` **inexistente** | — | Sin prueba | [15](15-risks-and-technical-debt.md) | **No implementado** |
| F-49 | Generación de la documentación en PDF | El Markdown es la única fuente | Línea de órdenes | — | — | `scripts/docs/build-pdf.mjs`, Chrome, mermaid | `docs/system-documentation/pdf/` | Sin prueba | [13](13-deployment-and-operations.md) | Verificado en código |

## 2. Trazabilidad inversa: comando → funcionalidades

| Comando | Funcionalidades |
|:---|:---|
| `get_system_summary` | F-01 |
| `save_studio_home` | F-02, F-40 |
| `save_path_settings` | F-05 |
| `get_effective_paths` | F-05 |
| `list_volume_candidates` | F-03 |
| `get_system_stats` | F-29 |
| `list_tools` | F-06, y refresco tras F-07, F-10, F-24, F-39 |
| `install_tool` | F-07, F-08, F-40, F-47, F-48 |
| `update_tool` | F-10 |
| `start_tool` | F-11 |
| `stop_tool` | F-12 |
| `restart_tool` | F-13 |
| `health_check_tool` | F-14, y habilita F-16 |
| `list_running_pids` | F-15 |
| `open_tool_directory` | F-17 |
| `open_tool_log` | F-19 |
| `read_tool_log` | F-18 |
| `list_tool_models` | F-20 |
| `list_declared_models` | F-21 |
| `download_tool_model` | F-22 |
| `delete_tool_model` | F-23 |
| `relocate_module` | F-24 |
| `clear_module_override` | F-25 |
| `list_orphan_ports` | F-26 |
| `adopt_orphan` | F-27 |
| `kill_orphan` | F-28 |
| `run_doctor` | F-30 |
| `notify_macos` | F-31 |
| `append_crash_log` | F-32 |
| `read_crash_log` | F-32 |
| `list_workflows` | F-33 |
| `save_workflow` | F-34 |
| `delete_workflow` | F-35 |
| `list_marketplace_tools` | F-38, F-39 |
| `import_marketplace_tool` | F-39 |

Los 35 comandos tienen al menos una funcionalidad asociada: no hay comandos muertos.

## 3. Cobertura documental

| Documento | Qué cubre | Funcionalidades |
|:---|:---|:---|
| [01 · Descripción general](01-system-overview.md) | Propósito, actores, casos de uso | F-40 y visión de conjunto |
| [02 · Instalación y ejecución](02-installation-and-execution.md) | Requisitos, arranque, pruebas, PDF | F-46, F-49 |
| [03 · Arquitectura](03-architecture.md) | Capas, patrones, diagramas | F-01, transversal |
| [04 · Mapa del código](04-code-map.md) | Inventario de archivos y símbolos | F-41, F-42, transversal |
| [05 · Referencia técnica](05-technical-reference.md) | Firmas, tipos, errores | Todas |
| [06 · Explicación profunda](06-deep-code-explanation.md) | Flujo interno | F-04, F-07, F-11, F-14, F-15 |
| [07 · Base de datos y persistencia](07-database.md) | Almacenes y esquemas | F-20, F-21, F-32 |
| [08 · Flujo de datos](08-data-flow.md) | Recorrido del dato | F-08, F-22, F-26, F-36 |
| [09 · APIs e integraciones](09-apis-and-integrations.md) | IPC, HTTP local, servicios externos | F-16, F-22, F-33, F-36, F-45 |
| [10 · Configuración](10-configuration.md) | Archivos, variables, entornos | F-02, F-05, F-43 |
| [11 · Seguridad](11-security.md) | Amenazas y controles | F-23, F-31 |
| [12 · Pruebas y calidad](12-testing-and-quality.md) | Cobertura real y propuesta | F-09, F-44 |
| [13 · Despliegue y operación](13-deployment-and-operations.md) | Build, CI/CD, operación | F-18, F-30, F-46, F-49 |
| [14 · Solución de problemas](14-troubleshooting.md) | Síntomas y soluciones | Transversal |
| [15 · Riesgos y deuda](15-risks-and-technical-debt.md) | Hallazgos priorizados | F-13, F-39, F-47, F-48 |
| [16 · Glosario](16-glossary.md) | Vocabulario | Transversal |
| [17 · Resumen ejecutivo](17-executive-summary.md) | Visión para decidir | Transversal |
| [18 · Guía para nuevos desarrolladores](18-new-developer-guide.md) | Incorporación | F-07 como recorrido guiado |
| [19 · Matriz de trazabilidad](19-traceability-matrix.md) | Este documento | Todas |

## 4. Huecos detectados

### Funcionalidades sin ninguna prueba automatizada

De las 49 funcionalidades, **45 no tienen prueba**. Sólo tienen cobertura real F-09
(interpretación del progreso de instalación) y F-44 (idiomas); F-14 y F-29 tienen cobertura
parcial en Rust; y F-23 tiene una prueba que **no ejercita** la función de producción.

Las cinco ausencias más graves, por consecuencia y por frecuencia de uso:

1. **F-04 · Reserva automática de ruta** — si falla, el usuario pierde de vista todas sus
   herramientas. Es el mecanismo más crítico y el menos protegido.
2. **F-23 · Borrado de modelos** — el control de seguridad más importante del backend, con una
   prueba que aparenta cubrirlo sin hacerlo.
3. **F-07 · Instalación** — el flujo central del producto.
4. **F-11 · Arranque** — incluye el `kill -9` a procesos ajenos.
5. **F-06 · Listado de herramientas** — un manifiesto inválido vacía la lista entera.

### Funcionalidades sin implementación

- **F-48 · Instalación en Linux**: declarada en `platforms:` de cuatro manifiestos, sin
  scripts en el repositorio.

### Funcionalidades que requieren validación en ejecución

- **F-36 · Ejecución de workflows HTTP**: depende de que los endpoints de whisper.cpp y
  ComfyUI sean los declarados en las versiones instaladas.
- **F-47 · Instalación en Windows**: los scripts existen y son coherentes, pero no consta
  ninguna validación de extremo a extremo.

### Ausencias de documentación

No se ha detectado ninguna funcionalidad implementada que quede sin documentar en este
conjunto. Las tres que dependen de terceros (F-16, F-36, F-45) están documentadas con sus
salvedades explícitas.
