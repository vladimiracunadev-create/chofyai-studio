# Manifests YAML

Cada herramienta se describe con un manifest YAML.

Campos mínimos:

- `id`
- `name`
- `category`
- `runtime`
- `platforms`
- `studio_home_subdir`
- `install`
- `run`
- `healthcheck`
- `installed_if`

## Regla de oro

La condición `installed_if` manda sobre cualquier mensaje superficial de UI.

## Ejemplo

```yaml
id: qwen3-tts
name: Qwen3-TTS
category: voice
runtime: python
installed_if:
  - app/env
  - app/models
```
