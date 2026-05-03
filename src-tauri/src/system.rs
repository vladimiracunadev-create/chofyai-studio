use crate::models::{
    AppSettings, HealthResult, InstallEvent, SystemStats, SystemSummary, ToolSummary,
    VolumeCandidate,
};
use serde::Deserialize;
use std::{
    collections::HashMap,
    env, fs,
    io::{BufRead, BufReader},
    net::TcpStream,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
    time::Duration,
};
use tauri::{path::BaseDirectory, AppHandle, Emitter, Manager};
use walkdir::WalkDir;

// ─── Registro de PIDs ────────────────────────────────────────────────────────

pub struct ProcessRegistry(pub Mutex<HashMap<String, u32>>);

fn processes_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let p = app_paths(app)?.settings_path;
    Ok(p.parent()
        .ok_or_else(|| "settings_path sin parent".to_string())?
        .join("processes.json"))
}


fn persist_registry(app: &AppHandle, map: &HashMap<String, u32>) {
    if let Ok(path) = processes_state_path(app) {
        let _ = fs::create_dir_all(path.parent().unwrap_or(Path::new(".")));
        if let Ok(json) = serde_json::to_string_pretty(map) {
            let _ = fs::write(&path, json);
        }
    }
}

pub fn restore_registry(app: &AppHandle, registry: &ProcessRegistry) {
    let path = match processes_state_path(app) {
        Ok(p) => p,
        Err(_) => return,
    };
    if !path.exists() {
        return;
    }
    let contents = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return,
    };
    let prev: HashMap<String, u32> = match serde_json::from_str(&contents) {
        Ok(m) => m,
        Err(_) => return,
    };
    let alive: HashMap<String, u32> = prev.into_iter().filter(|(_, pid)| pid_is_alive(*pid)).collect();
    if let Ok(mut guard) = registry.0.lock() {
        for (k, v) in alive.iter() {
            guard.insert(k.clone(), *v);
        }
    }
    persist_registry(app, &alive);
}

