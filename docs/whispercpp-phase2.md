# whisper.cpp - fase 2

## Qué queda operativo

- Instalación real desde la UI mediante `scripts/mac/install-whispercpp.sh`
- Clonado del repositorio oficial
- Compilación CMake con soporte Metal
- Descarga del modelo `ggml-base.en.bin`
- Arranque de `whisper-server` desde la UI
- Logs de instalación y ejecución

## Rutas esperadas

- Tool home: `STUDIO_HOME/tools/whispercpp`
- Código: `STUDIO_HOME/tools/whispercpp/source`
- Modelos: `STUDIO_HOME/tools/whispercpp/models`
- Log install: `STUDIO_HOME/logs/whispercpp-install.log`
- Log run: `STUDIO_HOME/logs/whispercpp-run.log`

## Checks de instalado

- `source/.git`
- `source/build/bin/whisper-cli`
- `models/ggml-base.en.bin`

## Run command

```bash
source/build/bin/whisper-server --host 127.0.0.1 --port 8178 -m models/ggml-base.en.bin
```
