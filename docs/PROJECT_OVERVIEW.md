# Visión general del proyecto

## Qué es ChofyAI Studio

ChofyAI Studio es un **launcher local para macOS Apple Silicon** construido para centralizar herramientas creativas de IA sin depender de un orquestador genérico externo.

Está pensado para un entorno como un **Mac mini M4 con 64 GB de RAM**, donde tiene más sentido:

- una app principal **ligera**
- herramientas pesadas **aisladas**
- rutas de trabajo controladas
- logs claros
- configuración explícita

## Qué problema intenta resolver

Muchos launchers externos:

- ocultan demasiado el estado real de instalación
- mezclan UI con runtime
- no dejan claro qué está instalado y qué no
- pueden romperse por rutas, permisos, discos externos o installers ambiguos

ChofyAI Studio intenta resolver eso con:

- manifests YAML legibles
- scripts explícitos por herramienta
- checks de instalación definidos por archivos reales
- una shell de escritorio propia

## Filosofía

1. **La GUI no corre modelos dentro del proceso principal**.
2. **Cada herramienta vive en su propia carpeta y runtime**.
3. **El estado instalado se decide por checks explícitos**.
4. **El proyecto está orientado primero a macOS Apple Silicon**.
5. **Los discos críticos deben ser internos o APFS**.

## Qué contiene hoy

- shell Tauri/Rust
- frontend React/TypeScript
- gestión básica de settings
- lectura de manifests
- integración de 4 herramientas reales
- empaquetado base para macOS

## Qué no pretende ser

- un clon completo de Pinokio
- un marketplace universal de repositorios IA
- una suite terminada y distribuible profesionalmente hoy mismo

Es, en esta fase, un **producto base serio** desde el cual seguir creciendo.