#[tauri::command]
pub fn list_running_pids(
    registry: tauri::State<'_, ProcessRegistry>,
) -> Result<HashMap<String, u32>, String> {
    let guard = registry.0.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
pub fn read_tool_log(
    app: AppHandle,
    tool_id: String,
    kind: String,
    last_lines: Option<usize>,
) -> Result<String, String> {
    let settings = load_settings(&app)?;
    let effective = resolve_effective_home(&settings);
    let logs = log_dir(&effective);
    let suffix = match kind.as_str() {
        "install" => "install",
        "run" => "run",
        other => return Err(format!("kind inválido: {}", other)),
    };
    let path = logs.join(format!("{}-{}.log", tool_id, suffix));
    if !path.exists() {
        return Ok(format!("(sin log {} aún en {})", suffix, path.display()));
    }
    let contents = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let n = last_lines.unwrap_or(500);
    let lines: Vec<&str> = contents.lines().collect();
    let tail = if lines.len() > n { &lines[lines.len() - n..] } else { &lines[..] };
    Ok(tail.join("\n"))
}

// ─── Estructuras internas ─────────────────────────────────────────────────────

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

// ─── Helpers de rutas ─────────────────────────────────────────────────────────

fn repo_root() -> Option<PathBuf> {
    let cwd = env::current_dir().ok()?;
    let root = if cwd.file_name().and_then(|n| n.to_str()) == Some("src-tauri") {
        cwd.parent()?.to_path_buf()
    } else {
        cwd
    };
    if root.join("apps").exists() && root.join("scripts").exists() && root.join("src-tauri").exists() {
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

fn home_dir() -> PathBuf {
    PathBuf::from(
        env::var("HOME")
            .or_else(|_| env::var("USERPROFILE"))
            .unwrap_or_else(|_| ".".to_string()),
    )
}

fn default_studio_home() -> String {
    home_dir().join("ChofyAIStudio").display().to_string()
}

fn fallback_home_for(settings: &AppSettings) -> String {
    settings
        .fallback_home
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(default_studio_home)
}

/// Comprueba si un path apunta a un volumen montado y se puede escribir.
fn path_is_usable(path: &Path) -> bool {
    // Si el path existe y es directorio escribible → ok.
    if path.exists() {
        return is_writable_dir(path);
    }
    // Si no existe, mira si su padre montado existe y es escribible (lo crearemos).
    let mut p = path.to_path_buf();
    while let Some(parent) = p.parent() {
        if parent.exists() {
            return is_writable_dir(parent);
        }
        p = parent.to_path_buf();
    }
    false
}

fn is_writable_dir(path: &Path) -> bool {
    if !path.is_dir() {
        return false;
    }
    let probe = path.join(".chofyai-write-probe");
    match fs::write(&probe, b"") {
        Ok(_) => {
            let _ = fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

/// Resuelve el `studio_home` efectivo: si el path solicitado es válido, lo usa;
/// si no (volumen desmontado, no escribible), cae al fallback (~/ChofyAIStudio).
/// Crea el directorio si no existe.
fn resolve_effective_home(settings: &AppSettings) -> String {
    let requested = PathBuf::from(&settings.studio_home);
    if path_is_usable(&requested) {
        let _ = fs::create_dir_all(&requested);
        return settings.studio_home.clone();
    }
    let fallback = fallback_home_for(settings);
    let fb_path = PathBuf::from(&fallback);
    let _ = fs::create_dir_all(&fb_path);
    fallback
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
        tool_overrides: HashMap::new(),
        fallback_home: None,
    })
}

fn save_settings_to_disk(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    ensure_parent(&path)?;
    fs::write(
        &path,
        serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
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
        .find(|(_, m)| m.id == tool_id)
        .ok_or_else(|| format!("No se encontro manifest para {}", tool_id))
}

/// Devuelve la ruta de instalación final de una herramienta:
/// 1. Si hay override en settings → respeta ruta absoluta.
/// 2. Si no, studio_home_effective + studio_home_subdir (o tools/{id} por defecto).
fn manifest_install_dir(
    manifest: &RawManifest,
    studio_home: &Path,
    overrides: &HashMap<String, String>,
) -> PathBuf {
    if let Some(override_path) = overrides.get(&manifest.id) {
        let p = PathBuf::from(override_path);
        if p.is_absolute() {
            return p;
        }
        return studio_home.join(p);
    }
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
        Command::new("open").arg(target).spawn().map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = target;
        Err("Esta accion solo esta disponible en macOS.".to_string())
    }
}

fn pid_is_alive(pid: u32) -> bool {
    Command::new("kill")
        .args(["-0", &pid.to_string()])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn run_install_script(
    app: &AppHandle,
    tool_id: &str,
    manifest: &RawManifest,
    studio_home: &str,
) -> Result<ActionResult, String> {
    let script_rel = manifest
        .install_script
        .clone()
        .ok_or_else(|| format!("{} no tiene install_script", tool_id))?;

    let script = script_path(app, &script_rel)?;
    if !script.exists() {
        return Err(format!("No existe script: {}", script.display()));
    }
    let script_dir = script
        .parent()
        .ok_or_else(|| format!("No pude resolver la carpeta del script: {}", script.display()))?;

    let mut child = Command::new("bash")
        .arg(script.as_os_str())
        .current_dir(script_dir)
        .env("CHOFYAI_STUDIO_HOME", studio_home)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().expect("stdout piped");
    let app_handle = app.clone();
    let tid = tool_id.to_string();
    let stdout_thread = std::thread::spawn(move || {
        let mut buf = String::new();
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            let _ = app_handle.emit("install-progress", InstallEvent {
                tool_id: tid.clone(),
                line: line.clone(),
            });
            buf.push_str(&line);
            buf.push('\n');
        }
        buf
    });

    let stderr_output = child
        .stderr
        .take()
        .map(|s| BufReader::new(s).lines().map_while(Result::ok).collect::<Vec<_>>().join("\n"))
        .unwrap_or_default();

    let status = child.wait().map_err(|e| e.to_string())?;
    let stdout_output = stdout_thread.join().unwrap_or_default();
    let combined = format!("{}\n{}", stdout_output, stderr_output);

    let logs = log_dir(studio_home);
    fs::create_dir_all(&logs).map_err(|e| e.to_string())?;
    let log_path = logs.join(format!("{}-install.log", tool_id));
    fs::write(&log_path, combined.as_bytes()).map_err(|e| e.to_string())?;

    let _ = app.emit("install-done", InstallEvent {
        tool_id: tool_id.to_string(),
        line: if status.success() {
            format!("OK: {} instalado", manifest.name)
        } else {
            format!("ERROR: instalacion fallo para {}", manifest.name)
        },
    });

    if status.success() {
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

// ─── Stats del sistema (sin dependencias extra) ───────────────────────────────

fn run_capture(cmd: &str, args: &[&str]) -> Option<String> {
    Command::new(cmd)
        .args(args)
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
}

fn read_cpu_cores() -> u32 {
    run_capture("sysctl", &["-n", "hw.ncpu"])
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(0)
}

fn read_mem_total() -> u64 {
    run_capture("sysctl", &["-n", "hw.memsize"])
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(0)
}

/// Lee uso de memoria con vm_stat (devuelve bytes usados).
fn read_mem_used() -> u64 {
    let total = read_mem_total();
    let out = match run_capture("vm_stat", &[]) {
        Some(s) => s,
        None => return 0,
    };
    let mut page_size: u64 = 16384; // default Apple Silicon
    let mut free: u64 = 0;
    let mut inactive: u64 = 0;
    let mut speculative: u64 = 0;
    for line in out.lines() {
        if let Some(rest) = line.strip_prefix("Mach Virtual Memory Statistics: (page size of ") {
            if let Some(num) = rest.split(' ').next() {
                if let Ok(n) = num.parse::<u64>() { page_size = n; }
            }
        } else if let Some(v) = line.strip_prefix("Pages free:") {
            free = parse_pages(v);
        } else if let Some(v) = line.strip_prefix("Pages inactive:") {
            inactive = parse_pages(v);
        } else if let Some(v) = line.strip_prefix("Pages speculative:") {
            speculative = parse_pages(v);
        }
    }
    let available = (free + inactive + speculative) * page_size;
    total.saturating_sub(available)
}

fn parse_pages(s: &str) -> u64 {
    s.trim().trim_end_matches('.').replace(',', "").parse().unwrap_or(0)
}

/// Uso de CPU 0..100 leyendo `top -l 2` (segunda muestra para que sea instantáneo real).
fn read_cpu_usage() -> f32 {
    let out = match run_capture("top", &["-l", "1", "-n", "0"]) {
        Some(s) => s,
        None => return 0.0,
    };
    for line in out.lines() {
        if let Some(rest) = line.strip_prefix("CPU usage:") {
            // "CPU usage: 5.12% user, 8.20% sys, 86.67% idle"
            if let Some(idle_part) = rest.split(',').find(|p| p.contains("idle")) {
                let num = idle_part.trim().split('%').next().unwrap_or("0").trim();
                if let Ok(idle) = num.parse::<f32>() {
                    return (100.0 - idle).max(0.0).min(100.0);
                }
            }
        }
    }
    0.0
}

fn read_load_avg() -> f32 {
    run_capture("sysctl", &["-n", "vm.loadavg"])
        .and_then(|s| {
            // "{ 1.50 1.20 0.95 }"
            s.split_whitespace()
                .nth(1)
                .and_then(|n| n.parse::<f32>().ok())
        })
        .unwrap_or(0.0)
}

fn read_uptime() -> u64 {
    run_capture("sysctl", &["-n", "kern.boottime"])
        .and_then(|s| {
            let sec = s.split("sec = ").nth(1)?.split(',').next()?.trim().parse::<u64>().ok()?;
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .ok()?
                .as_secs();
            Some(now.saturating_sub(sec))
        })
        .unwrap_or(0)
}

/// Usa `df -k <path>` para obtener total/free en bytes.
fn read_disk_usage(path: &Path) -> (u64, u64) {
    let target = if path.exists() { path.to_path_buf() } else { home_dir() };
    let out = match run_capture("df", &["-k", &target.display().to_string()]) {
        Some(s) => s,
        None => return (0, 0),
    };
    // Filesystem 1024-blocks Used Available ...
    let last_line = out.lines().last().unwrap_or("");
    let cols: Vec<&str> = last_line.split_whitespace().collect();
    if cols.len() < 4 {
        return (0, 0);
    }
    let total_kb: u64 = cols[1].parse().unwrap_or(0);
    let avail_kb: u64 = cols[3].parse().unwrap_or(0);
    (total_kb * 1024, avail_kb * 1024)
}

/// Lista volúmenes externos montados en /Volumes (excluyendo el de sistema raíz).
fn list_external_volumes() -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Ok(entries) = fs::read_dir("/Volumes") {
        for entry in entries.filter_map(Result::ok) {
            let p = entry.path();
            if p.is_dir() {
                out.push(p);
            }
        }
    }
    out
}

// ─── Comandos Tauri ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_system_summary(app: AppHandle) -> Result<SystemSummary, String> {
    let settings = load_settings(&app)?;
    let effective = resolve_effective_home(&settings);
    let using_fallback = effective != settings.studio_home;
    let settings_file = settings_path(&app)?;
    Ok(SystemSummary {
        app_name: "ChofyAI Studio".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os: env::consts::OS.to_string(),
        arch: env::consts::ARCH.to_string(),
        studio_home: settings.studio_home,
        studio_home_effective: effective,
        using_fallback,
        settings_file: settings_file.display().to_string(),
    })
}

#[tauri::command]
pub fn save_studio_home(app: AppHandle, studio_home: String) -> Result<AppSettings, String> {
    let mut settings = load_settings(&app)?;
    let normalized = if studio_home.trim().is_empty() {
        default_studio_home()
    } else {
        studio_home.trim().to_string()
    };
    settings.studio_home = normalized;
    save_settings_to_disk(&app, &settings)?;
    Ok(settings)
}

#[tauri::command]
pub fn list_volume_candidates() -> Vec<VolumeCandidate> {
    let mut out: Vec<VolumeCandidate> = Vec::new();

    // Disco principal
    let home = home_dir().join("ChofyAIStudio");
    let (total, free) = read_disk_usage(&home);
    out.push(VolumeCandidate {
        path: home.display().to_string(),
        label: "Disco principal (~)".to_string(),
        kind: "home".to_string(),
        mounted: true,
        writable: true,
        free_bytes: Some(free),
        total_bytes: Some(total),
    });

    // Volúmenes externos
    for vol in list_external_volumes() {
        let candidate = vol.join("ChofyAIStudio");
        let label = vol
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| vol.display().to_string());
        let writable = is_writable_dir(&vol);
        let (total, free) = read_disk_usage(&vol);
        out.push(VolumeCandidate {
            path: candidate.display().to_string(),
            label: format!("Volumen: {}", label),
            kind: "external".to_string(),
            mounted: vol.exists(),
            writable,
            free_bytes: Some(free),
            total_bytes: Some(total),
        });
    }

    out
}

#[tauri::command]
pub fn list_tools(app: AppHandle) -> Result<Vec<ToolSummary>, String> {
    let settings = load_settings(&app)?;
    let effective = resolve_effective_home(&settings);
    let studio_home = PathBuf::from(&effective);
    let mut tools = Vec::new();

    for (file_name, parsed) in collect_manifests(&app)? {
        let install_dir = manifest_install_dir(&parsed, &studio_home, &settings.tool_overrides);
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

        let relocated = settings.tool_overrides.contains_key(&parsed.id);

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
            relocated,
        });
    }
    Ok(tools)
}

#[tauri::command]
pub fn install_tool(app: AppHandle, tool_id: String) -> Result<ActionResult, String> {
    let (_, manifest) = find_manifest(&app, &tool_id)?;
    let settings = load_settings(&app)?;
    let effective = resolve_effective_home(&settings);
    run_install_script(&app, &tool_id, &manifest, &effective)
}

#[tauri::command]
pub fn update_tool(app: AppHandle, tool_id: String) -> Result<ActionResult, String> {
    let (_, manifest) = find_manifest(&app, &tool_id)?;
    let settings = load_settings(&app)?;
    let effective = resolve_effective_home(&settings);

    let install_dir = manifest_install_dir(
        &manifest,
        &PathBuf::from(&effective),
        &settings.tool_overrides,
    );
    let installed_if = manifest.installed_if.clone().unwrap_or_default();
    let is_installed = !installed_if.is_empty()
        && installed_if.iter().all(|c| install_dir.join(c).exists());

    if !is_installed {
        return Err(format!(
            "{} no está instalado. Usa Instalar primero.",
            manifest.name
        ));
    }

    run_install_script(&app, &tool_id, &manifest, &effective).map(|mut r| {
        r.message = format!("Actualización completada para {}", manifest.name);
        r
    })
}

#[tauri::command]
pub fn start_tool(
    app: AppHandle,
    tool_id: String,
    registry: tauri::State<'_, ProcessRegistry>,
) -> Result<ActionResult, String> {
    let (_, manifest) = find_manifest(&app, &tool_id)?;
    let settings = load_settings(&app)?;
    let effective = resolve_effective_home(&settings);
    let studio_home = PathBuf::from(&effective);
    let install_dir = manifest_install_dir(&manifest, &studio_home, &settings.tool_overrides);
    let run_command = manifest
        .run
        .clone()
        .and_then(|r| r.command)
        .ok_or_else(|| format!("{} no tiene run.command", tool_id))?;

    if !install_dir.exists() {
        return Err(format!(
            "No existe la ruta de instalacion: {}",
            install_dir.display()
        ));
    }

    let logs = log_dir(&effective);
    fs::create_dir_all(&logs).map_err(|e| e.to_string())?;
    let log_path = logs.join(format!("{}-run.log", tool_id));
    let log_file = fs::File::create(&log_path).map_err(|e| e.to_string())?;
    let log_file_err = log_file.try_clone().map_err(|e| e.to_string())?;

    let child = Command::new("bash")
        .arg("-lc")
        .arg(&run_command)
        .current_dir(&install_dir)
        .env("CHOFYAI_STUDIO_HOME", &effective)
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_file_err))
        .spawn()
        .map_err(|e| e.to_string())?;

    let pid = child.id();
    {
        let mut guard = registry.0.lock().map_err(|e| e.to_string())?;
        guard.insert(tool_id.clone(), pid);
        persist_registry(&app, &guard);
    }

    let opened_url = manifest.default_port.map(|p| format!("http://127.0.0.1:{}", p));

    Ok(ActionResult {
        ok: true,
        message: format!("{} iniciado (PID {})", manifest.name, pid),
        log_path: Some(log_path.display().to_string()),
        opened_url,
    })
}

