# Política de seguridad — ChofyAI Studio

## Versiones soportadas

| Versión | Soporte de seguridad |
|---|---|
| 0.2.x (actual) | ✅ Activa |
| 0.1.x | ⚠️ Solo bugs críticos |
| < 0.1.0 | ❌ Sin soporte |

---

## Alcance

Esta política cubre **exclusivamente el código de ChofyAI Studio**: el launcher Tauri/Rust, el frontend React/TypeScript y los scripts Bash incluidos en este repositorio.

**Fuera de alcance:**

- Las herramientas de IA de terceros (Qwen3-TTS, whisper.cpp, FaceFusion, AceForge, ComfyUI). Reporta vulnerabilidades en sus repositorios originales.
- Modelos de ML descargados durante la instalación.
- Configuraciones del sistema operativo o del entorno Python del usuario.

---

## Cómo reportar una vulnerabilidad

**No abras un issue público** para vulnerabilidades de seguridad.

Envía un reporte privado a través de una de estas vías:

1. **GitHub Security Advisories**: usa el botón "Report a vulnerability" en la pestaña *Security* del repositorio.
2. **Email directo**: con el asunto `[SECURITY] chofyai-studio — <resumen breve>`.

### Qué incluir en el reporte

- Descripción clara de la vulnerabilidad y su impacto potencial.
- Pasos para reproducir o un proof-of-concept mínimo.
- Versión afectada y entorno (macOS, chip Apple Silicon).
- Cualquier mitigación o workaround que hayas identificado.

---

## Tiempo de respuesta esperado

| Fase | Tiempo objetivo |
|---|---|
| Confirmación de recepción | 48 horas |
| Evaluación inicial | 5 días hábiles |
| Parche liberado (si aplica) | 30 días |

---

## Consideraciones de seguridad del proyecto

### Ejecución de scripts externos

Los scripts de instalación en `scripts/mac/` ejecutan comandos con privilegios del usuario. Se recomienda:

- Revisar el contenido de los scripts antes de ejecutarlos.
- Usar un `studio_home` en un volumen **APFS interno**, no en discos externos o compartidos.

### Secretos y credenciales

ChofyAI Studio **no solicita, almacena ni transmite credenciales**. No hay comunicación de red desde el launcher (toda actividad de red ocurre dentro de las herramientas de IA de terceros).

### Integridad de dependencias

Las dependencias npm están fijadas en `package-lock.json`. En proyectos derivados, se recomienda auditar con:

```bash
npm audit
```
