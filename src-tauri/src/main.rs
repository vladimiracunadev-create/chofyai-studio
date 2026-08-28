//! Punto de entrada del ejecutable de ChofyAI Studio.
//!
//! Deliberadamente vacío: toda la lógica de arranque vive en la biblioteca
//! (`lib.rs` → [`chofyai_studio::run`]), de modo que el binario y las pruebas
//! compartan exactamente el mismo código de inicialización.
//!
//! El atributo `windows_subsystem = "windows"` sólo se aplica en compilaciones
//! de release: evita que Windows abra una consola detrás de la ventana. En
//! debug se conserva la consola para poder ver la salida estándar.
//!
//! Documentación relacionada: `docs/system-documentation/03-architecture.md`.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    chofyai_studio::run();
}
