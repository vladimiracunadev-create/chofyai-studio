# 🛂 Firma y notarización Apple

> **Cómo pasar de un build ad-hoc a un `.dmg` firmado + notarizado para distribución pública.**

Hoy el `.dmg` generado por `release.yml` es **ad-hoc**: funciona localmente y se ejecuta con click derecho → Abrir la primera vez. Para distribución pública (download libre desde GitHub Releases sin warnings de Gatekeeper) hay que firmar con Apple Developer ID y notarizar.

---

## 📋 Pre-requisitos en la cuenta Apple

1. **Apple Developer Program** activo ($99 USD/año) — https://developer.apple.com/programs/
2. **Developer ID Application certificate** generado desde Xcode o Apple Developer portal.
   - Exportarlo desde Keychain como `.p12` (incluye clave privada).
3. **App-specific password** para `notarytool` desde https://appleid.apple.com/ → Security → App-Specific Passwords.
4. **Team ID** visible en https://developer.apple.com/account → Membership.

---

## 🔐 Secrets a configurar en GitHub

Settings → Secrets and variables → Actions → New repository secret. Crear **5 secrets**:

| Secret | Cómo obtenerlo |
|---|---|
| `APPLE_CERTIFICATE` | Contenido base64 del `.p12`: `base64 -i developer-id.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | La contraseña que pusiste al exportar el `.p12` |
| `APPLE_SIGNING_IDENTITY` | Exactamente: `Developer ID Application: Tu Nombre (TEAMID)` |
| `APPLE_ID` | Tu Apple ID (email) |
| `APPLE_PASSWORD` | App-specific password creado arriba (formato `xxxx-xxxx-xxxx-xxxx`) |
| `APPLE_TEAM_ID` | Tu Team ID (10 caracteres) |

---

## ⚙️ Cambios en `release.yml`

En el job `build-macos`, añadir antes de `pnpm tauri:build:mac`:

```yaml
- name: Importar certificado Developer ID
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    KEYCHAIN_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  run: |
    # Crear keychain temporal aislado
    security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security set-keychain-settings -lut 21600 build.keychain

    # Importar el cert
    echo "$APPLE_CERTIFICATE" | base64 --decode > certificate.p12
    security import certificate.p12 \
      -k build.keychain \
      -P "$APPLE_CERTIFICATE_PASSWORD" \
      -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple:,codesign: \
      -s -k "$KEYCHAIN_PASSWORD" build.keychain
    rm certificate.p12
```

Y modificar el step de build:

```yaml
- name: Build firmado + notarizado
  env:
    APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  run: pnpm tauri:build:mac
```

Tauri 2 detecta las variables `APPLE_*` automáticamente y firma + notariza durante el bundle.

---

## ⚙️ Cambios en `src-tauri/tauri.macos.conf.json`

Añadir el bloque `bundle.macOS`:

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application",
      "hardenedRuntime": true,
      "entitlements": "Entitlements.plist",
      "providerShortName": "TEAMID"
    }
  }
}
```

El archivo `Entitlements.plist` ya existe — verificar que incluya:

```xml
<key>com.apple.security.cs.allow-unsigned-executable-memory</key>
<true/>
<key>com.apple.security.cs.disable-library-validation</key>
<true/>
```

Estas dos son típicamente necesarias cuando el `.app` lanza binarios/scripts externos (que es exactamente el caso de ChofyAI Studio con sus 5 tools).

---

## ✅ Verificación post-release

Después del primer release firmado:

```bash
# Descargar el .dmg desde GitHub Releases y verificar
codesign --verify --deep --strict --verbose=2 "ChofyAI Studio.app"
spctl --assess --type execute --verbose=4 "ChofyAI Studio.app"
xcrun stapler validate "ChofyAI Studio.app"
```

Lo esperado:
- `codesign`: `satisfies its Designated Requirement`
- `spctl`: `accepted source=Notarized Developer ID`
- `stapler`: `The validate action worked!`

---

## 💰 Costos

- Apple Developer Program: $99/año
- macos-latest hosted runner: gratis en repos públicos (10 min por release ≈ $0)
- Notarización: gratis (incluida en el program)

---

## 🚫 Lo que NO hace falta

- **No** se necesita un Mac físico durante el release — todo corre en el hosted runner.
- **No** se necesita Xcode local — `xcrun notarytool` viene en la imagen de `macos-latest`.
- **No** se necesita un EV cert (más caro) — Developer ID Application basta para `.dmg`/`.app`.
