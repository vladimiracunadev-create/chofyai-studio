use crate::models::{AppSettings, SystemSummary, ToolSummary};
use serde::Deserialize;
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};
use tauri::{path::BaseDirectory, AppHandle, Manager};
use walkdir::WalkDir;

#[derive(Debug, Deserialize, Clone)]
struct RawManifest {
    id: String,
    name: String,
    category: String,
    runtime: String,
    description: Option<String>,
    recommended: Option<bool>,
    default_port: Option<u16>,
    studio_home_subdir: Option<String>,
    install_script: Option<String>,
    installed_if: Option<Vec<String>>,
    run: Option<RawRun>,
}

#[derive(Debug, Deserialize, Clone)]
struct RawRun {
    command: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct ActionResult {
    pub ok: bool,
    pub message: String,
    pub log_path: Option<String>,
    pub opened_url: Option<String>,
}

#[derive(Debug, Clone)]
struct AppPaths {
    apps_dir: PathBuf,
    settings_path: PathBuf,
}

fn repo_root() -> Option<PathBuf> {
    let cwd = env::current_dir().ok()?;
    let root = if cwd.file_name().and_then(|name| name.to_str()) == Some("src-tauri") {
        cwd.parent()?.to_path_buf()
    } else {
        cwd
    };

    if root.join("apps").exists() && root.join("scripts").exists() && root.join("src-tauri").exists()
    {
        Some(root)
    } else {
        None
    }
}

fn resolve_resource_path(app: &AppHandle, relative: &str) -> Result<PathBuf, String> {
    app.path()
        .resolve(relative, BaseDirectory::Resource)
        .map_err(|e| e.to_string())
}

fn app_paths(app: &AppHandle) -> Result<AppPaths, String> {
    if let Some(root) = repo_root() {
        return Ok(AppPaths {
            apps_dir: root.join("apps"),
            settings_path: root.join("storage").join("state").join("settings.json"),
        });
    }

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(AppPaths {
        apps_dir: resolve_resource_path(app, "apps")?,
        settings_path: app_data_dir.join("state").join("settings.json"),
    })
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_paths(app)?.settings_path)
}

fn script_path(app: &AppHandle, relative: &str) -> Result<PathBuf, String> {
    if let Some(root) = repo_root() {
        return Ok(root.join(relative));
    }

    resolve_resource_path(app, relative)
}

fn default_studio_home() -> String {
    let home = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .unwrap_or_else(|_| "~".to_string());
    format!("{}/ChofyAIStudio", home)
}

fn load_settings(app: &AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app)?;
    if let Ok(contents) = fs::read_to_string(&path) {
        if let Ok(parsed) = serde_json::from_str::<AppSettings>(&contents) {
            return Ok(parsed);
        }
    }

    Ok(AppSettings {
        studio_home: default_studio_home(),
    })
}

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn collect_manifests(app: &AppHandle) -> Result<Vec<(String, RawManifest)>, String> {
    let apps_dir = app_paths(app)?.apps_dir;
    if !apps_dir.exists() {
        return Ok(vec![]);
    }

    let mut manifests = Vec::new();
    for entry in WalkDir::new(&apps_dir)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("yaml"))
    {
        let contents = fs::read_to_string(entry.path()).map_err(|e| e.to_string())?;
        let parsed: RawManifest = serde_yaml::from_str(&contents).map_err(|e| e.to_string())?;
        manifests.push((entry.file_name().to_string_lossy().to_string(), parsed));
    }

    manifests.sort_by(|a, b| a.1.name.cmp(&b.1.name));
    Ok(manifests)
}

fn find_manifest(app: &AppHandle, tool_id: &str) -> Result<(String, RawManifest), String> {
    collect_manifests(app)?
        .into_iter()
        .find(|(_, manifest)| manifest.id == tool_id)
        .ok_or_else(|| format!("No se encontro manifest para {}", tool_id))
}

fn manifest_install_dir(manifest: &RawManifest, studio_home: &Path) -> PathBuf {
    let relative_dir = manifest
        .studio_home_subdir
        .clone()
        .unwrap_or_else(|| format!("tools/{}", manifest.id));
    studio_home.join(relative_dir)
}

fn log_dir(studio_home: &str) -> PathBuf {
    PathBuf::from(studio_home).join("logs")
}

fn open_in_system(target: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(target)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = target;
        Err("Esta accion solo esta disponible en macOS.".to_string())
    }
}

#[tauri::command]
pub fn get_system_summary(app: AppHandle) -> Result<SystemSummary, String> {
    let settings = load_settings(&app)?;
    let settings_file = settings_path(&app)?;

    Ok(SystemSummary {
        app_name: "ChofyAI Studio".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os: env::consts::OS.to_string(),
        arch: env::consts::ARCH.to_string(),
        studio_home: settings.studio_home,
        settings_file: settings_file.display().to_string(),
    })
}

