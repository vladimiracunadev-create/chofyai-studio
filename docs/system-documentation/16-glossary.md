# 16 · Glosario

> Estado: completo · Última revisión: 2026-08-27 · Versión analizada: 0.5.1 (commit f840055)

Definiciones pensadas para que las entienda alguien sin formación técnica. Cuando el término
existe literalmente en el código, se indica dónde.

## Conceptos propios de ChofyAI Studio

**ChofyAI Studio** · La aplicación de escritorio que instala, arranca y vigila herramientas
de inteligencia artificial en el computador del usuario. No genera contenido: coordina a
otros programas que sí lo hacen.

**Studio Home** · La carpeta donde vive todo lo que la aplicación instala: herramientas,
modelos, resultados, caché y registros. Puede estar en el disco interno o en uno externo. En
el código es el campo `studio_home` de `settings.json`.

**Studio Home efectivo** · La carpeta que la aplicación está usando **de verdad** en este
momento. Coincide con el Studio Home salvo que ese disco no esté disponible, en cuyo caso se
usa una carpeta de reserva. Campo `studio_home_effective` de `SystemSummary`.

**Fallback (ruta de reserva)** · La carpeta que se usa cuando la principal no está
disponible. Por defecto `~/ChofyAIStudio`. Cuando está activa, la barra inferior lo avisa
(`using_fallback`).

**Manifiesto** · Ficha en formato YAML que describe una herramienta: cómo se llama, con qué
script se instala, en qué puerto escucha y cómo saber si está instalada. Vive en `apps/` y
el backend la lee como `RawManifest`.

**Herramienta** (o *tool*) · Cada uno de los programas de IA que la aplicación gestiona:
Qwen3-TTS, whisper.cpp, FaceFusion, ComfyUI y AceForge.

**`installed_if`** · Lista de archivos o carpetas que deben existir para dar por instalada
una herramienta. Es el criterio de verdad: si falta alguno, la aplicación la considera no
instalada aunque la instalación pareciera terminar bien.

**`install_script` / `install_scripts`** · El script que instala la herramienta. El primero
es la forma antigua, de un solo sistema operativo; el segundo es un diccionario por
plataforma y tiene prioridad.

**`run.command`** · La orden exacta que se ejecuta para arrancar la herramienta. Puede
declararse una sola o una por plataforma (`run.commands`).

**`studio_home_subdir`** · Subcarpeta dentro del Studio Home donde se instala la herramienta.
Si no se indica, se usa `tools/<id>`.

**Override de ubicación** · Ruta alternativa registrada para una herramienta concreta, de
modo que viva fuera de su sitio habitual. Se guarda en `tool_overrides`.

**Zona de módulos** · Carpeta `modules/` dentro del Studio Home que la interfaz propone como
destino al mover una herramienta.

**Marketplace** · Catálogo de herramientas adicionales que la aplicación conoce pero no trae
instaladas (`marketplace/registry.yaml`). Importar una crea un manifiesto básico que el
usuario debe terminar.

**Workflow** · Receta en YAML que encadena llamadas a varias herramientas: por ejemplo,
transcribir un audio y luego resumirlo. Vive en `workflows/`.

**Step (paso)** · Cada etapa de un workflow. Puede ser de tipo `http` (hace una petición
real) o `stub`.

**Stub** · Paso de ejemplo que no ejecuta nada: sólo devuelve una nota explicando qué habría
que conectar ahí. Sirve para documentar un patrón.

**Cola de instalación** · Lista de herramientas pendientes que se instalan una detrás de
otra, no a la vez, para no saturar el disco ni la conexión.

**Health check (comprobación de salud)** · Verificación periódica de que una herramienta
sigue viva. Comprueba dos cosas: que el proceso exista y que su puerto responda.

**Proceso huérfano** · Programa que sigue ejecutándose sin que la aplicación lo tenga
registrado, normalmente porque la aplicación se cerró de golpe. La interfaz permite
**adoptarlo** (volver a hacerse cargo) o **matarlo** (cerrarlo).

**PID** · Número que el sistema operativo asigna a cada programa en ejecución. La aplicación
guarda qué PID corresponde a qué herramienta.

**Pre-flight de puerto** · Comprobación que hace la aplicación justo antes de arrancar una
herramienta: si alguien más está ocupando su puerto, lo cierra.

**Crash log** · Archivo donde se anotan los errores de la interfaz para poder investigarlos
después (`crash.log`).

