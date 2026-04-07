import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  ActionResult,
  AppSettings,
  HealthResult,
  InstallEvent,
  QueueItem,
  SystemSummary,
  ToolManifest,
} from './types';

// ─── Fallback tools (sin backend Tauri) ──────────────────────────────────────
const fallbackTools: ToolManifest[] = [
  {
    file_name: 'qwen3-tts.yaml', id: 'qwen3-tts', name: 'Qwen3-TTS',
    category: 'voice', runtime: 'python', default_port: 7860, installed: false,
    description: 'TTS y clonación de voz con backend MLX/Apple Silicon.',
    recommended: true, install_dir: '~/ChofyAIStudio/tools/qwen3-tts',
    install_script: 'scripts/mac/install-qwen3-tts.sh',
    run_command: 'cd app && env/bin/python -m uvicorn server:app --host 127.0.0.1 --port 7860',
    installed_checks: [], missing_checks: ['launcher/.git', 'app/env', 'app/models'],
  },
  {
    file_name: 'whispercpp.yaml', id: 'whispercpp', name: 'whisper.cpp',
    category: 'asr', runtime: 'binary', default_port: 8178, installed: false,
    description: 'ASR local y transcripción con foco en Apple Silicon.',
    recommended: true, install_dir: '~/ChofyAIStudio/tools/whispercpp',
    install_script: 'scripts/mac/install-whispercpp.sh',
    run_command: 'source/build/bin/whisper-server --host 127.0.0.1 --port 8178 -m models/ggml-base.en.bin',
    installed_checks: [], missing_checks: ['source/.git', 'source/build/bin/whisper-cli', 'models/ggml-base.en.bin'],
  },
  {
    file_name: 'facefusion.yaml', id: 'facefusion', name: 'FaceFusion',
    category: 'video', runtime: 'python', installed: false,
    description: 'Face swap y utilidades de video/cara.',
    recommended: true, install_dir: '~/ChofyAIStudio/tools/facefusion',
    install_script: 'scripts/mac/install-facefusion.sh',
    run_command: 'source env/bin/activate && cd source && python facefusion.py run --open-browser',
    installed_checks: [], missing_checks: ['source/.git', 'env', 'source/facefusion.py'],
  },
  {
    file_name: 'comfyui.yaml', id: 'comfyui', name: 'ComfyUI',
    category: 'image', runtime: 'python', default_port: 8188, installed: false,
    description: 'Workflows visuales para imagen.',
    recommended: true, install_dir: '~/ChofyAIStudio/tools/comfyui',
    installed_checks: [], missing_checks: ['source/.git', 'venv'],
  },
  {
    file_name: 'aceforge.yaml', id: 'aceforge', name: 'AceForge',
    category: 'music', runtime: 'python', default_port: 5056, installed: false,
    description: 'Workstation musical local-first para Apple Silicon basada en ACE-Step.',
    recommended: true, install_dir: '~/ChofyAIStudio/tools/aceforge',
    install_script: 'scripts/mac/install-aceforge.sh',
    run_command: 'source env/bin/activate && cd source && python music_forge_ui.py',
    installed_checks: [], missing_checks: ['source/.git', 'env', 'source/music_forge_ui.py'],
  },
];

const CATEGORY_LABEL: Record<ToolManifest['category'], string> = {
  voice: 'Voz', asr: 'ASR', video: 'Video/Cara',
  image: 'Imágenes', music: 'Música', system: 'Sistema',
};

// ─── Componente de indicador de salud ────────────────────────────────────────
function HealthDot({ health }: { health?: HealthResult }) {
  if (!health) return null;
  const ok = health.running || health.port_open;
  return (
    <span
      title={ok
        ? `Activo · Puerto ${health.port_open ? 'abierto' : 'cerrado'} · PID ${health.pid ?? '—'}`
        : 'Proceso detenido'}
      style={{
        display: 'inline-block', width: 10, height: 10,
        borderRadius: '50%', marginLeft: 6, flexShrink: 0,
        background: ok ? '#36d7b7' : '#666',
        boxShadow: ok ? '0 0 6px #36d7b7' : 'none',
      }}
    />
  );
}

