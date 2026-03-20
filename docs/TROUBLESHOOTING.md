# Solución de problemas

## 1. La app no compila

### Posibles causas
- falta `cargo`
- falta `xcode-select --install`
- falta `npm`

### Qué revisar
```bash
bash scripts/mac/preflight-build.sh
```

## 2. Una herramienta dice instalada pero no abre

### Qué revisar
- la ruta `studio_home`
- la carpeta real de instalación
- el log abierto desde la UI
- si los checks `installed_if` realmente existen

## 3. Qwen3-TTS falla al instalar

### Puntos típicos
- no existe `python3.10`
- falta espacio en disco
- falla descarga de modelos
- el volumen de destino no es estable

## 4. whisper.cpp no compila

### Qué revisar
- `cmake`
- toolchain de Xcode
- Metal habilitado
- permisos de escritura en `studio_home`

## 5. FaceFusion falla a mitad de instalación

### Qué revisar
- `ffmpeg`
- versión de Python elegida
- `onnxruntime`
- log de instalación

## 6. AceForge se instala pero demora mucho en primer uso

Eso puede ser normal si el proyecto descarga modelos o assets pesados al primer arranque.

## 7. Disco externo o volumen extraño rompe instalaciones

Recomendación:
- usar SSD interno o APFS
- evitar exFAT
- evitar rutas que puedan generar archivos `._*`

## 8. Quiero borrar una herramienta

```bash
bash scripts/mac/cleanup-tool.sh "/ruta/a/studio_home" "tool_id"
```

Ejemplo:

```bash
bash scripts/mac/cleanup-tool.sh "$HOME/ChofyAIStudio" "qwen3-tts"
```