#[tauri::command]
pub fn save_studio_home(app: AppHandle, studio_home: String) -> Result<AppSettings, String> {
    let normalized_home = if studio_home.trim().is_empty() {
        default_studio_home()
    } else {
        studio_home.trim().to_string()
    };

    let settings = AppSettings {
        studio_home: normalized_home,
    };
    let path = settings_path(&app)?;
    ensure_parent(&path)?;
    fs::write(&path, serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(settings)
}

#[tauri::command]
pub fn list_tools(app: AppHandle) -> Result<Vec<ToolSummary>, String> {
    let settings = load_settings(&app)?;
    let studio_home = PathBuf::from(&settings.studio_home);
    let mut tools = Vec::new();

    for (file_name, parsed) in collect_manifests(&app)? {
        let install_dir = manifest_install_dir(&parsed, &studio_home);
        let install_dir_str = install_dir.display().to_string();

        let installed_if = parsed.installed_if.clone().unwrap_or_default();
        let mut installed_checks = Vec::new();
        let mut missing_checks = Vec::new();

        for check in installed_if {
            let full = install_dir.join(&check);
            if full.exists() {
                installed_checks.push(check);
            } else {
                missing_checks.push(check);
            }
        }

        tools.push(ToolSummary {
            file_name,
            id: parsed.id,
            name: parsed.name,
            category: parsed.category,
            runtime: parsed.runtime,
            description: parsed.description.unwrap_or_default(),
            recommended: parsed.recommended.unwrap_or(false),
            default_port: parsed.default_port,
            install_dir: install_dir_str,
            install_script: parsed.install_script,
            run_command: parsed.run.and_then(|r| r.command),
            installed: missing_checks.is_empty() && !installed_checks.is_empty(),
            installed_checks,
            missing_checks,
        });
    }

    Ok(tools)
}

#[tauri::command]
pub fn install_tool(app: AppHandle, tool_id: String) -> Result<ActionResult, String> {
    let (_, manifest) = find_manifest(&app, &tool_id)?;
    let script_rel = manifest
        .install_script
        .clone()
        .ok_or_else(|| format!("{} no tiene install_script", tool_id))?;
    let settings = load_settings(&app)?;

    let script_path = script_path(&app, &script_rel)?;
    if !script_path.exists() {
        return Err(format!("No existe script: {}", script_path.display()));
    }

    let script_dir = script_path
        .parent()
        .ok_or_else(|| format!("No pude resolver la carpeta del script: {}", script_path.display()))?;

    let output = Command::new("bash")
        .arg(script_path.as_os_str())
        .current_dir(script_dir)
        .env("CHOFYAI_STUDIO_HOME", &settings.studio_home)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!(
        "{}{}{}",
        stdout,
        if !stdout.is_empty() && !stderr.is_empty() {
            "\n"
        } else {
            ""
        },
        stderr
    );

    let log_dir = log_dir(&settings.studio_home);
    fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
    let log_path = log_dir.join(format!("{}-install.log", tool_id));
    fs::write(&log_path, combined.as_bytes()).map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(ActionResult {
            ok: true,
            message: format!("Instalacion completada para {}", manifest.name),
            log_path: Some(log_path.display().to_string()),
            opened_url: None,
        })
    } else {
        Err(format!(
            "La instalacion fallo para {}. Revisa {}",
            manifest.name,
            log_path.display()
        ))
    }
}

#[tauri::command]
pub fn start_tool(app: AppHandle, tool_id: String) -> Result<ActionResult, String> {
    let (_, manifest) = find_manifest(&app, &tool_id)?;
    let settings = load_settings(&app)?;
    let studio_home = PathBuf::from(&settings.studio_home);
    let install_dir = manifest_install_dir(&manifest, &studio_home);
    let run_command = manifest
        .run
        .clone()
        .and_then(|r| r.command)
        .ok_or_else(|| format!("{} no tiene run.command", tool_id))?;

    if !install_dir.exists() {
        return Err(format!("No existe la ruta de instalacion: {}", install_dir.display()));
    }

    let log_dir = log_dir(&settings.studio_home);
    fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
    let log_path = log_dir.join(format!("{}-run.log", tool_id));
    let log_file = fs::File::create(&log_path).map_err(|e| e.to_string())?;
    let log_file_err = log_file.try_clone().map_err(|e| e.to_string())?;

    Command::new("bash")
        .arg("-lc")
        .arg(run_command)
        .current_dir(&install_dir)
        .env("CHOFYAI_STUDIO_HOME", &settings.studio_home)
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_file_err))
        .spawn()
        .map_err(|e| e.to_string())?;

    let opened_url = manifest
        .default_port
        .map(|port| format!("http://127.0.0.1:{}", port));

    Ok(ActionResult {
        ok: true,
        message: format!("{} iniciado", manifest.name),
        log_path: Some(log_path.display().to_string()),
        opened_url,
    })
}

#[tauri::command]
pub fn open_tool_directory(app: AppHandle, tool_id: String) -> Result<ActionResult, String> {
    let (_, manifest) = find_manifest(&app, &tool_id)?;
    let settings = load_settings(&app)?;
    let studio_home = PathBuf::from(&settings.studio_home);
    let install_dir = manifest_install_dir(&manifest, &studio_home);

    fs::create_dir_all(&install_dir).map_err(|e| e.to_string())?;
    open_in_system(&install_dir)?;

    Ok(ActionResult {
        ok: true,
        message: format!("Carpeta abierta: {}", install_dir.display()),
        log_path: None,
        opened_url: None,
    })
}

#[tauri::command]
pub fn open_tool_log(app: AppHandle, tool_id: String) -> Result<ActionResult, String> {
    let settings = load_settings(&app)?;
    let log_dir = log_dir(&settings.studio_home);
    let candidates = [
        log_dir.join(format!("{}-run.log", tool_id)),
        log_dir.join(format!("{}-install.log", tool_id)),
    ];

    let existing = candidates
        .iter()
        .find(|path| path.exists())
        .cloned()
        .ok_or_else(|| format!("No hay logs disponibles para {}", tool_id))?;

    open_in_system(&existing)?;

    Ok(ActionResult {
        ok: true,
        message: format!("Log abierto: {}", existing.display()),
        log_path: Some(existing.display().to_string()),
        opened_url: None,
    })
}
