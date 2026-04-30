mod models;
mod system;

use std::collections::HashMap;
use std::sync::Mutex;
use system::ProcessRegistry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ProcessRegistry(Mutex::new(HashMap::new())))
        .setup(|_app| {
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            system::get_system_summary,
            system::save_studio_home,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
