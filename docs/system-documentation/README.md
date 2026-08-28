# Documentación de sistema · ChofyAI Studio

> Estado: completo · Última revisión: 2026-08-27 · Versión analizada: 0.5.1 (commit f840055)

## Qué es este conjunto de documentos

Documentación técnica, funcional, arquitectónica y operativa de **ChofyAI Studio**, un
lanzador de escritorio para macOS que instala, ejecuta y supervisa herramientas de
inteligencia artificial locales (Qwen3-TTS, whisper.cpp, FaceFusion, ComfyUI y AceForge)
sobre Tauri 2, Rust y React.

Se ha escrito leyendo el repositorio desde cero. Cada afirmación apunta a un archivo y a un
símbolo concretos; lo que no se pudo comprobar está marcado como tal.

## Para quién

| Perfil | Empieza por |
|:---|:---|
| Persona sin perfil técnico | [01 · Descripción general](01-system-overview.md), sección final |
| Directivo, cliente o evaluador | [17 · Resumen ejecutivo](17-executive-summary.md) |
| Desarrollador que se incorpora | [18 · Guía para un nuevo desarrollador](18-new-developer-guide.md) |
| Desarrollador con experiencia | [05 · Referencia técnica](05-technical-reference.md) y [06 · Explicación profunda](06-deep-code-explanation.md) |
| Auditor técnico o de seguridad | [11 · Seguridad](11-security.md), [15 · Riesgos y deuda técnica](15-risks-and-technical-debt.md) y [19 · Matriz de trazabilidad](19-traceability-matrix.md) |
| Persona encargada de operación | [13 · Despliegue y operación](13-deployment-and-operations.md) y [14 · Solución de problemas](14-troubleshooting.md) |
| Otro agente de IA que necesite contexto | [04 · Mapa del código](04-code-map.md) y [05 · Referencia técnica](05-technical-reference.md) |

## Índice

| # | Documento | Contenido | Estado |
|:---:|:---|:---|:---|
| 01 | [Descripción general del sistema](01-system-overview.md) | Qué es, qué resuelve, actores, casos de uso, límites y explicación para público no técnico | Completo |
| 02 | [Instalación y ejecución](02-installation-and-execution.md) | Requisitos, dependencias, variables de entorno, desarrollo, producción, pruebas y errores frecuentes | Completo |
| 03 | [Arquitectura](03-architecture.md) | Capas, patrones, comunicación, estado, errores y diagramas de componentes, secuencia y despliegue | Completo |
| 04 | [Mapa del código](04-code-map.md) | Inventario jerárquico de directorios, archivos, módulos, componentes y funciones | Completo |
| 05 | [Referencia técnica](05-technical-reference.md) | Los 35 comandos Tauri, estructuras, funciones, constantes, eventos, puertos y mensajes de error | Completo |
| 06 | [Explicación profunda del código](06-deep-code-explanation.md) | Flujo interno módulo a módulo, decisiones, casos límite y riesgos | Completo |
| 07 | [Base de datos y persistencia](07-database.md) | Ausencia de motor de base de datos, almacenes reales, diccionario de datos y modelo entidad-relación | Completo |
| 08 | [Flujo de datos](08-data-flow.md) | Origen, validación, transformación, almacenamiento, consumo y puntos de pérdida | Completo |
| 09 | [APIs e integraciones](09-apis-and-integrations.md) | IPC de Tauri, APIs HTTP locales y servicios externos | Completo |
| 10 | [Configuración](10-configuration.md) | Todos los archivos de configuración, variables de entorno y consecuencias de un error | Completo |
| 11 | [Seguridad](11-security.md) | Modelo de amenaza, controles presentes y ausentes, y riesgos priorizados | Completo |
| 12 | [Pruebas y calidad](12-testing-and-quality.md) | Inventario de pruebas, resultados reales de ejecución, herramientas de calidad y propuesta priorizada | Completo |
| 13 | [Despliegue y operación](13-deployment-and-operations.md) | Entornos, construcción, empaquetado, CI/CD, operación diaria, respaldo y mantenimiento | Completo |
| 14 | [Solución de problemas](14-troubleshooting.md) | Guía por síntoma con diagnóstico, solución y riesgos | Completo |
| 15 | [Riesgos y deuda técnica](15-risks-and-technical-debt.md) | 21 hallazgos con evidencia, severidad y recomendación, más lo que no es deuda | Completo |
| 16 | [Glosario](16-glossary.md) | Vocabulario técnico y de dominio en lenguaje accesible | Completo |
| 17 | [Resumen ejecutivo](17-executive-summary.md) | Visión para decidir: capacidades, estado, fortalezas, riesgos y próximos pasos | Completo |
| 18 | [Guía para un nuevo desarrollador](18-new-developer-guide.md) | Itinerario de lectura, entorno, recorrido guiado, cómo extender y qué no tocar | Completo |
| 19 | [Matriz de trazabilidad](19-traceability-matrix.md) | 49 funcionalidades desde la interfaz hasta la persistencia y sus pruebas | Completo |