#[tauri::command]
pub fn stop_tool(
    app: AppHandle,
    tool_id: String,
    registry: tauri::State<'_, ProcessRegistry>,
) -> Result<ActionResult, String> {
    let mut pids = registry.0.lock().map_err(|e| e.to_string())?;

    if let Some(pid) = pids.remove(&tool_id) {
        Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .output()
            .map_err(|e| e.to_string())?;
        persist_registry(&app, &pids);
        Ok(ActionResult {
            ok: true,
            message: format!("{} detenido (PID {})", tool_id, pid),
            log_path: None,
            opened_url: None,
        })
    } else {
        Ok(ActionResult {
            ok: false,
            message: format!("{} no tiene proceso activo registrado", tool_id),
            log_path: None,
            opened_url: None,
        })
    }
}

#[tauri::command]
pub fn restart_tool(
    app: AppHandle,
    tool_id: String,
    registry: tauri::State<'_, ProcessRegistry>,
) -> Result<ActionResult, String> {
    {
        let mut pids = registry.0.lock().map_err(|e| e.to_string())?;
        if let Some(pid) = pids.remove(&tool_id) {
            let _ = Command::new("kill").args(["-TERM", &pid.to_string()]).output();
            persist_registry(&app, &pids);
            std::thread::sleep(Duration::from_millis(800));
        }
    }

    let (_, manifest) = find_manifest(&app, &tool_id)?;
    let settings = load_settings(&app)?;
    let effective = resolve_effective_home(&settings);
    let studio_home = PathBuf::from(&effective);
    let install_dir = manifest_install_dir(&manifest, &studio_home, &settings.tool_overrides);
    let run_command = manifest
        .run
        .clone()
        .and_then(|r| r.command)
        .ok_or_else(|| format!("{} no tiene run.command", tool_id))?;

    let logs = log_dir(&effective);
    fs::create_dir_all(&logs).map_err(|e| e.to_string())?;
    let log_path = logs.join(format!("{}-run.log", tool_id));
    let log_file = fs::File::create(&log_path).map_err(|e| e.to_string())?;
    let log_file_err = log_file.try_clone().map_err(|e| e.to_string())?;

    let child = Command::new("bash")
        .arg("-lc")
        .arg(&run_command)
        .current_dir(&install_dir)
        .env("CHOFYAI_STUDIO_HOME", &effective)
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_file_err))
        .spawn()
        .map_err(|e| e.to_string())?;

    let pid = child.id();
    {
        let mut guard = registry.0.lock().map_err(|e| e.to_string())?;
        guard.insert(tool_id.clone(), pid);
        persist_registry(&app, &guard);
    }

    Ok(ActionResult {
        ok: true,
        message: format!("{} reiniciado (PID {})", manifest.name, pid),
        log_path: Some(log_path.display().to_string()),
        opened_url: manifest.default_port.map(|p| format!("http://127.0.0.1:{}", p)),
    })
}

