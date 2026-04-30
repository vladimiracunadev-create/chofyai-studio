# 📐 Manifests YAML — vista rápida

> **Resumen ejecutivo. Para la especificación completa ver [`MANIFEST_SPEC.md`](MANIFEST_SPEC.md).**

[![Format](https://img.shields.io/badge/Format-YAML-CB171E?logo=yaml&logoColor=white)](https://yaml.org)

Cada herramienta se describe con un manifest YAML en [`apps/`](../apps/).

---

## ✅ Campos mínimos

- `id`
- `name`
- `category`
- `runtime`
- `platforms`
- `studio_home_subdir`
- `install_script`
- `run.command`
- `installed_if`

---

## 💡 Regla de oro

> [!IMPORTANT]
> La condición **`installed_if`** manda sobre cualquier mensaje superficial de UI.

Si los archivos declarados en `installed_if` existen → la herramienta está **instalada**. Si no, está **pendiente**. La UI no inventa estado.

---

## 📝 Ejemplo

```yaml
id: qwen3-tts
name: Qwen3-TTS
category: voice
runtime: python
platforms:
  - mac-arm64
default_port: 7860
studio_home_subdir: tools/qwen3-tts
install_script: scripts/mac/install-qwen3-tts.sh
run:
  command: cd app && env/bin/python -m uvicorn server:app --host 127.0.0.1 --port 7860
installed_if:
  - launcher/.git
  - app/env
  - app/models
```

> Ver detalle completo de cada campo en [`MANIFEST_SPEC.md`](MANIFEST_SPEC.md).