**Onboarding** · Asistente que aparece la primera vez y ayuda a elegir dónde guardar todo e
instalar la primera herramienta.

**Paleta de comandos** · Buscador que se abre con `⌘K` y permite ejecutar cualquier acción
escribiendo su nombre.

**Toast** · Aviso breve que aparece en una esquina y desaparece solo.

**Error boundary** · Red de seguridad de la interfaz: si algo se rompe al dibujar la
pantalla, muestra un mensaje de recuperación en lugar de dejar la ventana en blanco.

**Doctor** · Revisión del entorno que informa de qué programas necesarios están instalados y
cuánto espacio hay (`scripts/mac/doctor.sh`).

## Estados que muestra la interfaz

| Estado | Significado |
|:---|:---|
| Recomendada | El manifiesto la marca como buena opción para empezar (`recommended: true`) |
| Instalada / Pendiente | Se cumplen o no todas las condiciones de `installed_if` |
| Activa | Hay un proceso vivo o el puerto responde |
| Reubicada | Tiene un override de ubicación |
| Puerto abierto / cerrado | Resultado de intentar conectarse al puerto |
| `validated` | Plataforma probada: hoy sólo macOS con Apple Silicon |
| `experimental` | Existe soporte pero sin validación completa: Windows |
| `todo` | Declarado pero no implementado: Linux |
| `unsupported` | Plataforma no reconocida |

## Almacenamiento y discos

**Volumen** · Cada disco o partición que aparece montada en el sistema. En macOS los externos
se ven bajo `/Volumes`.

**APFS** · Sistema de archivos moderno de Apple. Es el que hace falta para que funcionen los
entornos de Python y los enlaces simbólicos.

**exFAT / FAT** · Sistemas de archivos compatibles con Windows y macOS, pero sin soporte de
enlaces simbólicos ni permisos de ejecución: por eso dan problemas con estas herramientas.

**Sparsebundle** · Archivo que se comporta como un disco: por dentro es APFS aunque esté
guardado en un disco exFAT. La aplicación puede montarlo automáticamente al arrancar.

**AppleDouble (`._*`)** · Archivos ocultos que macOS crea en discos que no son APFS para
guardar metadatos. Rompen la compilación cuando se confunden con archivos de configuración.

**Enlace simbólico (symlink)** · Atajo que apunta a otra carpeta. La instalación de ComfyUI
los usa para que la herramienta vea los modelos guardados fuera de su carpeta.

## Tecnologías del proyecto

**Tauri** · Marco de trabajo para hacer aplicaciones de escritorio con tecnología web y un
núcleo nativo. Usa el navegador que ya trae el sistema, por lo que la aplicación pesa mucho
menos que una equivalente en Electron.

**Rust** · Lenguaje del núcleo de la aplicación. Rápido y con fuertes garantías de seguridad
de memoria.

**React** · Biblioteca con la que está hecha la interfaz.

**TypeScript** · JavaScript con tipos: permite detectar errores antes de ejecutar.

**Vite** · Herramienta que compila y sirve la interfaz durante el desarrollo.

**WebView** · El navegador embebido dentro de la ventana de la aplicación, donde se dibuja la
interfaz.

**IPC** · Comunicación entre procesos. Aquí, el canal por el que la interfaz pide cosas al
núcleo en Rust.

**Comando Tauri** · Cada función del núcleo que la interfaz puede invocar. Hay 35.

**Evento Tauri** · Mensaje que el núcleo envía a la interfaz sin que ésta lo pida; se usa
para el progreso de las instalaciones.

**pnpm** · Gestor de paquetes de JavaScript que usa este proyecto en lugar de npm, por
razones de seguridad de la cadena de suministro.

**Corepack** · Utilidad de Node que instala exactamente la versión de pnpm que el proyecto
declara.

**uv** · Instalador de paquetes de Python mucho más rápido que pip. Opcional: si no está, los
scripts usan pip.

**venv (entorno virtual)** · Carpeta con una instalación de Python aislada, para que las
dependencias de una herramienta no choquen con las de otra.

**Homebrew** · Gestor de programas para macOS. Se usa para instalar `ffmpeg` y otras
utilidades.

**cmake** · Herramienta de compilación necesaria para construir whisper.cpp.

**ffmpeg** · Programa que procesa audio y video; lo necesitan FaceFusion y AceForge.

**Vitest** · Herramienta con la que se ejecutan las pruebas de la interfaz.

**markdownlint** · Revisor de formato para los archivos de documentación.

