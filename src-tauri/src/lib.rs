mod models;
mod system;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let _window = app.get_webview_window("main");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            system::get_system_summary,
            system::save_studio_home,
            system::list_tools,
            system::install_tool,
            system::start_tool,
            system::open_tool_directory,
            system::open_tool_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
