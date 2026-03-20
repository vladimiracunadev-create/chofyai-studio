import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ActionResult, AppSettings, SystemSummary, ToolManifest } from './types';

const fallbackTools: ToolManifest[] = [
  {
    file_name: 'qwen3-tts.yaml',
    id: 'qwen3-tts',
    name: 'Qwen3-TTS',
    category: 'voice',
    runtime: 'python',
    default_port: 7860,
    installed: false,
    description: 'TTS y clonación de voz con backend MLX/Apple Silicon.',
    recommended: true,
    install_dir: '~/ChofyAIStudio/tools/qwen3-tts',
    install_script: 'scripts/mac/install-qwen3-tts.sh',
    run_command: 'cd app && env/bin/python -m uvicorn server:app --host 127.0.0.1 --port 7860',
    installed_checks: [],
    missing_checks: ['launcher/.git', 'app/env', 'app/models'],
  },
  {
    file_name: 'whispercpp.yaml',
    id: 'whispercpp',
    name: 'whisper.cpp',
    category: 'asr',
    runtime: 'binary',
    installed: false,
    description: 'ASR local y transcripción con foco en Apple Silicon.',
    recommended: true,
    default_port: 8178,
    install_dir: '~/ChofyAIStudio/tools/whispercpp',
    install_script: 'scripts/mac/install-whispercpp.sh',
    run_command: 'source/build/bin/whisper-server --host 127.0.0.1 --port 8178 -m models/ggml-base.en.bin',
    installed_checks: [],
    missing_checks: ['source/.git', 'source/build/bin/whisper-cli', 'models/ggml-base.en.bin'],
  },
  {
    file_name: 'facefusion.yaml',
    id: 'facefusion',
    name: 'FaceFusion',
    category: 'video',
    runtime: 'python',
    installed: false,
    description: 'Face swap y utilidades de video/cara.',
    recommended: true,
    install_dir: '~/ChofyAIStudio/tools/facefusion',
    install_script: 'scripts/mac/install-facefusion.sh',
    run_command: 'source env/bin/activate && cd source && python facefusion.py run --open-browser',
    installed_checks: [],
    missing_checks: ['source/.git', 'env', 'source/facefusion.py'],
  },
  {
    file_name: 'comfyui.yaml',
    id: 'comfyui',
    name: 'ComfyUI',
    category: 'image',
    runtime: 'python',
    default_port: 8188,
    installed: false,
    description: 'Workflows visuales para imagen.',
    recommended: true,
    install_dir: '~/ChofyAIStudio/tools/comfyui',
    installed_checks: [],
    missing_checks: ['venv'],
  },
  {
    file_name: 'aceforge.yaml',
    id: 'aceforge',
    name: 'AceForge',
    category: 'music',
    runtime: 'python',
    default_port: 5056,
    installed: false,
    description: 'Workstation musical local-first para Apple Silicon basada en ACE-Step.',
    recommended: true,
    install_dir: '~/ChofyAIStudio/tools/aceforge',
    install_script: 'scripts/mac/install-aceforge.sh',
    run_command: 'source env/bin/activate && cd source && python music_forge_ui.py',
    installed_checks: [],
    missing_checks: ['source/.git', 'env', 'source/music_forge_ui.py'],
  },
];

function categoryLabel(category: ToolManifest['category']) {
  const map = {
    voice: 'Voz',
    asr: 'ASR',
    video: 'Video/Cara',
    image: 'Imágenes',
    music: 'Música',
    system: 'Sistema',
  } as const;

  return map[category];
}