**CodeQL** · Análisis automático de código en busca de fallos de seguridad.

**TruffleHog** · Herramienta que busca contraseñas o claves olvidadas en el historial del
repositorio.

**Dependabot** · Servicio que abre propuestas automáticas para actualizar dependencias.

**CI/CD** · Integración y entrega continuas: comprobaciones automáticas en cada cambio y
publicación automatizada de versiones.

**Cadena de suministro (supply chain)** · Todo el software de terceros del que depende el
proyecto. Un ataque de cadena de suministro consiste en colar código malicioso en una
dependencia.

**i18n** · Abreviatura de *internacionalización*: la capacidad de mostrar la aplicación en
varios idiomas. Aquí, español e inglés.

## Aceleración por hardware e inteligencia artificial

**Apple Silicon** · Los procesadores propios de Apple (M1, M2, M3, M4). Integran CPU, GPU y
memoria, lo que los hace muy eficientes para IA local.

**MLX** · Biblioteca de Apple para ejecutar modelos de IA aprovechando ese hardware. Sólo
existe en Mac, y por eso Qwen3-TTS no puede funcionar en Windows ni Linux.

**Metal** · Tecnología gráfica de Apple, usada por whisper.cpp para acelerar la
transcripción.

**MPS** · La forma en que PyTorch aprovecha la GPU de Apple Silicon.

**CoreML** · Marco de Apple para ejecutar modelos de IA; FaceFusion lo usa a través de ONNX
Runtime.

**CUDA** · El equivalente de NVIDIA, para tarjetas gráficas en Windows y Linux.

**ONNX Runtime** · Motor que ejecuta modelos en un formato estándar, aprovechando el
acelerador disponible en cada sistema.

**`mac-arm64` / `win-x64` / `linux-x64`** · Nombres que el proyecto usa para identificar cada
plataforma en los manifiestos.

**TTS** · *Text to speech*: convertir texto en voz.

**ASR** · *Automatic speech recognition*: convertir voz en texto, es decir, transcribir.

**Face swap** · Sustituir una cara por otra en una imagen o un video.

**Inferencia** · El acto de usar un modelo ya entrenado para producir un resultado. Aquí
ocurre siempre en el computador del usuario.

**Modelo** · Archivo (a menudo de varios gigabytes) que contiene lo que un sistema de IA ha
aprendido.

**Checkpoint** · Un modelo completo de generación de imágenes, como SDXL.

**LoRA** · Complemento pequeño que modifica el estilo de un modelo de imagen sin sustituirlo.

**VAE** · Componente que convierte la representación interna de un modelo de imagen en la
imagen final visible.

**Hugging Face** · Plataforma desde la que se descargan la mayoría de los modelos abiertos.

**`repo_id`** · Identificador de un modelo en Hugging Face, con el formato
`organización/nombre`.

**Snapshot** · Copia completa de un repositorio de modelos descargada al disco.

## Distribución en macOS

**Notarización** · Revisión automática de Apple que permite que una aplicación se abra sin
advertencias en cualquier Mac.

**Firma ad-hoc** · Firma local, sin certificado de desarrollador de Apple. Es el estado
actual del proyecto: la primera vez hay que abrir con clic derecho → Abrir.

**Entitlements** · Permisos especiales que una aplicación firmada declara necesitar; aquí,
los que permiten ejecutar intérpretes y librerías de terceros.

**DMG** · Archivo de imagen de disco, el formato habitual para distribuir aplicaciones de
macOS.

**`.app`** · La aplicación empaquetada de macOS: por dentro es una carpeta con el programa y
sus recursos.

## Términos de red

**Puerto** · Número que identifica un canal de comunicación en el computador. Cada
herramienta usa el suyo: 7860, 7857, 7862, 8178 y 8188.

**`127.0.0.1` (localhost)** · Dirección que apunta al propio computador. Que las herramientas
escuchen ahí significa que no son accesibles desde fuera.

**HTTP / HTTPS** · Protocolo con el que se comunican los navegadores y los servidores; la
versión con S va cifrada.

**iframe** · Ventana dentro de una página web que muestra otra página. Es lo que permite ver
la interfaz de cada herramienta dentro de la aplicación.

**CSP** · Política de seguridad de contenido: una lista de qué puede cargar y ejecutar una
página. En este proyecto está desactivada, cosa que se analiza en
[11 · Seguridad](11-security.md).

**CORS** · Reglas que deciden si una página puede pedir datos a otro servidor.
