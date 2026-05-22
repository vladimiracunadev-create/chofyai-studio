use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSummary {
    pub app_name: String,
    pub app_version: String,
    pub os: String,
    pub arch: String,
    /// Path solicitado por el usuario en settings.json (puede no existir).
    pub studio_home: String,
    /// Path realmente usado: studio_home si está disponible, fallback al disco principal si no.
    pub studio_home_effective: String,
    /// Si studio_home_effective != studio_home (volumen externo desmontado, etc.).
    pub using_fallback: bool,
    pub settings_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSummary {
    pub file_name: String,
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
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
    /// Si esta herramienta tiene un override de ubicación (zona modules/ o ruta custom).
    pub relocated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub studio_home: String,
    /// Override por tool_id → ruta absoluta del directorio de instalación.
    /// Permite trasladar módulos sin cambiar el manifest.
    #[serde(default)]
    pub tool_overrides: HashMap<String, String>,
    /// Path alternativo cuando el principal no está disponible. Si vacío → ~/ChofyAIStudio.
    #[serde(default)]
    pub fallback_home: Option<String>,
    /// Ruta absoluta a una `.sparsebundle` (APFS) que debe montarse cuando
    /// `studio_home` no esté disponible. Cuando el filesystem nativo es
    /// ExFAT/FAT y no soporta venvs/symlinks, la imagen APFS es la única vía.
    #[serde(default)]
    pub sparsebundle_path: Option<String>,
    /// Override del directorio de modelos. Si está vacío → `<studio_home>/models`.
    /// Se propaga a los scripts vía CHOFYAI_MODELS_DIR.
    #[serde(default)]
    pub models_dir: Option<String>,
    /// Override del directorio de salidas. Si está vacío → `<studio_home>/outputs`.
    /// Se propaga a los scripts vía CHOFYAI_OUTPUTS_DIR.
    #[serde(default)]
    pub outputs_dir: Option<String>,
    /// Override del directorio de caché. Si está vacío → `<studio_home>/cache`.
    /// Se propaga a los scripts vía CHOFYAI_CACHE_DIR.
    #[serde(default)]
    pub cache_dir: Option<String>,
}

/// Resultado de un health check sobre una herramienta.
#[derive(Debug, Clone, Serialize)]
pub struct HealthResult {
    pub tool_id: String,
    pub running: bool,
    pub port_open: bool,
    pub pid: Option<u32>,
}

/// Evento de progreso emitido línea a línea durante la instalación.
#[derive(Debug, Clone, Serialize)]
pub struct InstallEvent {
    pub tool_id: String,
    pub line: String,
}

/// Información de un volumen disponible (para selector de Studio Home).
#[derive(Debug, Clone, Serialize)]
pub struct VolumeCandidate {
    pub path: String,
    pub label: String,
    pub kind: String, // "home" | "external" | "custom"
    pub mounted: bool,
    pub writable: bool,
    pub free_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
}

/// Estadísticas en vivo del equipo para la barra inferior.
#[derive(Debug, Clone, Serialize)]
pub struct SystemStats {
    pub cpu_usage: f32,         // 0..100
    pub cpu_cores: u32,
    pub mem_used_bytes: u64,
    pub mem_total_bytes: u64,
    pub disk_free_bytes: u64,
    pub disk_total_bytes: u64,
    pub disk_path: String,
    pub uptime_secs: u64,
    pub load_avg_1m: f32,
}