// ─── App principal ────────────────────────────────────────────────────────────
export default function App() {
  const [summary, setSummary] = useState<SystemSummary | null>(null);
  const [tools, setTools] = useState<ToolManifest[]>(fallbackTools);
  const [message, setMessage] = useState<string>(
    'Fase 3 activa: Stop · Restart · Health checks · Cola de instalaciones · Auto-update.'
  );
  const [studioHomeInput, setStudioHomeInput] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [busyToolId, setBusyToolId] = useState<string | null>(null);

  // Health checks
  const [health, setHealth] = useState<Record<string, HealthResult>>({});
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  // Cola de instalación
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [queueVisible, setQueueVisible] = useState(false);
  const progressRef = useRef<Record<string, string[]>>({});

  // ─── Carga inicial ─────────────────────────────────────────────────────────
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
        const sys = await invoke<SystemSummary>('get_system_summary');
        setSummary(sys);
        setStudioHomeInput(sys.studio_home);
      } catch {
        setSummary({
          app_name: 'ChofyAI Studio', app_version: '0.2.0',
          os: 'macOS / Apple Silicon', arch: 'arm64',
          studio_home: '/Volumes/ORICO/ChofyIA/ChofyAIStudio',
          settings_file: 'storage/state/settings.json',
        });
        setStudioHomeInput('/Volumes/ORICO/ChofyIA/ChofyAIStudio');
      }
      await reloadTools();
    };
    void load();
  }, []);

  // ─── Escuchar eventos de progreso de instalación ──────────────────────────
  useEffect(() => {
    const unlisten = listen<InstallEvent>('install-progress', (event) => {
      const { tool_id, line } = event.payload;
      progressRef.current[tool_id] = [...(progressRef.current[tool_id] ?? []), line];
      setQueue((prev) =>
        prev.map((q) =>
          q.toolId === tool_id ? { ...q, lines: progressRef.current[tool_id] } : q
        )
      );
    });
    return () => { void unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    const unlisten = listen<InstallEvent>('install-done', (event) => {
      const { tool_id, line } = event.payload;
      const ok = line.startsWith('OK:');
      setQueue((prev) =>
        prev.map((q) =>
          q.toolId === tool_id ? { ...q, status: ok ? 'done' : 'failed', message: line } : q
        )
      );
    });
    return () => { void unlisten.then((fn) => fn()); };
  }, []);

  // ─── Health check periódico ────────────────────────────────────────────────
  useEffect(() => {
    if (runningIds.size === 0) return;
    const interval = setInterval(async () => {
      for (const toolId of runningIds) {
        try {
          const result = await invoke<HealthResult>('health_check_tool', { toolId });
          setHealth((prev) => ({ ...prev, [toolId]: result }));
          // Si el proceso ya no existe, sacarlo del set
          if (!result.running && !result.port_open) {
            setRunningIds((prev) => { const s = new Set(prev); s.delete(toolId); return s; });
          }
        } catch { /* sin backend, ignorar */ }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [runningIds]);

  const installedCount = useMemo(() => tools.filter((t) => t.installed).length, [tools]);

  // ─── Acciones de herramientas ─────────────────────────────────────────────
  const saveStudioHome = async () => {
    try {
      const saved = await invoke<AppSettings>('save_studio_home', { studioHome: studioHomeInput });
      setStudioHomeInput(saved.studio_home);
      setSummary((prev) => prev ? { ...prev, studio_home: saved.studio_home } : prev);
      await reloadTools();
      setSaveMessage('Ruta guardada. La UI usará este Studio Home para instalar y arrancar herramientas.');
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
    } catch (e) { setMessage(String(e)); }
    finally { setBusyToolId(null); }
  };

  const handleUpdate = async (tool: ToolManifest) => {
    setBusyToolId(tool.id);
    setMessage(`Actualizando ${tool.name}...`);
    try {
      const result = await invoke<ActionResult>('update_tool', { toolId: tool.id });
      await reloadTools();
      setMessage(result.message + (result.log_path ? ` · Log: ${result.log_path}` : ''));
    } catch (e) { setMessage(String(e)); }
    finally { setBusyToolId(null); }
  };

  const handleStart = async (tool: ToolManifest) => {
    setBusyToolId(tool.id);
    setMessage(`Iniciando ${tool.name}...`);
    try {
      const result = await invoke<ActionResult>('start_tool', { toolId: tool.id });
      if (result.opened_url) window.open(result.opened_url, '_blank');
      setRunningIds((prev) => new Set([...prev, tool.id]));
      setMessage(result.message + (result.log_path ? ` · Log: ${result.log_path}` : ''));
    } catch (e) { setMessage(String(e)); }
    finally { setBusyToolId(null); }
  };

  const handleStop = async (tool: ToolManifest) => {
    setBusyToolId(tool.id);
    setMessage(`Deteniendo ${tool.name}...`);
    try {
      const result = await invoke<ActionResult>('stop_tool', { toolId: tool.id });
      setRunningIds((prev) => { const s = new Set(prev); s.delete(tool.id); return s; });
      setHealth((prev) => {
        const next = { ...prev };
        delete next[tool.id];
        return next;
      });
      setMessage(result.message);
    } catch (e) { setMessage(String(e)); }
    finally { setBusyToolId(null); }
  };

  const handleRestart = async (tool: ToolManifest) => {
    setBusyToolId(tool.id);
    setMessage(`Reiniciando ${tool.name}...`);
    try {
      const result = await invoke<ActionResult>('restart_tool', { toolId: tool.id });
      if (result.opened_url) window.open(result.opened_url, '_blank');
      setRunningIds((prev) => new Set([...prev, tool.id]));
      setMessage(result.message);
    } catch (e) { setMessage(String(e)); }
    finally { setBusyToolId(null); }
  };

  const handleOpenFolder = async (tool: ToolManifest) => {
    try {
      const result = await invoke<ActionResult>('open_tool_directory', { toolId: tool.id });
      setMessage(result.message);
    } catch (e) { setMessage(String(e)); }
  };

  const handleOpenLog = async (tool: ToolManifest) => {
    try {
      const result = await invoke<ActionResult>('open_tool_log', { toolId: tool.id });
      setMessage(result.message);
    } catch (e) { setMessage(String(e)); }
  };

  // ─── Cola de instalación ──────────────────────────────────────────────────
  const addToQueue = (tool: ToolManifest) => {
    if (queue.some((q) => q.toolId === tool.id)) return;
    setQueue((prev) => [...prev, { toolId: tool.id, name: tool.name, status: 'pending', lines: [] }]);
    setQueueVisible(true);
  };

  const addAllPendingToQueue = () => {
    const pending = tools.filter((t) => !t.installed && Boolean(t.install_script));
    setQueue(pending.map((t) => ({ toolId: t.id, name: t.name, status: 'pending' as const, lines: [] })));
    setQueueVisible(true);
  };

  const runQueue = async () => {
    if (isQueueRunning) return;
    setIsQueueRunning(true);
    for (const item of queue) {
      if (item.status !== 'pending') continue;
      progressRef.current[item.toolId] = [];
      setQueue((prev) => prev.map((q) => q.toolId === item.toolId ? { ...q, status: 'installing', lines: [] } : q));
      try {
        await invoke<ActionResult>('install_tool', { toolId: item.toolId });
        await reloadTools();
      } catch (e) {
        setQueue((prev) => prev.map((q) => q.toolId === item.toolId ? { ...q, status: 'failed', message: String(e) } : q));
      }
    }
    setIsQueueRunning(false);
  };

  const clearQueue = () => {
    if (!isQueueRunning) { setQueue([]); setQueueVisible(false); }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
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
        {queue.length > 0 && (
          <button className="nav-item queue-trigger" onClick={() => setQueueVisible(!queueVisible)}>
            {isQueueRunning ? '⏳ Cola activa' : `📋 Cola (${queue.length})`}
          </button>
        )}
      </aside>

      <section className="content">

        {/* Hero */}
        <header className="hero card">
          <div>
            <span className="badge">Fase 3</span>
            <h2>Stop · Restart · Health · Cola · Auto-update</h2>
            <p>
              Control completo de procesos: detener, reiniciar y verificar el estado de cada herramienta.
              Cola de instalaciones secuencial con progreso en tiempo real.
            </p>
          </div>
          <div className="hero-meta">
            <strong>{summary?.os ?? 'Cargando...'}</strong>
            <span>{summary?.studio_home ?? 'Sin definir'}</span>
          </div>
        </header>

        {/* Resumen + estado */}
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
            <p className="muted">{message}</p>
            <ul className="check-list">
              <li>✅ Instalación real por botón (4 herramientas)</li>
              <li>✅ Stop / Detener proceso</li>
              <li>✅ Restart / Reiniciar proceso</li>
              <li>✅ Health check (PID + puerto TCP)</li>
              <li>✅ Cola de instalaciones con progreso</li>
              <li>✅ Auto-update (re-ejecuta script + git pull)</li>
            </ul>
            <p className="muted">Instaladas: {installedCount} / {tools.length} · En ejecución: {runningIds.size}</p>
          </article>
        </section>

        {/* Settings */}
        <section className="card">
          <div className="section-header">
            <h3>Studio Home</h3>
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
          {saveMessage && <p className="muted">{saveMessage}</p>}
        </section>

        {/* Cola de instalación */}
        {queueVisible && queue.length > 0 && (
          <section className="card">
            <div className="section-header">
              <h3>Cola de instalación</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={runQueue}
                  disabled={isQueueRunning || queue.every((q) => q.status !== 'pending')}
                >
                  {isQueueRunning ? '⏳ Instalando...' : '▶ Iniciar cola'}
                </button>
                <button className="secondary" onClick={clearQueue} disabled={isQueueRunning}>
                  Limpiar
                </button>
              </div>
            </div>
            <div className="queue-list">
              {queue.map((item) => (
                <div key={item.toolId} className={`queue-item queue-${item.status}`}>
                  <span className="queue-icon">
                    {item.status === 'pending' && '⏳'}
                    {item.status === 'installing' && '🔄'}
                    {item.status === 'done' && '✅'}
                    {item.status === 'failed' && '❌'}
                  </span>
                  <div className="queue-info">
                    <strong>{item.name}</strong>
                    {item.message && <p className="muted">{item.message}</p>}
                    {item.status === 'installing' && item.lines.length > 0 && (
                      <p className="muted queue-last-line">
                        {item.lines[item.lines.length - 1]}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Herramientas */}
        <section className="card">
          <div className="section-header">
            <h3>Herramientas</h3>
            <button
              className="secondary"
              onClick={addAllPendingToQueue}
              disabled={isQueueRunning}
            >
              + Añadir pendientes a cola
            </button>
          </div>
          <div className="tool-grid">
            {tools.map((tool) => {
              const isBusy = busyToolId === tool.id;
              const canInstall = Boolean(tool.install_script);
              const isRunning = runningIds.has(tool.id);
              const toolHealth = health[tool.id];

              return (
                <article key={tool.id} className="tool-card">
                  <div className="tool-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <h4>{tool.name}</h4>
                      <HealthDot health={toolHealth} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {tool.recommended && <span className="pill">Recomendado</span>}
                      {isRunning && <span className="pill pill-green">Activo</span>}
                    </div>
                  </div>
                  <p className="muted">{CATEGORY_LABEL[tool.category]} · {tool.runtime}</p>
                  <p>{tool.description}</p>

                  <dl className="tool-meta">
                    <div>
                      <dt>Estado</dt>
                      <dd>{tool.installed ? '✅ Instalado' : '⏳ Pendiente'}</dd>
                    </div>
                    {toolHealth && (
                      <div>
                        <dt>Health</dt>
                        <dd>
                          {toolHealth.port_open ? '🟢 Puerto OK' : '🔴 Puerto cerrado'}
                          {toolHealth.pid ? ` · PID ${toolHealth.pid}` : ''}
                        </dd>
                      </div>
                    )}
                    <div><dt>Ruta</dt><dd>{tool.install_dir}</dd></div>
                    {tool.default_port && <div><dt>Puerto</dt><dd>{tool.default_port}</dd></div>}
                  </dl>

                  <div className="tool-actions">
                    {/* Instalar / Iniciar */}
                    {!tool.installed && (
                      <button
                        disabled={isBusy || !canInstall}
                        onClick={() => handleInstall(tool)}
                      >
                        {isBusy ? '⏳' : '📦 Instalar'}
                      </button>
                    )}
                    {tool.installed && !isRunning && (
                      <button disabled={isBusy} onClick={() => handleStart(tool)}>
                        {isBusy ? '⏳' : '▶ Iniciar'}
                      </button>
                    )}

                    {/* Stop / Restart */}
                    {isRunning && (
                      <>
                        <button className="secondary" disabled={isBusy} onClick={() => handleStop(tool)}>
                          ⏹ Stop
                        </button>
                        <button className="secondary" disabled={isBusy} onClick={() => handleRestart(tool)}>
                          🔄 Restart
                        </button>
                      </>
                    )}

                    {/* Update */}
                    {tool.installed && canInstall && (
                      <button className="secondary" disabled={isBusy} onClick={() => handleUpdate(tool)}>
                        ⬆ Update
                      </button>
                    )}

                    {/* Añadir a cola */}
                    {!tool.installed && canInstall && (
                      <button
                        className="secondary"
                        disabled={isQueueRunning || queue.some((q) => q.toolId === tool.id)}
                        onClick={() => addToQueue(tool)}
                        title="Añadir a la cola de instalación"
                      >
                        + Cola
                      </button>
                    )}

                    {/* Carpeta / Logs */}
                    <button className="secondary" disabled={isBusy} onClick={() => handleOpenFolder(tool)}>
                      📁
                    </button>
                    <button className="secondary" disabled={isBusy} onClick={() => handleOpenLog(tool)}>
                      📋
                    </button>
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
