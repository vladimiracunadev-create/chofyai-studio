# Decisiones de diseño

## 1. Tauri/Rust como core
Se prioriza por ligereza, control y robustez del launcher.

## 2. Python como adapter, no como core
Muchas herramientas AI objetivo ya viven en Python; se integran como procesos externos.

## 3. APFS o SSD interno
Se evita exFAT u otros esquemas que puedan generar problemas con archivos `._*` o comportamientos no nativos.

## 4. No ser clon de Pinokio
Este proyecto no busca ser un explorador genérico de cualquier repo AI, sino un launcher controlado para un stack definido.
