# 📐 Especificación de Manifests YAML

> **Cómo declarar una herramienta para que ChofyAI Studio la reconozca.**

[![Format](https://img.shields.io/badge/Format-YAML-CB171E?logo=yaml&logoColor=white)](https://yaml.org)
[![Location](https://img.shields.io/badge/Location-apps%2F-7c5cff)](../apps/)

Cada herramienta integrada en ChofyAI Studio se declara mediante un archivo YAML en el directorio [`apps/`](../apps/).

---

## 📋 Estructura de un manifest

```yaml
# apps/mi-herramienta.yaml

id: mi-herramienta              # (string, obligatorio) Identificador único. Sin espacios ni mayúsculas.
name: Mi Herramienta            # (string, obligatorio) Nombre legible para la UI.
category: voice                 # (string, obligatorio) Ver categorías disponibles abajo.
runtime: python                 # (string, obligatorio) Ver runtimes disponibles abajo.
description: "..."              # (string, obligatorio) Una línea descriptiva para la UI.
platforms:                      # (lista, obligatorio) Plataformas soportadas.
  - mac-arm64
recommended: true               # (bool, opcional) Marca la herramienta como recomendada en la UI.
default_port: 7860              # (int, opcional) Puerto en el que levanta el servidor.
studio_home_subdir: tools/mi-h  # (string, obligatorio) Ruta relativa dentro de studio_home.

install_script: scripts/mac/install-mi-herramienta.sh  # (string, obligatorio) Script de instalación.

install:                        # (lista, opcional) Pasos de instalación declarativos (documentación).
  - git clone <repo> source
  - python3 -m venv env

models:                         # (lista, opcional) Modelos que se descargan durante la instalación.
  - "org/nombre-del-modelo"

run:                            # (objeto, obligatorio) Cómo iniciar la herramienta.
  command: "cd source && env/bin/python server.py"

healthcheck:                    # (objeto, opcional) Verificación de que la herramienta está arriba.
  type: http                    # Actualmente soportado: "http"
  url: http://127.0.0.1:7860

installed_if:                   # (lista, obligatorio) Rutas relativas a studio_home_subdir que deben existir.
  - source/.git
  - env
  - source/mi-archivo-clave.py

notes:                          # (lista, opcional) Notas para el desarrollador / documentación.
  - "Requiere Python 3.10 en producción."
```

---

---

## 🔍 Campos en detalle

### ✅ Campos obligatorios

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador único. Usado como nombre de directorio y clave interna. Usa kebab-case. |
| `name` | `string` | Nombre legible mostrado en la UI. |
| `category` | `string` | Categoría funcional. Ver tabla abajo. |
| `runtime` | `string` | Runtime principal. Ver tabla abajo. |
| `description` | `string` | Descripción de una línea para la tarjeta de la UI. |
| `platforms` | `list[string]` | Debe incluir al menos `mac-arm64`. |
| `studio_home_subdir` | `string` | Ruta relativa dentro de `studio_home` donde vive esta herramienta. |
| `install_script` | `string` | Ruta al script de instalación desde la raíz del repo. |
| `run.command` | `string` | Comando para iniciar la herramienta. Ejecutado desde `studio_home_subdir`. |
| `installed_if` | `list[string]` | Condiciones de instalación: rutas relativas a `studio_home_subdir` que deben existir. |

### 🟡 Campos opcionales

| Campo | Tipo | Descripción |
|---|---|---|
| `recommended` | `bool` | Si `true`, muestra un badge "Recomendada" en la UI. |
| `default_port` | `int` | Puerto donde levanta el servidor. Usado para healthchecks y para mostrar en UI. |
| `install` | `list[string]` | Pasos declarativos de instalación (solo documentación; el script real es `install_script`). |
| `models` | `list[string]` | Modelos que se descargan. Referencia para documentación. |
| `healthcheck` | `object` | Verificación activa de disponibilidad. |
| `healthcheck.type` | `string` | Solo `http` está implementado actualmente. |
| `healthcheck.url` | `string` | URL de healthcheck. Debe responder 200 cuando la tool está lista. |
| `notes` | `list[string]` | Notas técnicas para desarrolladores. No aparece en la UI. |

---

---

## 🏷️ Categorías disponibles

| Valor | Uso |
|---|---|
| `voice` | TTS, ASR, clonación de voz |
| `video` | Face swap, procesamiento de video |
| `music` | Generación y edición musical |
| `image` | Generación y edición de imágenes |
| `utility` | Herramientas de soporte sin output creativo directo |

---

---

## ⚙️ Runtimes disponibles

| Valor | Descripción |
|---|---|
| `python` | Herramientas Python con `venv` propio |
| `node` | Herramientas Node.js |
| `binary` | Binarios compilados sin runtime externo |
| `go` | Binarios Go |

---

---

## 📝 Ejemplo completo anotado: `whispercpp.yaml`

```yaml
id: whispercpp
name: whisper.cpp
category: voice
runtime: binary
description: ASR local y transcripción con whisper.cpp compilado para Metal.
platforms:
  - mac-arm64
default_port: 8178
studio_home_subdir: tools/whispercpp
install_script: scripts/mac/install-whispercpp.sh
install:
  - git clone https://github.com/ggerganov/whisper.cpp.git source
  - cmake -B source/build -DGGML_METAL=ON source
  - cmake --build source/build --config Release
run:
  command: source/build/bin/whisper-server -m models/ggml-base.en.bin --port 8178
healthcheck:
  type: http
  url: http://127.0.0.1:8178
installed_if:
  - source/.git
  - source/build/bin/whisper-cli
  - models/ggml-base.en.bin
notes:
  - Requiere CMake y Xcode CLT para la compilación.
  - El modelo ggml-base.en.bin se descarga (~150 MB) durante la instalación.
```

---

---

## ➕ Cómo añadir una herramienta nueva

1. Crea `apps/<id>.yaml` siguiendo esta especificación.
2. Define al menos un `installed_if` que verifique un archivo real post-instalación.
3. Crea `scripts/mac/install-<id>.sh` que termine generando esos archivos.
4. Documenta la herramienta en `docs/TOOLS.md`.
5. Añade una entrada en `CHANGELOG.md` bajo `[Unreleased]`.
6. Prueba el ciclo completo: instalar → check → iniciar → abrir log.