#[tauri::command]
pub fn health_check_tool(
    app: AppHandle,
    tool_id: String,
    registry: tauri::State<'_, ProcessRegistry>,
) -> Result<HealthResult, String> {
    let (_, manifest) = find_manifest(&app, &tool_id)?;

    let pid = {
        let pids = registry.0.lock().map_err(|e| e.to_string())?;
        pids.get(&tool_id).copied()
    };

    let running = pid.map(pid_is_alive).unwrap_or(false);

    if pid.is_some() && !running {
        if let Ok(mut pids) = registry.0.lock() {
            pids.remove(&tool_id);
            persist_registry(&app, &pids);
        }
    }

    let port_open = manifest
        .default_port
        .map(|port| {
            TcpStream::connect_timeout(
                &format!("127.0.0.1:{}", port).parse().unwrap(),
                Duration::from_secs(2),
            )
            .is_ok()
        })
        .unwrap_or(false);

    Ok(HealthResult {
        tool_id,
        running,
        port_open,
        pid,
    })
}

#[tauri::command]
pub fn open_tool_directory(app: AppHandle, tool_id: String) -> Result<ActionResult, String> {
    let (_, manifest) = find_manifest(&app, &tool_id)?;
    let settings = load_settings(&app)?;
    let effective = resolve_effective_home(&settings);
    let studio_home = PathBuf::from(&effective);
    let install_dir = manifest_install_dir(&manifest, &studio_home, &settings.tool_overrides);
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
    let effective = resolve_effective_home(&settings);
    let logs = log_dir(&effective);
    let candidates = [
        logs.join(format!("{}-run.log", tool_id)),
        logs.join(format!("{}-install.log", tool_id)),
    ];
    let existing = candidates
        .iter()
        .find(|p| p.exists())
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

// ─── Fase D: zona de módulos y traslado ─────────────────────────────────────

/// Mueve el directorio instalado de una herramienta a `target_dir` (absoluto).
/// Registra el override en settings para que start/install futuros sigan la nueva ruta.
/// Si el destino existe y no está vacío, falla.
#[tauri::command]
pub fn relocate_module(
    app: AppHandle,
    tool_id: String,
    target_dir: String,
) -> Result<ActionResult, String> {
    let (_, manifest) = find_manifest(&app, &tool_id)?;
    let mut settings = load_settings(&app)?;
    let effective = resolve_effective_home(&settings);
    let current_dir = manifest_install_dir(
        &manifest,
        &PathBuf::from(&effective),
        &settings.tool_overrides,
    );

    let target = PathBuf::from(target_dir.trim());
    if !target.is_absolute() {
        return Err("La ruta de destino debe ser absoluta.".to_string());
    }
    if target == current_dir {
        return Err("El destino es igual al origen.".to_string());
    }
    if target.exists() {
        let empty = fs::read_dir(&target)
            .map(|mut it| it.next().is_none())
            .unwrap_or(false);
        if !empty {
            return Err(format!(
                "El destino ya existe y no está vacío: {}",
                target.display()
            ));
        }
        // está vacío → borrar para que rename funcione limpio
        let _ = fs::remove_dir(&target);
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        if !is_writable_dir(parent) {
            return Err(format!("Sin permisos de escritura en {}", parent.display()));
        }
    }

    if current_dir.exists() {
        // Intento rename (rápido, mismo volumen). Si falla por cross-device, copio + borro.
        if let Err(_) = fs::rename(&current_dir, &target) {
            copy_dir_recursive(&current_dir, &target)
                .map_err(|e| format!("Copia falló: {}", e))?;
            fs::remove_dir_all(&current_dir).map_err(|e| e.to_string())?;
        }
    } else {
        fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    }

    settings
        .tool_overrides
        .insert(tool_id.clone(), target.display().to_string());
    save_settings_to_disk(&app, &settings)?;

    Ok(ActionResult {
        ok: true,
        message: format!("{} reubicado en {}", manifest.name, target.display()),
        log_path: None,
        opened_url: None,
    })
}

/// Quita un override y vuelve a la ruta por defecto (sin mover archivos automáticamente).
#[tauri::command]
pub fn clear_module_override(app: AppHandle, tool_id: String) -> Result<AppSettings, String> {
    let mut settings = load_settings(&app)?;
    settings.tool_overrides.remove(&tool_id);
    save_settings_to_disk(&app, &settings)?;
    Ok(settings)
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else if ty.is_symlink() {
            let target = fs::read_link(&from)?;
            #[cfg(unix)]
            std::os::unix::fs::symlink(&target, &to)?;
        } else {
            fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

// ─── Stats del equipo ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_system_stats(app: AppHandle) -> Result<SystemStats, String> {
    let settings = load_settings(&app)?;
    let effective = resolve_effective_home(&settings);
    let disk_path = PathBuf::from(&effective);
    let (total, free) = read_disk_usage(&disk_path);
    let mem_total = read_mem_total();
    let mem_used = read_mem_used();
    Ok(SystemStats {
        cpu_usage: read_cpu_usage(),
        cpu_cores: read_cpu_cores(),
        mem_used_bytes: mem_used,
        mem_total_bytes: mem_total,
        disk_free_bytes: free,
        disk_total_bytes: total,
        disk_path: effective,
        uptime_secs: read_uptime(),
        load_avg_1m: read_load_avg(),
    })
}
