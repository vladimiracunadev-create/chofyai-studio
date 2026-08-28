# 10 · Configuración

> Estado: completo · Última revisión: 2026-08-27 · Versión analizada: 0.5.1 (commit f840055)

Inventario de todo lo configurable del sistema: qué archivo, qué campo, quién lo lee, qué
pasa si falta y qué se rompe si está mal. La instalación paso a paso está en
[02 · Instalación y ejecución](02-installation-and-execution.md).

## 1. Mapa de archivos de configuración

| Archivo | Ámbito | Lo consume |
|:---|:---|:---|
| `package.json` | Frontend y tareas | pnpm, Vite, Vitest, CI |
| `pnpm-lock.yaml` | Dependencias exactas | pnpm con `--frozen-lockfile` |
| `.npmrc` | Registro y endurecimiento de pnpm | pnpm |
| `tsconfig.json` | Compilación de TypeScript | `tsc --noEmit`, Vite |
| `vite.config.ts` | Servidor de desarrollo y build | Vite |
| `src-tauri/Cargo.toml` | Paquete y dependencias Rust | Cargo |
| `src-tauri/tauri.conf.json` | Configuración base de Tauri | Tauri CLI y runtime |
| `src-tauri/tauri.macos.conf.json` | Sobrescritura para el empaquetado de macOS | `pnpm tauri:build:mac` |
| `src-tauri/capabilities/default.json` | Permisos del WebView | Runtime de Tauri |
| `src-tauri/Info.plist` | Metadatos del `.app` | macOS |
| `src-tauri/Entitlements.plist` | Permisos de firma | Firma de código de macOS |
| `.cargo/config.toml` | Directorio de build de Cargo | Cargo |
| `.markdownlint.json`, `.markdownlint-cli2.jsonc`, `.markdownlintignore` | Reglas de Markdown | markdownlint-cli2, CI |
| `.gitignore` | Exclusiones del repositorio | Git |
| `.github/dependabot.yml` | Actualización de dependencias | Dependabot |
| `storage/state/settings.json` | Estado del usuario | Backend Rust y scripts |
| `apps/*.yaml` | Catálogo de herramientas | `collect_manifests` |
| `marketplace/registry.yaml` | Catálogo importable | `list_marketplace_tools` |
| `workflows/*.yaml` | Pipelines | `list_workflows` |

## 2. `storage/state/settings.json`

Es el único archivo de configuración que el usuario modifica de forma habitual, casi siempre
sin editarlo a mano. Su esquema es exactamente la struct `AppSettings` de
[`src-tauri/src/models.rs`](../../src-tauri/src/models.rs).

| Campo | Tipo | Obligatorio | Valor por defecto | Efecto |
|:---|:---|:---:|:---|:---|
| `studio_home` | `String` | sí | `$HOME/ChofyAIStudio` | Raíz donde se instalan y ejecutan las herramientas |
| `tool_overrides` | `Map<String, String>` | no | `{}` | Ruta alternativa por herramienta; absoluta o relativa al home |
| `fallback_home` | `String \| null` | no | `null` | Destino si el `studio_home` no es usable; vacío ⇒ `$HOME/ChofyAIStudio` |
| `sparsebundle_path` | `String \| null` | no | `null` | Imagen APFS que se intenta montar antes de caer al fallback |
| `models_dir` | `String \| null` | no | `null` | Override de `<studio_home>/models` |
| `outputs_dir` | `String \| null` | no | `null` | Override de `<studio_home>/outputs` |
| `cache_dir` | `String \| null` | no | `null` | Override de `<studio_home>/cache` |

Ejemplo con valores ficticios:

```jsonc
{
  "studio_home": "/Volumes/EJEMPLO/ChofyAIStudio",
  "tool_overrides": {
    "comfyui": "/Volumes/OtroDisco/modules/comfyui"
  },
  "fallback_home": null,
  "sparsebundle_path": "/Volumes/EJEMPLO/ChofyAIStudio.sparsebundle",
  "models_dir": null,
  "outputs_dir": null,
  "cache_dir": null
}
```

Comportamiento verificado:

- Todos los campos salvo `studio_home` llevan `#[serde(default)]`, así que un archivo
  antiguo sin ellos se lee sin problema.
- Si el JSON está corrupto o falta `studio_home`, `load_settings` **no falla**: devuelve la
  configuración por defecto completa. El usuario pierde su configuración sin recibir aviso.
- Quién escribe este archivo: `save_studio_home`, `save_path_settings`, `relocate_module` y
  `clear_module_override`, todos a través de `save_settings_to_disk`, que serializa con
  formato legible y hace un `fs::write` **no atómico**.
