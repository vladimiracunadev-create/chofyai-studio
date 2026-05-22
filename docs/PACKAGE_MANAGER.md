# 📦 Gestor de paquetes: por qué pnpm (y no npm)

> **Decisión de seguridad** — adoptada 2026-05-22 para ChofyAI Studio v0.5.x.

Este documento justifica el reemplazo de `npm` por `pnpm` como único gestor de paquetes soportado en el repositorio. La motivación principal es **reducir la superficie de ataque supply-chain**, no rendimiento ni ergonomía (aunque también mejoran).

---

## 🎯 TL;DR

| Vector de ataque | npm (default) | pnpm (como queda configurado) |
|:---|:---:|:---:|
| `postinstall` arbitrario de dependencias transitivas | ⚠️ se ejecuta | ✅ bloqueado salvo allowlist |
| "Phantom dependencies" (importar paquetes no declarados) | ⚠️ posible | ✅ imposible (symlink store) |
| Integridad por hash criptográfico de cada paquete | ⚠️ SHA-1 + opcional SHA-512 | ✅ SHA-512 obligatorio |
| Reproducibilidad bit-a-bit del árbol de dependencias | ⚠️ depende del orden de resolución | ✅ lockfile determinista |
| Detección de tampering del lockfile en CI | ⚠️ requiere flag manual | ✅ `--frozen-lockfile` por defecto en CI |
| Footprint en disco (varios proyectos) | ❌ duplica todo | ✅ content-addressable store |

---

## 1. El problema concreto: `postinstall` en transitivas

El incidente arquetípico es **`event-stream` (2018)**: un paquete legítimo cambió de mantenedor; el nuevo mantenedor introdujo un `postinstall` malicioso que robaba carteras de criptomonedas. Cualquier proyecto que tuviera `event-stream` como **dependencia transitiva** lo ejecutaba al hacer `npm install`. La víctima nunca había escrito el nombre `event-stream` en su `package.json`.

Casos similares posteriores:

- `colors`, `faker` (2022) — sabotaje del autor.
- `node-ipc` (2022) — payload geopolítico que borraba archivos.
- `ua-parser-js`, `coa`, `rc` (2021) — cuentas de mantenedores comprometidas.
- `xz-utils` (2024) — caso fuera de npm pero misma clase: postinstall introducido por colaborador "de confianza".

### Cómo lo mitiga npm

`npm install --ignore-scripts` bloquea **todos** los scripts, incluidos los del paquete raíz. No hay forma nativa de declarar "ejecuta solo los míos". Hay que recordar el flag en cada `install`, en cada CI, en cada workflow de cada colaborador.

### Cómo lo mitiga pnpm

pnpm 10+ trae **bloqueo por defecto** de scripts de paquetes no listados explícitamente. En este repo lo declaramos en [`package.json`](../package.json):

```json
"pnpm": {
  "onlyBuiltDependencies": ["esbuild"]
}
```

Solo `esbuild` puede ejecutar `postinstall` (lo necesita para descargar su binario nativo). Cualquier otra dependencia transitiva que intente correr un script es **silenciosamente ignorada**. Si una transitiva legítima nueva lo necesita, el contributor verá un warning de pnpm pidiendo agregarla a la allowlist — decisión humana explícita.

> Es la misma idea que tiene Rust con `[features]` o macOS con `entitlements`: capability-based, no opt-out.

---

## 2. Phantom dependencies

Con `npm`/`yarn classic`, todo `node_modules/` es un árbol plano. Si tu paquete `A` depende de `B`, y `B` depende de `lodash`, **tu código puede hacer `import "lodash"`** aunque `lodash` no esté en tu `package.json`. Funciona localmente, falla en producción cuando el árbol de resolución cambia. Y peor: si alguien introduce malware en `lodash`, lo importas sin saberlo porque ni siquiera sabías que dependías de él.

pnpm usa **symlinks desde un store content-addressable**: `node_modules/A` solo tiene visible `B`, no las transitivas de `B`. Importar algo no declarado falla en `import` — no compila, no llega a producción.

---

## 3. Integridad criptográfica del lockfile

