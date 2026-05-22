# 📦 Empaquetado de ChofyAI Studio

> **Generar `.app` y `.dmg` para macOS — del build local al canal de releases.**

[![Tauri Bundle](https://img.shields.io/badge/Tauri-Bundle-FFC131?logo=tauri&logoColor=black)](https://tauri.app/v2/develop/distribute/macos)
![Apple Silicon](https://img.shields.io/badge/Target-aarch64--apple--darwin-black?logo=apple&logoColor=white)

---

## 🎯 Objetivo

Generar un `.app` y un `.dmg` desde tu Mac para uso local o distribución controlada.

---

## ✅ Qué quedó preparado

- ⚙️ Configuración Tauri para bundle macOS (`tauri.conf.json`, `tauri.macos.conf.json`)
- 🎨 Íconos base en `src-tauri/icons/`
- 📋 `Info.plist` y `Entitlements.plist`
- ✈️ Script de preflight (`scripts/mac/preflight-build.sh`)
- 🚀 Script de build release (`scripts/mac/build-release.sh`)
- 📐 Lectura de manifests y scripts desde recursos empaquetados
- 💾 Escritura de settings en directorio de datos de usuario (no en el bundle)

### 📦 Recursos del bundle (v0.5.0)

`tauri.conf.json` declara estos directorios como recursos embebidos en el `.app`:

| Recurso | Función |
|:---|:---|
| `apps/` | Manifests YAML de las 5 tools base (con campo `icon`) |
| `docs/` | Documentación lectiva incluida en el bundle |
| `marketplace/registry.yaml` | Catálogo curado de 10 tools comunitarias importables |
| `workflows/*.yaml` | 3 workflows base (transcribe, comfyui-prompt, audio-pipeline) |
| `scripts/mac/` | Scripts de instalación + doctor + clean + sparsebundle |
| `storage/state/settings.json` | Settings iniciales (sobrescritos por usuario en runtime) |

Todos accesibles vía `app.path().resolve("...", BaseDirectory::Resource)` en Rust con fallback a `repo_root()` en modo dev.

---

## 📋 Requisitos en tu Mac

Instala y verifica:

```bash
xcode-select --install
node -v        # 22.x o superior
pnpm -v        # 10.x+ (activar con: corepack enable && corepack prepare pnpm@10 --activate)
cargo --version  # 1.76+
```

---

## ✈️ Preflight

```bash
pnpm preflight:mac
```

---

## 🚀 Build completo

```bash
pnpm install --frozen-lockfile
pnpm package:mac
```

---

## 🛠️ Comandos disponibles

| Comando | Salida |
|:---|:---|
| `pnpm tauri:build:app` | Solo `.app` |
| `pnpm tauri:build:dmg` | Solo `.dmg` |
| `pnpm tauri:build:mac` | `.app` + `.dmg` con config `tauri.macos.conf.json` |
| `pnpm package:mac` | Pipeline completo `build-release.sh` |

---

## 📂 Salidas esperadas

> [!IMPORTANT]
> El `target-dir` está redirigido a `/tmp/chofyai-target` por [`.cargo/config.toml`](../.cargo/config.toml) para evitar archivos AppleDouble (`._*`) en volúmenes externos no-APFS.

```text
/tmp/chofyai-target/release/bundle/macos/ChofyAI Studio.app
/tmp/chofyai-target/release/bundle/dmg/ChofyAI Studio_*.dmg
```

---

## 🚫 Qué no hace esta fase

- ❌ No **firma** la app (requiere Apple Developer ID)
- ❌ No **notariza** la app (requiere `notarytool`)
- ❌ No publica releases automáticamente (falta self-hosted runner)

---

## 🤖 Pendiente: Automatización CI/CD con tu Mac Mini

> Actualmente `.github/workflows/release.yml` solo crea las notas de release; **no genera el binario `.app/.dmg`** porque eso requiere un entorno macOS Apple Silicon.

Para automatizar esto sin costo: **registrar tu Mac Mini física como Self-Hosted Runner de GitHub**.

### 🪜 Pasos

1. En GitHub: **Settings → Actions → Runners → New self-hosted runner**.
2. Selecciona **macOS** y **ARM64**.
3. Descarga e instala el agente en tu Mac Mini siguiendo las instrucciones.
4. Modifica `.github/workflows/release.yml`:

   ```yaml
   runs-on: self-hosted
   steps:
     - uses: actions/checkout@v4
     - uses: pnpm/action-setup@v4
       with:
         version: 10
     - run: pnpm install --frozen-lockfile
     - run: pnpm package:mac
     - uses: actions/upload-artifact@v4
       with:
         name: chofyai-studio-mac
         path: /tmp/chofyai-target/release/bundle/dmg/*.dmg
   ```

Con esto, cada Release dispara el build en tu Mac Mini, compila en 1–2 min (con caché local) y sube el `.dmg` al release automáticamente.

---

## 🎨 Distribución interna vs profesional

### 🏠 Interna / pruebas personales

| Acción | Comando |
|:---|:---|
| 🆓 Build ad-hoc (sin firma) | `pnpm tauri:build:app` |
| 📂 Copiar a Aplicaciones | `cp -R "/tmp/chofyai-target/release/bundle/macos/ChofyAI Studio.app" /Applications/` |
| 🔓 Permitir Gatekeeper | Click derecho → **Abrir** la primera vez |

### 🏢 Profesional / distribución a terceros

> [!WARNING]
> Para distribución pública necesitarás credenciales de Apple Developer ($99 USD/año).

| Paso | Herramienta |
|:---|:---|
| 1. Cuenta de desarrollador | [Apple Developer](https://developer.apple.com/) |
| 2. Firma | Developer ID Application certificate |
| 3. Notarización | `xcrun notarytool` |
| 4. Stapling | `xcrun stapler staple` |
| 5. Canal de releases | GitHub Releases via self-hosted runner |