- Dónde vive: ejecutando desde el repositorio, en `storage/state/settings.json`; desde el
  `.app` empaquetado, en `<app_data_dir>/state/settings.json`. Lo decide `app_paths()`.

Junto a este archivo se escribe `processes.json` (mapa `tool_id` → PID) y `crash.log`.

## 3. Variables de entorno

| Variable | Quién la define | Quién la lee | Efecto |
|:---|:---|:---|:---|
| `CHOFYAI_STUDIO_HOME` | El backend, antes de lanzar cualquier script | `resolve_studio_home` en `scripts/mac/common.sh` y `Resolve-StudioHome` en `scripts/win/common.ps1` | Fija la raíz de instalación para el script |
| `CHOFYAI_MODELS_DIR` | `apply_path_env` | `resolve_models_dir` (Bash) / `Resolve-ModelsDir` (PowerShell) | Override del directorio de modelos |
| `CHOFYAI_OUTPUTS_DIR` | `apply_path_env` | `resolve_outputs_dir` | Override del directorio de salidas |
| `CHOFYAI_CACHE_DIR` | `apply_path_env` | `resolve_cache_dir` | Override del directorio de caché |
| `STUDIO_HOME` | El usuario, al ejecutar un script a mano | `resolve_studio_home` | Alternativa a la anterior |
| `CHOFYAI_DISABLE_UV` | El usuario | `detect_uv` | Con valor `1`, fuerza `python -m venv` + pip clásico |
| `HF_HOME` | `scripts/mac/install-qwen3-tts.sh` | Cliente de Hugging Face | Ubica la caché de modelos bajo el Studio Home |
| `UV_LINK_MODE` | El mismo script, con valor `copy` | `uv` | Evita enlaces duros entre sistemas de archivos distintos |
| `GRADIO_SERVER_NAME`, `GRADIO_SERVER_PORT` | El `run.command` de FaceFusion | Gradio | Fuerzan el bind local y el puerto |
| `CHOFYAI_CHROME` | El usuario | `findChrome()` en `scripts/docs/build-pdf.mjs` | Ruta al navegador para generar los PDF |
| `CHOFYAI_SKIP_MERMAID` | El usuario | `ensureMermaid()` | Con valor `1`, genera los PDF sin renderizar diagramas |

Regla de precedencia en los scripts, tal como está implementada en `common.sh`:
`CHOFYAI_STUDIO_HOME` → `STUDIO_HOME` → el campo `studio_home` leído del `settings.json` →
`$HOME/ChofyAIStudio`. Y si el resultado no es un directorio usable, se cae igualmente al
valor por defecto, replicando lo que hace Rust.

## 4. Claves de `localStorage`

Sólo afectan a la interfaz y viven en el perfil del WebView del usuario.

| Clave | Valores | Escrita en |
|:---|:---|:---|
| `chofyai_theme` | `dark`, `light`, `system` | Efecto de tema en `App` |
| `chofyai_lang` | `es`, `en` | `setLang` en `src/i18n.ts` |
| `chofyai_onboarding_done` | Cualquier valor no vacío | Al terminar el asistente |

Todos los accesos están envueltos en `try/catch`: si el almacenamiento no está disponible,
la aplicación usa los valores por defecto (`dark`, `es`, onboarding visible).

## 5. Configuración del frontend

### 5.1 `package.json`

| Campo | Valor | Por qué importa |
|:---|:---|:---|
| `version` | `0.5.1` | Es la versión que se muestra al usuario vía `CARGO_PKG_VERSION`… salvo que `APP_VERSION` en `src/App.tsx` dice `0.5.0` |
| `type` | `module` | Todo el proyecto es ESM |
| `packageManager` | `pnpm@10.29.3` | Corepack instala exactamente esa versión; es una medida de cadena de suministro |
| `pnpm.onlyBuiltDependencies` | `["esbuild"]` | Sólo ese paquete puede ejecutar scripts de instalación; bloquea `postinstall` arbitrarios de dependencias transitivas |
| `scripts` | ver [05 · Referencia técnica](05-technical-reference.md) | Puerta de entrada a todas las tareas |

### 5.2 `.npmrc`

```text
registry=https://registry.npmjs.org/
strict-peer-dependencies=false
resolution-mode=highest
audit-level=high
```

`strict-peer-dependencies=false` evita que un desajuste de peers detenga la instalación;
tiene la contrapartida de esconder incompatibilidades reales. `audit-level=high` alinea la
auditoría local con la que ejecuta el workflow de seguridad.

### 5.3 `tsconfig.json`

Los valores que más consecuencias tienen: `strict: true`, `noEmit: true` (compila sólo para
comprobar; el bundle lo genera Vite), `moduleResolution: "bundler"`, `jsx: "react-jsx"`,
`isolatedModules: true` y `include: ["src"]` — lo que significa que `scripts/` y los archivos
de configuración **no** pasan por el chequeo de tipos.

