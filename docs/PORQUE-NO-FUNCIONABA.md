# 🧭 Por qué no funcionaba (y cómo se arregló)

> **Explicación clara, sin jerga, de los 3 problemas reales que tenía Chofy
> y cómo se resolvieron. Si solo quieres entender el "porqué", lee este
> archivo. Si necesitas detalles técnicos, ve a
> [POSTMORTEM-2026-05-17.md](POSTMORTEM-2026-05-17.md).**

---

## 🏁 Resumen en una frase

Chofy decía "no tengo nada instalado" cuando en realidad **sí estaba todo
instalado, pero guardado en un cajón que la app no sabía abrir sola**. Una
vez que aprende a abrir ese cajón, todo funciona — y se descubrieron otros
3 detalles que también se arreglaron.

---

## 🗄️ El problema principal: el "cajón cerrado"

Tu Mac tiene un disco externo grande (`/Volumes/ORICO`). Pero ese disco está
formateado en **exFAT**, que es un formato pensado para llaves USB
intercambiables entre Mac/Windows. exFAT tiene una limitación grave para
nuestro caso: **no soporta enlaces simbólicos ni permisos POSIX**, dos cosas
que Python necesita para crear sus entornos (`venv`).

Para superarlo, el proyecto guarda todo en un **"archivo-disco APFS"**
(`ChofyAIStudio.sparsebundle`) que vive dentro del disco exFAT. Imagina:

```
📦 /Volumes/ORICO  (caja de cartón — exFAT, simple pero limitada)
   └─ 🧳 ChofyAIStudio.sparsebundle  ← una maleta APFS dentro
```

La maleta es APFS de verdad, así que Python, `git`, `uv`, todo funciona bien
**dentro** de ella. **Pero la maleta tiene que estar abierta (montada) para
que la app pueda meter o sacar herramientas.**

### ❌ Lo que pasaba antes

1. Encendías el Mac.
2. La maleta (`ChofyAIStudio.sparsebundle`) seguía cerrada.
3. Abrías Chofy.
4. Chofy miraba `/Volumes/ChofyAIStudio` (la dirección donde *debería* estar
   la maleta abierta) y veía **nada**.
5. Chofy decía: "no encuentro tools instaladas", aunque las 5 herramientas
   estaban perfectamente metidas dentro de la maleta cerrada.

> Tu reacción fue lógica: *"si las herramientas no aparecen pero antes
> funcionaban, alguien las habrá borrado"*. **En realidad solo estaba
> cerrada la maleta.**

### ✅ Lo que pasa ahora

Chofy, antes de mirar `/Volumes/ChofyAIStudio`, **abre la maleta él solo**
con un comando del sistema (`hdiutil attach`). Si la maleta ya estaba
abierta, no pasa nada. Si estaba cerrada, queda abierta. Luego mira y
encuentra las 5 herramientas. Listo.

**Archivo de configuración resultante** (`storage/state/settings.json`):

```json
{
  "studio_home": "/Volumes/ChofyAIStudio",
  "sparsebundle_path": "/Volumes/ORICO/ChofyIA/ChofyAIStudio.sparsebundle"
}
```

El campo nuevo, `sparsebundle_path`, es la dirección de la maleta que la
app debe abrir si la encuentra cerrada.

---

## 🔌 El segundo problema: AceForge "no respondía"

Cuando arreglamos lo de la maleta, las 5 herramientas aparecieron. 4 abrían
bien al pulsar `▶ Iniciar`, pero **AceForge se quedaba pensando** y nunca
mostraba su interfaz. Ahí estuvo el "no entiendo, la abro y no abre".

### ¿Qué pasaba?

AceForge usa el puerto `5056` de tu Mac para escuchar peticiones. Resulta
que **Google Chrome reserva ese mismo puerto** para algo interno suyo (un
servicio llamado `intecom-ps1`) y lo está sondeando todo el rato.

AceForge solo puede atender 4 conexiones simultáneamente. Chrome le abría
6 a la vez. Resultado: cuando intentábamos abrir la interfaz, Chrome ya
había agotado las 4 plazas y la nuestra se quedaba esperando para siempre.

### ✅ Solución

