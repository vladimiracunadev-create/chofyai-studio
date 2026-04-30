# 📐 Architecture Decision Records (ADRs)

> **Decisiones técnicas significativas — qué se eligió y por qué.**

[![ADR](https://img.shields.io/badge/Format-ADR-7c5cff)](https://adr.github.io/)
![Decisions](https://img.shields.io/badge/ADRs-5-2d7a66)

Las decisiones técnicas significativas del proyecto se documentan aquí en formato ADR.

---

## 🦀 ADR-001: Tauri 2 + Rust como núcleo del launcher

**Estado**: ✅ Aceptada

### 🧭 Contexto

Se necesita un shell de escritorio nativo en macOS que pueda ejecutar comandos del sistema, leer el sistema de archivos y lanzar procesos externos sin necesitar un runtime pesado. Las alternativas evaluadas fueron Electron y una app Swift nativa.

### 💡 Decisión

Usar **Tauri 2 con Rust** como core y **React + TypeScript** como capa de UI.

### 📊 Consecuencias

- **Positivas**: binario ligero (~5 MB vs ~150 MB de Electron), control fino sobre los comandos del sistema, FFI directo con el OS.
- **Negativas**: la compilación requiere Rust + Xcode en el entorno de desarrollo; no hay hot-reload del backend Rust.
- **Neutras**: el frontend React puede desarrollarse en cualquier OS con `npm run dev:web`.

---

## 🐍 ADR-002: Python como adapter, no como core

**Estado**: ✅ Aceptada

### 🧭 Contexto

La mayoría de las herramientas de IA objetivo (Qwen3-TTS, FaceFusion, AceForge) están escritas en Python. Integrarlas como módulos dentro del proceso principal generaría conflictos de dependencias y acoplaría el ciclo de vida del launcher al de cada herramienta.

### 💡 Decisión

Python solo existe como **proceso externo controlado**: cada herramienta corre en su propio `venv`, es iniciada por un script Bash y el launcher solo gestiona el proceso (start / stop / logs).

### 📊 Consecuencias

- **Positivas**: aislamiento completo de dependencias, crash de una tool no afecta el launcher, actualizaciones independientes.
- **Negativas**: comunicación con la herramienta solo vía HTTP o archivos; no hay API interna tipada.

---

## 💾 ADR-003: APFS o SSD interno como `studio_home`

**Estado**: ✅ Aceptada

### 🧭 Contexto

macOS genera archivos `._*` en volúmenes no nativos (exFAT, FAT32). Los modelos de IA pesan múltiples GB y en discos externos la velocidad de acceso puede ser insuficiente para inferencia local. Algunos installers asumen permisos POSIX que exFAT no soporta.

### 💡 Decisión

El `studio_home` debe residir en un volumen **APFS interno**. El script `bootstrap.sh` advierte si se detecta un esquema no compatible.

### 📊 Consecuencias

- **Positivas**: sin archivos fantasma, permisos correctos, velocidad IO adecuada para modelos grandes.
- **Negativas**: los usuarios con solo un disco pequeño deben gestionar espacio manualmente.

---

## 🎯 ADR-004: Launcher controlado, no marketplace genérico

**Estado**: ✅ Aceptada

### 🧭 Contexto

Herramientas como Pinokio ofrecen un explorador universal de repositorios de IA. El objetivo aquí es diferente: un stack curado y controlado para un perfil de uso específico (creación: voz, video, música).

### 💡 Decisión

ChofyAI Studio solo integra herramientas explícitamente declaradas en `apps/*.yaml`. No hay descubrimiento automático de repositorios externos.

### 📊 Consecuencias

- **Positivas**: comportamiento predecible, sin superficie de ataque por repos arbitrarios, documentación por herramienta posible y completa.
- **Negativas**: añadir una herramienta nueva requiere crear un manifest + script; no hay "un clic para cualquier repo".

---

## 📐 ADR-005: Manifests YAML como contrato de integración

**Estado**: ✅ Aceptada

### 🧭 Contexto

El estado de instalación de una herramienta puede determinarse de múltiples formas: registros del sistema, bases de datos internas, o checks explícitos de rutas. Para mantener el sistema auditable y sencillo de depurar se necesita un contrato legible por humanos.

### 💡 Decisión

Cada herramienta se describe en un archivo YAML (`apps/<id>.yaml`) con campos obligatorios que incluyen `installed_if`: lista de rutas que deben existir para considerar la herramienta instalada.

### 📊 Consecuencias

- **Positivas**: estado de instalación siempre auditable manualmente, fácil de extender sin tocar código Rust, documentación y configuración co-localizadas.
- **Negativas**: requiere mantener los manifests sincronizados con los scripts de instalación; un cambio de ruta en el script que no se refleje en el manifest rompe la detección.
