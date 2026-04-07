mod models;
mod system;

use std::collections::HashMap;
use std::sync::Mutex;
use system::ProcessRegistry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ProcessRegistry(Mutex::new(HashMap::new())))
        .setup(|app| {
            let _window = app.get_webview_window("main");
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
            system::open_tool_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
