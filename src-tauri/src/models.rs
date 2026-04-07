use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSummary {
    pub app_name: String,
    pub app_version: String,
    pub os: String,
    pub arch: String,
    pub studio_home: String,
    pub settings_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSummary {
    pub file_name: String,
    pub id: String,
    pub name: String,
    pub category: String,
    pub runtime: String,
    pub description: String,
    pub recommended: bool,
    pub default_port: Option<u16>,
    pub install_dir: String,
    pub install_script: Option<String>,
    pub run_command: Option<String>,
    pub installed: bool,
    pub installed_checks: Vec<String>,
    pub missing_checks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub studio_home: String,
}

/// Resultado de un health check sobre una herramienta.
#[derive(Debug, Clone, Serialize)]
pub struct HealthResult {
    pub tool_id: String,
    /// El PID está registrado (el proceso fue iniciado desde la app).
    pub running: bool,
    /// El puerto TCP responde (el servidor HTTP está activo).
    pub port_open: bool,
    pub pid: Option<u32>,
}

/// Evento de progreso emitido línea a línea durante la instalación.
#[derive(Debug, Clone, Serialize)]
pub struct InstallEvent {
    pub tool_id: String,
    pub line: String,
}