Le cambiamos el puerto a `7857` (uno libre que nadie usa). La instalación
de AceForge ahora aplica este cambio automáticamente al clonar el código.

No es problema de AceForge ni de Chrome — es una **coincidencia de puerto**
que afecta solo a Macs con Chrome instalado. Cualquier programa que hubiese
elegido el puerto 5056 habría tenido el mismo problema.

---

## 🪪 El tercer problema: el usuario veía detalles técnicos

Cuando hacías click en `👁 Ver UI` de una herramienta, la cabecera mostraba:

```
← Herramientas / 🎭 FaceFusion   http://127.0.0.1:7862/   ↻ ↗ ✕
```

Esa URL `http://127.0.0.1:7862/` es información técnica interna que no le
sirve al usuario final — confunde más que ayuda. Tú mismo nos dijiste:

> *"el usuario final, no debe porque saber eso, que fue instalada"*

### ✅ Solución

Eliminada la URL del encabezado. Ahora se ve:

```
← Herramientas / 🎭 FaceFusion   ↻ ↗ ✕
```

La herramienta sigue funcionando exactamente igual, pero ya no expone el
"cómo".

---

## 🩹 Problemas pequeños arreglados de paso

Mientras revisábamos los grandes, encontramos detalles que también se
limpiaron. **No es necesario que los entiendas en profundidad**, pero los
listo por transparencia:

| Detalle | Qué hacía mal | Qué hace ahora |
|---|---|---|
| Validación al arrancar tool | Decía "OK iniciado" aunque la herramienta muriese a los 0.1s | Si falta cualquier parte de la instalación, avisa con mensaje claro |
| Validación tras instalar | Decía "instalación completa" aunque hubiese fallado a mitad | Comprueba que todos los archivos críticos existan tras instalar |
| ComfyUI no veía los modelos | Las carpetas internas (`input`/`output`) no estaban conectadas con las externas (`inputs`/`outputs` con `s`) | Reescritos los enlaces con los nombres correctos |
| FaceFusion no terminaba de instalar | Su instalador exigía un programa (`conda`) que no usamos | Le decimos que sí, que prescinda de conda |
| Puerto ocupado tras crash | Si una herramienta moría inesperadamente, al volver a abrirla fallaba en silencio | Antes de abrir, liberamos el puerto si lo dejó alguien sin avisar |

---

## 🎯 Qué se verificó al final

Para asegurar que **no es maquillaje** — que las 5 herramientas funcionan
de verdad, no solo "se encienden" — hicimos una prueba real de cada una:

| Herramienta | Prueba real |
|---|---|
| 🎙 **whisper.cpp** | Le dimos un audio histórico de J.F. Kennedy. Lo transcribió bien: *"And so my fellow Americans, ask not what your country can do for you…"* |
| 🎨 **ComfyUI** | Le pedimos una imagen: *"a red apple on white background, photo"*. Generó una manzana real. |
| 🎤 **Qwen3-TTS** | Le pedimos que dijese *"Hola, soy Chofy y todo funciona correctamente"* en español. Generó un WAV de 221 KB. |
| 🎭 **FaceFusion** | Abrió su interfaz Gradio con sus 12 modelos cargados y la API de intercambio facial activa. |
| 🎹 **AceForge** | Reconoció el modelo ACE-Step (7,7 GB) y respondió `ok` a su chequeo de salud. |

---

## 🚦 Estado final

- ✅ **Las 5 herramientas funcionan**, no solo arrancan: cada una hizo una
  inferencia real verificable.
- ✅ **La aplicación se cuida sola**: monta el disco cuando hace falta,
  libera puertos huérfanos, valida instalaciones antes y después.
- ✅ **El usuario final no ve "tripa técnica"**: ni URLs internas, ni rutas
  de archivos, ni puertos. Solo herramientas que se abren al pulsar el botón.
- ✅ **Tests automáticos pasan**: 20/20 tests JavaScript, compilación Rust
  limpia, sintaxis bash correcta.

> Para detalles ingenieriles y referencias a líneas de código,
> ver [POSTMORTEM-2026-05-17.md](POSTMORTEM-2026-05-17.md).
> Para historial de cambios, ver [CHANGELOG.md](../CHANGELOG.md) entrada v0.5.1.
