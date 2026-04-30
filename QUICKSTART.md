# ChofyAI Studio · Quickstart

## Requisitos (macOS Apple Silicon)

```bash
brew install node@22 cmake ffmpeg git python@3.11
xcode-select --install   # toolchain de Apple
# Rust (necesario para Tauri):
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Arrancar localhost (modo desarrollo)

```bash
cd chofyai-studio
npm install
npm run tauri:dev   # arranca Vite (http://localhost:1420) + ventana Tauri
```

`npm run dev:web` abre solo la UI en `localhost:1420` sin backend Tauri — no permite instalar/iniciar herramientas.

## Disco externo + fallback al disco principal

ChofyAI elige `studio_home` en este orden:

1. `studio_home` configurado en `storage/state/settings.json` (o, si está empaquetado, en `~/Library/Application Support/.../state/settings.json`).
2. Si esa ruta apunta a un volumen **desmontado o sin permisos**, cae automáticamente a `~/ChofyAIStudio` (disco principal).
3. La barra inferior muestra `⚠ Usando fallback` cuando se aplica el plan B.

El **selector de volúmenes** en la UI lista `~`, todos los `/Volumes/*` montados y permite cambiar con un clic.

## Zona de módulos / reubicación

Cada herramienta vive por defecto en `studio_home/tools/<id>`. Botón **📍 Mover** sugiere `studio_home/modules/<id>`.
La reubicación:

- Acepta cualquier ruta absoluta de destino.
- Si destino y origen están en distinto volumen, copia recursivamente y borra origen.
- Guarda override en `settings.json → tool_overrides`.
- **Reset ruta** quita el override (no mueve archivos).

## Generar el `.app` (ad-hoc, sin firma Apple)

```bash
npm run tauri:build:app
# Resultado: /tmp/chofyai-target/release/bundle/macos/ChofyAI Studio.app
```

Para lanzarlo en este equipo basta con copiarlo a `/Applications`. macOS pedirá permisos en el primer arranque (Click derecho → Abrir).

## Notas sobre disco externo no-APFS

Volúmenes en exFAT/HFS+ generan archivos AppleDouble (`._*`) que rompen `cargo build`. Por eso:

- `.cargo/config.toml` apunta el `target-dir` a `/tmp/chofyai-target` (en disco APFS).
- Antes de cualquier build, ejecuta `bash scripts/mac/clean-appledouble.sh` si dudas.

## Comandos backend disponibles (Tauri IPC)

| Comando                  | Descripción                                       |
|--------------------------|---------------------------------------------------|
| `get_system_summary`     | Studio home solicitado vs. efectivo + fallback.   |
| `get_system_stats`       | CPU/RAM/disco/uptime (barra inferior).            |
| `list_volume_candidates` | Volúmenes para el selector.                       |
| `save_studio_home`       | Cambia studio_home (sin mover archivos).          |
| `list_tools`             | Manifests + estado de instalación.                |
| `install_tool`           | Ejecuta el script con streaming de progreso.      |
| `update_tool`            | Re-ejecuta el script (git pull interno).          |
| `start/stop/restart`     | Control de procesos.                              |
| `health_check_tool`      | PID + puerto TCP.                                 |
| `relocate_module`        | Mueve directorio + registra override.             |
| `clear_module_override`  | Quita override (no mueve archivos).               |
| `open_tool_directory`    | Abre Finder en la carpeta del tool.               |
| `open_tool_log`          | Abre log con app por defecto.                     |
