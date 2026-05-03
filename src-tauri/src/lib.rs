mod models;
mod system;

use std::collections::HashMap;
use std::sync::Mutex;
use system::ProcessRegistry;
use tauri::Manager;

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
            system::list_orphan_ports,
            system::adopt_orphan,
            system::kill_orphan,
            system::append_crash_log,
            system::read_crash_log,
            system::list_marketplace_tools,
            system::import_marketplace_tool,
            system::list_workflows,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