### 5.4 `vite.config.ts`

Puerto `1420` con `strictPort: true` y `host: '127.0.0.1'`. `strictPort` es deliberado: si
el puerto está ocupado, Vite falla en vez de cambiarse, porque `devUrl` en
`tauri.conf.json` apunta exactamente a ese número. `clearScreen: false` conserva la salida
de Cargo en la terminal durante `tauri:dev`.

## 6. Configuración del backend y del empaquetado

### 6.1 `src-tauri/Cargo.toml`

Versión `0.5.1`, edición 2021 y cinco dependencias: `serde`, `serde_json`, `serde_yaml`,
`thiserror` y `tauri`, más `walkdir`. `thiserror` está declarado pero no se usa para definir
errores propios: todos los comandos devuelven `Result<_, String>`.

### 6.2 `src-tauri/tauri.conf.json`

| Clave | Valor | Comentario |
|:---|:---|:---|
| `productName` / `mainBinaryName` | `ChofyAI Studio` | Nombre del `.app` |
| `version` | `0.5.0` | **No coincide** con `package.json` ni con `Cargo.toml` |
| `identifier` | `cl.vladimiracuna.chofyai.studio` | Identificador del bundle |
| `build.beforeDevCommand` / `beforeBuildCommand` | `pnpm dev:web` / `pnpm build:web` | Acoplan Tauri a pnpm |
| `build.devUrl` | `http://localhost:1420` | Debe coincidir con `vite.config.ts` |
| `build.frontendDist` | `../dist` | Salida de Vite |
| `app.windows[0]` | 1400×920, mínimo 1100×760 | Ventana principal `main` |
| `app.security.csp` | `null` | Sin política de contenido; necesario para el `iframe`, analizado en [11 · Seguridad](11-security.md) |
| `bundle.targets` | `["app", "dmg"]` | Artefactos generados |
| `bundle.resources` | `../apps`, `../docs`, `../scripts/mac`, `../marketplace`, `../workflows`, `../storage/state/settings.json` | Lo que viaja dentro del `.app` |

El bloque `bundle.resources` es la razón por la que la aplicación empaquetada encuentra los
manifiestos y los scripts: cuando `repo_root()` devuelve `None`, todo se resuelve con
`BaseDirectory::Resource`. Añadir una herramienta nueva con un script fuera de
`scripts/mac/` haría que funcionara en desarrollo y fallara empaquetada.

### 6.3 `src-tauri/tauri.macos.conf.json`

Sobrescritura usada por `pnpm tauri:build:mac`: `minimumSystemVersion: "13.0"`,
`bundleVersion: "1"` y la geometría de la ventana del DMG.

### 6.4 `src-tauri/capabilities/default.json`

Concede `core:default` a la ventana `main`. Es el conjunto mínimo: no hay plugins de Tauri
habilitados.

### 6.5 `Info.plist` y `Entitlements.plist`

`Info.plist` declara soporte de alta resolución, conmutación automática de gráficos y la
categoría `public.app-category.developer-tools`.

`Entitlements.plist` habilita tres permisos de firma: `allow-jit`,
`allow-unsigned-executable-memory` y `disable-library-validation`. Son necesarios para
ejecutar intérpretes y librerías nativas de terceros (Python, MLX, ONNX Runtime), y a la vez
relajan protecciones del sistema: es una concesión consciente, documentada aquí para el
auditor.

### 6.6 `.cargo/config.toml`

```toml
[build]
target-dir = "/tmp/chofyai-target"
```

Existe porque en volúmenes que no son APFS macOS crea archivos AppleDouble (`._*`) que Cargo
y Tauri intentan interpretar como TOML o UTF-8 y rompen la compilación. Consecuencia
operativa: los artefactos de build **no** están bajo `src-tauri/target/`, sino en `/tmp`, y
se pierden al reiniciar el equipo.

## 7. Configuración de calidad y automatización

| Archivo | Contenido relevante |
|:---|:---|
| `.markdownlint.json` | `default: true` con MD013 (longitud de línea), MD012 (líneas en blanco múltiples) y MD060 desactivadas; MD033 (HTML) permitido; MD024 con `siblings_only`; MD041 activa |
| `.markdownlint-cli2.jsonc` | Ignora `**/._*`, `node_modules/**` y `src-tauri/target/**` |
| `.markdownlintignore` | Mismo propósito, para invocaciones directas del CLI |
| `.gitignore` | Excluye `node_modules/`, `dist/`, `._*`, `src-tauri/target/`, `src-tauri/gen/`, `/tmp/chofyai-target/`, `*.log`, `storage/state/settings.local.json` y `storage/state/runtime/` |
| `.github/dependabot.yml` | Tres ecosistemas —npm, cargo y github-actions— semanales los lunes, con agrupación de PR para Tauri, React y Vitest |

