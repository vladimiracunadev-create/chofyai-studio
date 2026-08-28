//! Arranque de la aplicación y registro de la API interna.
//!
//! Este módulo hace tres cosas, y sólo tres:
//!
//! 1. Declara el estado compartido: [`ProcessRegistry`], el mapa
//!    `tool_id → PID` que sobrevive a toda la sesión.
//! 2. Restaura ese registro desde disco al arrancar, descartando los procesos
//!    que ya no están vivos. Es lo que permite recuperar el control de una
//!    herramienta que siguió corriendo tras cerrar la ventana.
//! 3. Registra los comandos que el frontend puede invocar. **Esa lista es la
//!    superficie completa de lo que la interfaz puede hacer**: nada que no esté
//!    aquí es alcanzable desde el WebView.
//!
//! Al añadir un comando nuevo en `system.rs` hay que añadirlo también aquí; si
//! se olvida, el proyecto compila igual y el fallo sólo aparece en ejecución.
//!
//! Documentación relacionada:
//! `docs/system-documentation/05-technical-reference.md`.

mod models;
mod system;

use std::collections::HashMap;
use std::sync::Mutex;
use system::ProcessRegistry;
use tauri::Manager;

/// Construye y ejecuta la aplicación Tauri. No retorna hasta que se cierra la
/// última ventana; si el runtime no puede arrancar, hace panic con un mensaje
/// explícito, porque sin runtime no hay nada que degradar.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ProcessRegistry(Mutex::new(HashMap::new())))
        .setup(|app| {
            let handle = app.handle();
            let registry: tauri::State<'_, ProcessRegistry> = handle.state();
            system::restore_registry(handle, &registry);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            system::get_system_summary,
            system::save_studio_home,
            system::save_path_settings,
            system::get_effective_paths,
            system::list_tools,
            system::install_tool,
            system::update_tool,
            system::start_tool,
            system::stop_tool,
            system::restart_tool,
            system::health_check_tool,
            system::open_tool_directory,
            system::open_tool_log,
            system::list_volume_candidates,
            system::relocate_module,
            system::clear_module_override,
            system::get_system_stats,
            system::list_running_pids,
            system::read_tool_log,
            system::notify_macos,
            system::list_tool_models,
            system::delete_tool_model,
            system::list_declared_models,
            system::download_tool_model,
            system::list_orphan_ports,
            system::adopt_orphan,
            system::kill_orphan,
            system::append_crash_log,
            system::read_crash_log,
            system::list_marketplace_tools,
            system::import_marketplace_tool,
            system::list_workflows,
            system::save_workflow,
            system::delete_workflow,
            system::run_doctor,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
