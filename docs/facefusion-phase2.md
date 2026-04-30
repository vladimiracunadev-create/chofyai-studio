# 🎬 FaceFusion — bitácora Fase 2

> **Bitácora histórica de la integración Fase 2.** Para el estado actual ver [`STATUS.md`](STATUS.md) y [`TOOLS.md`](TOOLS.md).

[![Fase](https://img.shields.io/badge/Fase-2%20histórica-informational)](../ROADMAP.md)


## Qué queda operativo

- Instalación real desde la UI mediante `scripts/mac/install-facefusion.sh`
- Clonado del repositorio oficial
- Creación de `venv` dedicado
- Ejecución de `python install.py --onnxruntime default`
- Arranque de la UI local de FaceFusion desde la app
- Logs de instalación y ejecución

## Rutas esperadas

- Tool home: `STUDIO_HOME/tools/facefusion`
- Código: `STUDIO_HOME/tools/facefusion/source`
- Entorno: `STUDIO_HOME/tools/facefusion/env`
- Log install: `STUDIO_HOME/logs/facefusion-install.log`
- Log run: `STUDIO_HOME/logs/facefusion-run.log`

## Checks de instalado

- `source/.git`
- `env`
- `source/facefusion.py`

## Run command

```bash
source env/bin/activate && cd source && python facefusion.py run --open-browser
```