Nota sobre `.gitignore`: `storage/state/settings.json` **sí** está versionado, y el archivo
del repositorio contiene rutas del equipo del autor. No es un secreto, pero sí información
del entorno; se comenta en [11 · Seguridad](11-security.md).

## 8. Diferencias entre entornos

| Aspecto | Desarrollo web (`pnpm dev:web`) | Escritorio (`pnpm tauri:dev`) | Producción (`.app`) |
|:---|:---|:---|:---|
| Backend | Ausente | Presente | Presente |
| `inTauri` | `false` | `true` | `true` |
| Datos mostrados | `fallbackTools` simuladas | Reales | Reales |
| `repo_root()` | — | Devuelve la raíz del repositorio | Devuelve `None` |
| Manifiestos | — | `apps/` del repositorio | Recursos del bundle |
| `settings.json` | — | `storage/state/` | `<app_data_dir>/state/` |
| Scripts | — | `scripts/mac/` del repositorio | Recursos del bundle |
| Directorio de build | — | `/tmp/chofyai-target` | `/tmp/chofyai-target` |

Esta tabla explica la mayoría de los "en mi máquina funciona" del proyecto: el mismo binario
resuelve rutas distintas según cómo se ejecute.

## 9. Banderas de comportamiento

No hay un sistema formal de *feature flags*. Lo que existe funciona como tal:

| Bandera | Dónde | Efecto |
|:---|:---|:---|
| `CHOFYAI_DISABLE_UV=1` | Entorno | Fuerza pip clásico en todas las instalaciones Python |
| `CHOFYAI_SKIP_MERMAID=1` | Entorno | Genera los PDF sin renderizar diagramas |
| `chofyai_onboarding_done` | `localStorage` | Oculta el asistente inicial |
| `platforms:` en un manifiesto | YAML | Oculta o habilita la herramienta según la plataforma |
| `recommended:` en un manifiesto | YAML | Muestra la etiqueta "recomendada" |
| `models:` en un manifiesto | YAML | Habilita la descarga guiada de modelos |
| `default_port:` en un manifiesto | YAML | Habilita health check por puerto, *Ver UI* y detección de huérfanos |

## 10. Configuraciones sensibles y consecuencias de un error

| Parámetro mal configurado | Síntoma observable | Dónde se manifiesta |
|:---|:---|:---|
| `studio_home` a una ruta inexistente o no escribible | La aplicación arranca en fallback y "desaparecen" las herramientas | `resolve_effective_home`; la barra de estado muestra el aviso |
| `studio_home` en un volumen exFAT | Fallan los entornos virtuales y los enlaces simbólicos | Scripts de instalación |
| `sparsebundle_path` incorrecto | El auto-montaje no ocurre y se cae al fallback sin explicación | `resolve_effective_home` |
| `tool_overrides` apuntando a un directorio que ya no existe | La herramienta figura como no instalada | `manifest_install_dir` + `installed_if` |
| `models_dir` en un disco lento o desconectado | Descargas y arranques lentos o fallidos | Variables `CHOFYAI_*_DIR` en los scripts |
| `default_port` duplicado entre dos manifiestos | Una herramienta mata a la otra al arrancar | Pre-flight de puerto en `start_tool` |
| `installed_if` mal declarado | La herramienta nunca se da por instalada, o se da por instalada estando rota | `list_tools`, `run_install_script`, `start_tool` |
| `run.command` con rutas equivocadas | El proceso arranca y muere; el log queda casi vacío | `start_tool`, `<tool>-run.log` |
| `devUrl` y el puerto de Vite desalineados | Ventana en blanco en `tauri:dev` | Tauri |
| `bundle.resources` sin un directorio nuevo | Funciona en desarrollo y falla empaquetado | `script_path`, `app_paths` |
| Categoría o runtime fuera de la lista permitida | Falla el job `validate-manifests` en CI | `.github/workflows/ci.yml` |

## 11. Gestión de secretos

El repositorio no debe contener secretos, y no se han identificado credenciales en el código
de la aplicación. Los únicos secretos del proyecto son los de CI/CD para firma y notarización
de macOS, referenciados como `secrets.*` en `.github/workflows/release.yml` y descritos por
nombre en [`../NOTARIZATION.md`](../NOTARIZATION.md). Nunca deben escribirse en
`settings.json`, en un manifiesto ni en un workflow de `workflows/`, porque esos archivos se
versionan y además viajan dentro del `.app`.