export default function App() {
  const [summary, setSummary] = useState<SystemSummary | null>(null);
  const [tools, setTools] = useState<ToolManifest[]>(fallbackTools);
  const [message, setMessage] = useState<string>('Fase 2: Qwen3-TTS, whisper.cpp, FaceFusion y AceForge ya tienen instalación real desde la UI (ComfyUI queda fuera por ahora).');
  const [studioHomeInput, setStudioHomeInput] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [busyToolId, setBusyToolId] = useState<string | null>(null);

  const reloadTools = async () => {
    try {
      const manifestTools = await invoke<ToolManifest[]>('list_tools');
      setTools(manifestTools);
    } catch {
      setTools(fallbackTools);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const system = await invoke<SystemSummary>('get_system_summary');
        setSummary(system);
        setStudioHomeInput(system.studio_home);
      } catch {
        setSummary({
          app_name: 'ChofyAI Studio',
          app_version: '0.1.0',
          os: 'macOS / Apple Silicon',
          arch: 'arm64',
          studio_home: '~/ChofyAIStudio',
          settings_file: 'storage/state/settings.json',
        });
        setStudioHomeInput('~/ChofyAIStudio');
      }

      await reloadTools();
    };

    void load();
  }, []);

  const installedCount = useMemo(() => tools.filter((tool) => tool.installed).length, [tools]);

  const saveStudioHome = async () => {
    try {
      const saved = await invoke<AppSettings>('save_studio_home', { studioHome: studioHomeInput });
      setStudioHomeInput(saved.studio_home);
      setSummary((prev) => prev ? { ...prev, studio_home: saved.studio_home } : prev);
      await reloadTools();
      setSaveMessage('Ruta guardada. Ahora la UI usa este Studio Home para instalar y arrancar herramientas.');
    } catch {
      setSaveMessage('No se pudo guardar la ruta desde la UI.');
    }
  };

  const handleInstall = async (tool: ToolManifest) => {
    setBusyToolId(tool.id);
    setMessage(`Instalando ${tool.name}...`);
    try {
      const result = await invoke<ActionResult>('install_tool', { toolId: tool.id });
      await reloadTools();
      setMessage(result.message + (result.log_path ? ` · Log: ${result.log_path}` : ''));
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusyToolId(null);
    }
  };

  const handleStart = async (tool: ToolManifest) => {
    setBusyToolId(tool.id);
    setMessage(`Iniciando ${tool.name}...`);
    try {
      const result = await invoke<ActionResult>('start_tool', { toolId: tool.id });
      if (result.opened_url) {
        window.open(result.opened_url, '_blank');
      }
      setMessage(result.message + (result.log_path ? ` · Log: ${result.log_path}` : ''));
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusyToolId(null);
    }
  };

  const handleOpenFolder = async (tool: ToolManifest) => {
    try {
      const result = await invoke<ActionResult>('open_tool_directory', { toolId: tool.id });
      setMessage(result.message);
    } catch (error) {
      setMessage(String(error));
    }
  };

  const handleOpenLog = async (tool: ToolManifest) => {
    try {
      const result = await invoke<ActionResult>('open_tool_log', { toolId: tool.id });
      setMessage(result.message);
    } catch (error) {
      setMessage(String(error));
    }
  };

  return (
    <main className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">C</span>
          <div>
            <h1>ChofyAI Studio</h1>
            <p>Launcher local para voz, video, imágenes y música.</p>
          </div>
        </div>

        <nav>
          <button className="nav-item active">Dashboard</button>
          <button className="nav-item">Tools</button>
          <button className="nav-item">Models</button>
          <button className="nav-item">Voices</button>
          <button className="nav-item">Outputs</button>
          <button className="nav-item">Logs</button>
          <button className="nav-item">Settings</button>
          <button className="nav-item">Doctor</button>
        </nav>
      </aside>

      <section className="content">
        <header className="hero card">
          <div>
            <span className="badge">Fase 2</span>
            <h2>Core Tauri/Rust + instalación real desde la UI</h2>
            <p>
              La app ya puede guardar el Studio Home, detectar instalación por manifest,
ejecutar instaladores dedicados para Qwen3-TTS, whisper.cpp, FaceFusion y AceForge, además de arrancar herramientas instaladas.
            </p>
          </div>
          <div className="hero-meta">
            <strong>{summary?.os ?? 'Cargando...'}</strong>
            <span>{summary?.studio_home ?? 'Sin definir'}</span>
          </div>
        </header>

        <section className="grid two">
          <article className="card">
            <h3>Resumen del sistema</h3>
            <dl className="kv-list">
              <div><dt>App</dt><dd>{summary?.app_name ?? '—'}</dd></div>
              <div><dt>Versión</dt><dd>{summary?.app_version ?? '—'}</dd></div>
              <div><dt>OS</dt><dd>{summary?.os ?? '—'}</dd></div>
              <div><dt>Arquitectura</dt><dd>{summary?.arch ?? '—'}</dd></div>
              <div><dt>Studio Home</dt><dd>{summary?.studio_home ?? '—'}</dd></div>
              <div><dt>Settings</dt><dd>{summary?.settings_file ?? '—'}</dd></div>
            </dl>
          </article>

          <article className="card">
            <h3>Estado del proyecto</h3>
            <p>{message}</p>
            <ul className="check-list">
              <li>✅ Base visual</li>
              <li>✅ Manifests YAML</li>
              <li>✅ Core Rust mínimo</li>
              <li>✅ Detección de instalación por checks</li>
              <li>✅ Guardado de Studio Home</li>
              <li>✅ Instalación real por botón para Qwen3-TTS</li>
              <li>✅ Instalación real por botón para whisper.cpp</li>
              <li>✅ Instalación real por botón para FaceFusion</li>
              <li>✅ Instalación real por botón para AceForge</li>
              <li>✅ Inicio y apertura de carpeta/logs</li>
            </ul>
            <p className="muted">Instaladas detectadas: {installedCount} / {tools.length}</p>
          </article>
        </section>

        <section className="card">
          <div className="section-header">
            <h3>Settings rápidos</h3>
            <span className="muted">APFS recomendado</span>
          </div>
          <div className="settings-row">
            <input
              value={studioHomeInput}
              onChange={(e) => setStudioHomeInput(e.target.value)}
              placeholder="/Volumes/ChofyStudioAPFS/ChofyAIStudio"
            />
            <button onClick={saveStudioHome}>Guardar ruta</button>
          </div>
          {saveMessage ? <p className="muted">{saveMessage}</p> : null}
        </section>

        <section className="card">
          <div className="section-header">
            <h3>Herramientas objetivo</h3>
            <span className="muted">Fase 2</span>
          </div>
          <div className="tool-grid">
            {tools.map((tool) => {
              const isBusy = busyToolId === tool.id;
              const canInstall = Boolean(tool.install_script);
              const primaryLabel = tool.installed ? 'Iniciar' : canInstall ? 'Instalar' : 'No disponible';
              return (
                <article key={tool.id} className="tool-card">
                  <div className="tool-head">
                    <div>
                      <h4>{tool.name}</h4>
                      <p>{categoryLabel(tool.category)} · {tool.runtime}</p>
                    </div>
                    {tool.recommended ? <span className="pill">Recomendado</span> : null}
                  </div>
                  <p>{tool.description}</p>
                  <dl className="tool-meta">
                    <div><dt>Estado</dt><dd>{tool.installed ? 'Instalado' : 'Pendiente'}</dd></div>
                    <div><dt>Ruta</dt><dd>{tool.install_dir}</dd></div>
                    {tool.install_script ? <div><dt>Script</dt><dd>{tool.install_script}</dd></div> : null}
                    {tool.run_command ? <div><dt>Run</dt><dd>{tool.run_command}</dd></div> : null}
                  </dl>
                  <div className="check-zone">
                    <strong>Checks OK</strong>
                    <ul>
                      {tool.installed_checks.length ? tool.installed_checks.map((check) => <li key={check}>{check}</li>) : <li>Ninguno todavía</li>}
                    </ul>
                    <strong>Checks faltantes</strong>
                    <ul>
                      {tool.missing_checks.length ? tool.missing_checks.map((check) => <li key={check}>{check}</li>) : <li>Ninguno</li>}
                    </ul>
                  </div>
                  <div className="tool-actions">
                    <button
                      disabled={isBusy || (!tool.installed && !canInstall)}
                      onClick={() => tool.installed ? handleStart(tool) : handleInstall(tool)}
                    >
                      {isBusy ? 'Procesando...' : primaryLabel}
                    </button>
                    <button className="secondary" disabled={isBusy} onClick={() => handleOpenFolder(tool)}>Carpeta</button>
                    <button className="secondary" disabled={isBusy} onClick={() => handleOpenLog(tool)}>Logs</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
