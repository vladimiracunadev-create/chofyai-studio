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