- `package-lock.json` (npm v7+) almacena un `integrity` SHA-512 **opcional** por paquete y un SHA-1 para compatibilidad. La verificación estricta no es default.
- `pnpm-lock.yaml` **siempre** trae SHA-512 por paquete y el comando `pnpm install --frozen-lockfile` falla si el árbol resuelto difiere del lockfile.

En CI usamos `pnpm install --frozen-lockfile` en los tres workflows (`ci.yml`, `release.yml`, `security.yml`). Esto significa:

- Un PR no puede modificar `node_modules` resuelto sin actualizar el lockfile (que va en el diff y se revisa).
- Un mirror malicioso no puede inyectar un tarball alterado: el hash no coincidiría.

---

## 4. Reproducibilidad

`npm install` (sin lockfile o con drift) puede resolver una versión `^x.y.z` distinta a la del último install, dependiendo del orden de descubrimiento. Esto rompe builds reproducibles y dificulta la auditoría forense.

pnpm aplica un algoritmo determinista de resolución y **escribe el lockfile en orden estable**. Dos máquinas con el mismo `package.json` + `pnpm-lock.yaml` + versión de pnpm producen el mismo árbol — útil cuando empaquetas un `.app` que vas a firmar.

---

## 5. Hardening adicional aplicado en este repo

Además de cambiar el gestor, se añadieron tres barreras:

### 5.1 `packageManager` pinned en `package.json`

```json
"packageManager": "pnpm@10.29.3"
```

Corepack (incluido en Node 22) usa este campo para **descargar exactamente** esa versión de pnpm al primer uso. Un colaborador con pnpm 9 o pnpm 11 no usará su versión local — usará la pinned. Evita ataques donde una versión vieja de pnpm tuviera vulnerabilidades conocidas o donde una nueva cambiara semántica de resolución sin avisar.

### 5.2 `.npmrc` endurecido

```ini
strict-peer-dependencies=false   # ergonomía; los peers se vigilan en CI
resolution-mode=highest          # determinismo de versiones nuevas
audit-level=high                 # señales locales antes de commit
```

### 5.3 Auditoría continua en CI

El job `pnpm audit` en [`.github/workflows/security.yml`](../.github/workflows/security.yml) corre en cada push/PR y en cron semanal. Falla la build si hay vulnerabilidades `high` o `critical` en dependencias de producción.

---

## 6. Lo que **no** cambia

- **`registry.npmjs.org`** sigue siendo el registry. pnpm consume el mismo formato de paquetes que npm — la migración no introduce un proveedor nuevo.
- **`package.json`** mantiene el mismo schema. Cualquier consumidor puede leerlo.
- **Dependabot** sigue funcionando con `package-ecosystem: "npm"` — detecta `pnpm-lock.yaml` automáticamente desde 2023.
- **CodeQL, TruffleHog, cargo audit** — sin cambios.

---

## 7. Cómo empezar (desarrolladores)

```bash
# Node 22 viene con corepack — solo hay que activarlo una vez
corepack enable
corepack prepare pnpm@10 --activate

# A partir de aquí, en la raíz del repo:
pnpm install --frozen-lockfile   # = npm ci
pnpm tauri:dev                   # = npm run tauri:dev
pnpm test                        # = npm test
pnpm audit --prod                # = npm audit --omit=dev
```

No instales pnpm vía `npm install -g pnpm` — usa corepack para que la versión coincida con `packageManager`.

---

## 8. Decisiones rechazadas

| Alternativa | Motivo de descarte |
|:---|:---|
| Quedarse en npm + `--ignore-scripts` manual | Frágil: depende de que cada CI y cada dev recuerde el flag. No protege contra phantom deps. |
| Yarn 4 (Berry) | PnP rompe Tauri/Vite plugins que asumen `node_modules/` real. Yarn classic está EOL. |
| Bun | Aún sin lockfile estable cross-platform y sin paridad de auditoría supply-chain. |
| Deno | Implicaría migrar Vite + Tauri tooling — fuera de alcance. |

---

## 9. Referencias

- pnpm — `onlyBuiltDependencies`: <https://pnpm.io/package_json#pnpmonlybuiltdependencies>
- npm — sobre `event-stream`: <https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident>
- OpenSSF — Scorecard checks supply-chain: <https://github.com/ossf/scorecard>
- RustSec advisory DB (referencia para `cargo audit`): <https://rustsec.org/>