Recursos adicionales:

- [`pdf/`](pdf/) — versión en PDF de cada documento, generada desde el Markdown.
- [`assets/`](assets/) — imágenes y recursos gráficos de la documentación.

## Convenciones

1. **El Markdown es la única fuente de verdad.** Los PDF se derivan de él con
   `node scripts/docs/build-pdf.mjs`; nunca al revés.
2. **Cada afirmación es rastreable.** Se citan rutas reales
   (`src-tauri/src/system.rs`) y símbolos reales (`resolve_effective_home`).
3. **Lo no verificado se declara.** Se usan las marcas `No identificado`,
   `No documentado en el repositorio`, `Requiere validación` e
   `Inferencia basada en el código`.
4. **Sin secretos.** Todos los ejemplos usan valores ficticios. Los secretos de CI/CD se
   nombran, nunca se reproducen.
5. **Los diagramas acompañan al texto, no lo sustituyen.** Todo diagrama Mermaid va seguido de
   su explicación.
6. **Este conjunto no corrige el código.** Los hallazgos se registran en
   [15 · Riesgos y deuda técnica](15-risks-and-technical-debt.md) y en
   [11 · Seguridad](11-security.md), sin aplicar cambios funcionales.
7. **Formato validado con markdownlint** según [`../../.markdownlint.json`](../../.markdownlint.json).

## Alcance del análisis

| Aspecto | Valor |
|:---|:---|
| Fecha del análisis | 2026-08-27 |
| Versión analizada | 0.5.1 según `package.json` y `src-tauri/Cargo.toml` |
| Commit base | `f840055` |
| Archivos de código analizados | Todo `src/`, `src-tauri/src/`, `scripts/`, `apps/`, `workflows/`, `marketplace/`, `.github/workflows/` y la configuración raíz |
| Líneas de código propias | Aproximadamente 7600, sin contar dependencias ni recursos generados |
| Comprobaciones ejecutadas | `pnpm test` (20 pruebas, correctas), `cargo test --no-default-features` (4 pruebas, correctas), `pnpm exec tsc --noEmit` (sin errores) |

## Pendiente de validación

Puntos que este análisis no pudo confirmar y que requieren comprobación en ejecución o una
decisión del responsable del proyecto:

1. **Soporte real de Windows** (F-47): los scripts de `scripts/win/` existen y son coherentes,
   pero no consta ninguna validación de extremo a extremo.
2. **Soporte de Linux** (F-48): declarado en los manifiestos, sin scripts en el repositorio.
3. **Endpoints HTTP de las herramientas** distintos de whisper.cpp y ComfyUI: el repositorio
   no los ejercita.
4. **Bind de red de AceForge**: el script sólo sustituye el número de puerto; que escuche
   exclusivamente en `127.0.0.1` depende del código del proyecto original.
5. **Discrepancia de versiones** entre `package.json`, `Cargo.toml`, `tauri.conf.json` y
   `APP_VERSION`: hay que decidir cuál es la correcta.
6. **Convivencia de dos árboles de documentación** (`docs/` y `docs/system-documentation/`):
   requiere decidir cuál es la fuente de verdad por tema.
7. **Campos de manifiesto inertes** (`python_manager`, `healthcheck`, `install`, `notes`): hay
   que implementarlos o retirarlos.

## Cómo regenerar los PDF

```bash
node scripts/docs/build-pdf.mjs            # todos los documentos
node scripts/docs/build-pdf.mjs 03         # sólo los que empiezan por "03"
CHOFYAI_SKIP_MERMAID=1 node scripts/docs/build-pdf.mjs   # sin renderizar diagramas
```

Requisitos: Node 18 o superior, y Chrome, Chromium, Edge o Brave instalado (o la variable
`CHOFYAI_CHROME` apuntando al binario). La primera ejecución necesita conexión para cachear
`mermaid.min.js`; después funciona sin red.
