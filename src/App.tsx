import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  ActionResult,
  AppSettings,
  HealthResult,
  InstallEvent,
  QueueItem,
  SystemStats,
  SystemSummary,
  ToolManifest,
  VolumeCandidate,
} from './types';

// ─── Detección Tauri ─────────────────────────────────────────────────────────
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ─── Fallback tools (sin backend Tauri) ──────────────────────────────────────
const fallbackTools: ToolManifest[] = [
  { file_name: 'qwen3-tts.yaml', id: 'qwen3-tts', name: 'Qwen3-TTS', category: 'voice', runtime: 'python', default_port: 7860, installed: false, description: 'TTS y clonación de voz con backend MLX/Apple Silicon.', recommended: true, install_dir: '~/ChofyAIStudio/tools/qwen3-tts', install_script: 'scripts/mac/install-qwen3-tts.sh', installed_checks: [], missing_checks: ['launcher/.git', 'app/env'] },
  { file_name: 'whispercpp.yaml', id: 'whispercpp', name: 'whisper.cpp', category: 'asr', runtime: 'binary', default_port: 8178, installed: false, description: 'ASR local y transcripción con foco en Apple Silicon.', recommended: true, install_dir: '~/ChofyAIStudio/tools/whispercpp', install_script: 'scripts/mac/install-whispercpp.sh', installed_checks: [], missing_checks: ['source/.git'] },
  { file_name: 'facefusion.yaml', id: 'facefusion', name: 'FaceFusion', category: 'video', runtime: 'python', installed: false, description: 'Face swap y utilidades de video/cara.', recommended: true, install_dir: '~/ChofyAIStudio/tools/facefusion', install_script: 'scripts/mac/install-facefusion.sh', installed_checks: [], missing_checks: ['source/.git'] },
  { file_name: 'comfyui.yaml', id: 'comfyui', name: 'ComfyUI', category: 'image', runtime: 'python', default_port: 8188, installed: false, description: 'Workflows visuales para imagen.', recommended: true, install_dir: '~/ChofyAIStudio/tools/comfyui', install_script: 'scripts/mac/install-comfyui.sh', installed_checks: [], missing_checks: ['source/.git', 'venv'] },
  { file_name: 'aceforge.yaml', id: 'aceforge', name: 'AceForge', category: 'music', runtime: 'python', default_port: 5056, installed: false, description: 'Workstation musical local-first basada en ACE-Step.', recommended: true, install_dir: '~/ChofyAIStudio/tools/aceforge', install_script: 'scripts/mac/install-aceforge.sh', installed_checks: [], missing_checks: ['source/.git'] },
];

const CATEGORY_LABEL: Record<ToolManifest['category'], string> = {
  voice: 'Voz', asr: 'ASR', video: 'Video/Cara',
  image: 'Imágenes', music: 'Música', system: 'Sistema',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtBytes(b?: number | null): string {
  if (!b || b <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = b, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!inTauri) return null;
  try { return await invoke<T>(cmd, args); } catch { return null; }
}

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60), ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

type LineParse = { phase?: string; progressPct?: number; speed?: string; eta?: string };
function parseInstallLine(prev: LineParse, line: string): LineParse {
  const out: LineParse = { ...prev };
  const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');

  if (/^Clonando|^Cloning into/i.test(stripped)) out.phase = 'Clonando repositorio';
  else if (/Receiving objects:\s+(\d+)%/i.test(stripped)) {
    const m = stripped.match(/Receiving objects:\s+(\d+)%/i)!;
    out.phase = 'Descargando objetos git'; out.progressPct = +m[1];
  }
  else if (/Resolving deltas:\s+(\d+)%/i.test(stripped)) {
    const m = stripped.match(/Resolving deltas:\s+(\d+)%/i)!;
    out.phase = 'Resolviendo deltas'; out.progressPct = +m[1];
  }
  else if (/Creating virtual environment|Creando venv/i.test(stripped)) out.phase = 'Creando entorno Python';
  else if (/Resolved \d+ packages|Installing collected|Downloading|Installed \d+ packages/i.test(stripped)) out.phase = 'Instalando dependencias Python';
  else if (/^\[\s*(\d+)%\]/.test(stripped)) {
    const m = stripped.match(/^\[\s*(\d+)%\]/)!;
    out.phase = 'Compilando (cmake/make)'; out.progressPct = Math.min(+m[1], 100);
  }
  else if (/Linking CXX|Linking C /i.test(stripped)) out.phase = 'Enlazando binarios';
  else if (/Downloading .*model|saved in.*\.bin|Downloading ggml/i.test(stripped)) out.phase = 'Descargando modelo';
  else if (/^\s*(\d{1,3})\s+\d+[KMG]?\s+(\d{1,3})\s+\d+[KMG]?\s+\d+\s+\d+\s+(\d+[KMG]?)\s/.test(stripped)) {
    const m = stripped.match(/^\s*(\d{1,3})\s+(\d+[KMG]?)\s+(\d{1,3})\s+(\d+[KMG]?)\s+\d+\s+\d+\s+(\d+[KMG]?)/)!;
    out.progressPct = +m[1];
    out.speed = `${m[5]}B/s`;
  }
  else if (/INSTALL_OK\b/.test(stripped)) { out.phase = 'Listo'; out.progressPct = 100; }

  return out;
}

// ─── Componentes ─────────────────────────────────────────────────────────────
function HealthDot({ health }: { health?: HealthResult }) {
  if (!health) return null;
  const ok = health.running || health.port_open;
  return (
    <span
      title={ok ? `Activo · PID ${health.pid ?? '—'}` : 'Detenido'}
      style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', marginLeft: 6, flexShrink: 0,
        background: ok ? '#36d7b7' : '#666', boxShadow: ok ? '0 0 6px #36d7b7' : 'none' }}
    />
  );
}

const APP_STARTED_AT = Date.now();

function StatusBar({ stats, summary }: { stats: SystemStats | null; summary: SystemSummary | null }) {
  // Re-render cada 30s para que Uptime de la app avance
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (!stats) {
    return (
      <footer className="statusbar">
        <span className="muted">Cargando estadísticas del equipo…</span>
      </footer>
    );
  }
  const cpuPct = Math.round(stats.cpu_usage);
  const memPct = stats.mem_total_bytes ? Math.round((stats.mem_used_bytes / stats.mem_total_bytes) * 100) : 0;
  const diskUsed = stats.disk_total_bytes - stats.disk_free_bytes;
  const diskPct = stats.disk_total_bytes ? Math.round((diskUsed / stats.disk_total_bytes) * 100) : 0;
  // Uptime = tiempo desde que esta sesión de la app abrió
  const appUpSecs = Math.floor((Date.now() - APP_STARTED_AT) / 1000);
  const upH = Math.floor(appUpSecs / 3600);
  const upM = Math.floor((appUpSecs % 3600) / 60);

  return (
    <footer className="statusbar">
      <span className="stat">
        <span className="stat-label">CPU</span>
        <span>{cpuPct}%</span>
        <span className="stat-bar"><span className={`stat-bar-fill ${cpuPct > 85 ? 'warn' : ''}`} style={{ width: `${cpuPct}%` }} /></span>
        <span className="muted">· {stats.cpu_cores} núcleos · load {stats.load_avg_1m.toFixed(2)}</span>
      </span>
      <span className="sep">│</span>
      <span className="stat">
        <span className="stat-label">RAM</span>
        <span>{fmtBytes(stats.mem_used_bytes)} / {fmtBytes(stats.mem_total_bytes)}</span>
        <span className="stat-bar"><span className={`stat-bar-fill ${memPct > 85 ? 'warn' : ''}`} style={{ width: `${memPct}%` }} /></span>
      </span>
      <span className="sep">│</span>
      <span className="stat">
        <span className="stat-label">Disco</span>
        <span>{fmtBytes(stats.disk_free_bytes)} libres</span>
        <span className="stat-bar"><span className={`stat-bar-fill ${diskPct > 90 ? 'warn' : ''}`} style={{ width: `${diskPct}%` }} /></span>
        <span className="muted">· {stats.disk_path}</span>
      </span>
      <span className="sep">│</span>
      <span className="stat">
        <span className="stat-label" title="Tiempo de esta sesión de ChofyAI Studio">App</span>
        <span>{upH}h {upM}m</span>
      </span>
      {summary?.using_fallback && (
        <>
          <span className="sep">│</span>
          <span className="badge-fb" title={`Solicitado: ${summary.studio_home}`}>
            ⚠ Usando fallback (disco principal)
          </span>
        </>
      )}
    </footer>
  );
}

function VolumePicker({
  volumes, currentPath, onPick,
}: { volumes: VolumeCandidate[]; currentPath: string; onPick: (path: string) => void }) {
  if (volumes.length === 0) return null;
  return (
    <div className="volume-list">
      {volumes.map((v) => {
        const active = v.path === currentPath;
        const disabled = !v.writable && !active;
        return (
          <div
            key={v.path}
            className={`volume-item ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={() => !disabled && onPick(v.path)}
          >
            <span className="vol-icon">{v.kind === 'home' ? '🏠' : '💾'}</span>
            <div className="vol-info">
              <strong>{v.label}</strong>
              <small>
                {v.path} · {fmtBytes(v.free_bytes)} libres / {fmtBytes(v.total_bytes)}
                {!v.writable && ' · sin permisos'}
              </small>
            </div>
            {active && <span className="pill pill-green">Actual</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── App principal ────────────────────────────────────────────────────────────
export default function App() {
  const [summary, setSummary] = useState<SystemSummary | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [tools, setTools] = useState<ToolManifest[]>(fallbackTools);
  const [volumes, setVolumes] = useState<VolumeCandidate[]>([]);
  const [message, setMessage] = useState<string>(
    inTauri ? 'ChofyAI Studio listo. Selecciona un volumen y empieza a instalar.' : 'Modo web (sin backend): los botones requieren `npm run tauri:dev`.'
  );
  const [studioHomeInput, setStudioHomeInput] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [busyToolId, setBusyToolId] = useState<string | null>(null);
  const [relocateFor, setRelocateFor] = useState<string | null>(null);
  const [relocateTarget, setRelocateTarget] = useState<string>('');

  const [health, setHealth] = useState<Record<string, HealthResult>>({});
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [queueVisible, setQueueVisible] = useState(false);
  const [viewingTool, setViewingTool] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const progressRef = useRef<Record<string, string[]>>({});

  // ─── Carga inicial ─────────────────────────────────────────────────────────
  const reloadTools = async () => {
    const t = await tauriInvoke<ToolManifest[]>('list_tools');
    if (t) setTools(t);
    else setTools(fallbackTools);
  };

  const reloadSummary = async () => {
    const sys = await tauriInvoke<SystemSummary>('get_system_summary');
    if (sys) {
      setSummary(sys);
      setStudioHomeInput(sys.studio_home);
    } else {
      const fb = {
        app_name: 'ChofyAI Studio', app_version: '0.3.0', os: 'macOS / Apple Silicon', arch: 'arm64',
        studio_home: '/Volumes/ORICO/ChofyIA/ChofyAIStudio',
        studio_home_effective: '/Volumes/ORICO/ChofyIA/ChofyAIStudio',
        using_fallback: false,
        settings_file: 'storage/state/settings.json',
      };
      setSummary(fb);
      setStudioHomeInput(fb.studio_home);
    }
  };

  const reloadVolumes = async () => {
    const v = await tauriInvoke<VolumeCandidate[]>('list_volume_candidates');
    setVolumes(v ?? []);
  };

  const reloadStats = async () => {
    const s = await tauriInvoke<SystemStats>('get_system_stats');
    if (s) setStats(s);
  };

  useEffect(() => {
    void (async () => {
      await reloadSummary();
      await reloadTools();
      await reloadVolumes();
      await reloadStats();
    })();
  }, []);

  // Stats refresh cada 3s
  useEffect(() => {
    if (!inTauri) return;
    const id = setInterval(() => { void reloadStats(); }, 3000);
    return () => clearInterval(id);
  }, []);

  // Re-render cada 1s mientras hay instalación activa (para elapsed time)
  const [, setTick] = useState(0);
  useEffect(() => {
    const hasActive = queue.some((q) => q.status === 'installing');
    if (!hasActive) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [queue]);

  // Auto-refresh de tools cada 8s para detectar instalaciones lanzadas desde CLI
  useEffect(() => {
    if (!inTauri) return;
    const id = setInterval(() => { void reloadTools(); }, 8000);
    return () => clearInterval(id);
  }, []);

  // Eventos de instalación
  useEffect(() => {
    if (!inTauri) return;
    const unP = listen<InstallEvent>('install-progress', (event) => {
      const { tool_id, line } = event.payload;
      const arr = progressRef.current[tool_id] ?? [];
      arr.push(line);
      if (arr.length > 400) arr.splice(0, arr.length - 400);
      progressRef.current[tool_id] = arr;
      setQueue((prev) => prev.map((q) => {
        if (q.toolId !== tool_id) return q;
        const parsed = parseInstallLine({ phase: q.phase, progressPct: q.progressPct, speed: q.speed, eta: q.eta }, line);
        return { ...q, lines: arr.slice(-30), ...parsed };
      }));
    });
    const unD = listen<InstallEvent>('install-done', (event) => {
      const { tool_id, line } = event.payload;
      const ok = line.startsWith('OK:');
      setQueue((prev) => prev.map((q) => q.toolId === tool_id ? {
        ...q, status: ok ? 'done' : 'failed', message: line, endedAt: Date.now(),
        progressPct: ok ? 100 : q.progressPct, phase: ok ? 'Listo' : (q.phase ?? 'Error'),
      } : q));
      void reloadTools();
    });
    return () => { void unP.then((fn) => fn()); void unD.then((fn) => fn()); };
  }, []);

  // Health periódico — CADA tool con puerto (no solo runningIds)
  useEffect(() => {
    if (!inTauri || tools.length === 0) return;
    const probe = async () => {
      for (const t of tools) {
        if (!t.default_port) continue;
        const result = await tauriInvoke<HealthResult>('health_check_tool', { toolId: t.id });
        if (!result) continue;
        setHealth((prev) => ({ ...prev, [t.id]: result }));
        if (result.running || result.port_open) {
          setRunningIds((prev) => prev.has(t.id) ? prev : new Set(prev).add(t.id));
        } else {
          setRunningIds((prev) => {
            if (!prev.has(t.id)) return prev;
            const s = new Set(prev); s.delete(t.id); return s;
          });
        }
      }
    };
    void probe();
    const interval = setInterval(probe, 5000);
    return () => clearInterval(interval);
  }, [tools]);

  const installedCount = useMemo(() => tools.filter((t) => t.installed).length, [tools]);

  // ─── Acciones ─────────────────────────────────────────────────────────────
  const saveStudioHome = async (pathOverride?: string) => {
    const target = (pathOverride ?? studioHomeInput).trim();
    const saved = await tauriInvoke<AppSettings>('save_studio_home', { studioHome: target });
    if (saved) {
      setStudioHomeInput(saved.studio_home);
      await reloadSummary();
      await reloadTools();
      await reloadVolumes();
      await reloadStats();
      setSaveMessage(`Studio Home guardado: ${saved.studio_home}`);
    } else {
      setSaveMessage('No se pudo guardar (¿estás en modo web?).');
    }
  };

  const handleInstall = async (tool: ToolManifest) => {
    setBusyToolId(tool.id);
    setMessage(`Instalando ${tool.name}...`);
    const result = await tauriInvoke<ActionResult>('install_tool', { toolId: tool.id });
    await reloadTools();
    if (result) setMessage(result.message + (result.log_path ? ` · Log: ${result.log_path}` : ''));
    else setMessage(`Error instalando ${tool.name}`);
    setBusyToolId(null);
  };

  const handleUpdate = async (tool: ToolManifest) => {
    setBusyToolId(tool.id);
    setMessage(`Actualizando ${tool.name}...`);
    const r = await tauriInvoke<ActionResult>('update_tool', { toolId: tool.id });
    await reloadTools();
    if (r) setMessage(r.message); setBusyToolId(null);
  };

  const handleStart = async (tool: ToolManifest) => {
    setBusyToolId(tool.id);
    setMessage(`Iniciando ${tool.name}...`);
    const r = await tauriInvoke<ActionResult>('start_tool', { toolId: tool.id });
    if (r?.opened_url) window.open(r.opened_url, '_blank');
    setRunningIds((prev) => new Set([...prev, tool.id]));
    if (r) setMessage(r.message); setBusyToolId(null);
  };

  const handleStop = async (tool: ToolManifest) => {
    setBusyToolId(tool.id);
    const r = await tauriInvoke<ActionResult>('stop_tool', { toolId: tool.id });
    setRunningIds((prev) => { const s = new Set(prev); s.delete(tool.id); return s; });
    setHealth((prev) => { const next = { ...prev }; delete next[tool.id]; return next; });
    if (r) setMessage(r.message); setBusyToolId(null);
  };

  const handleRestart = async (tool: ToolManifest) => {
    setBusyToolId(tool.id);
    const r = await tauriInvoke<ActionResult>('restart_tool', { toolId: tool.id });
    if (r?.opened_url) window.open(r.opened_url, '_blank');
    setRunningIds((prev) => new Set([...prev, tool.id]));
    if (r) setMessage(r.message); setBusyToolId(null);
  };

  const handleOpenFolder = async (tool: ToolManifest) => {
    const r = await tauriInvoke<ActionResult>('open_tool_directory', { toolId: tool.id });
    if (r) setMessage(r.message);
  };

  const handleOpenLog = async (tool: ToolManifest) => {
    const r = await tauriInvoke<ActionResult>('open_tool_log', { toolId: tool.id });
    if (r) setMessage(r.message);
  };

  const handleRelocate = async (tool: ToolManifest) => {
    if (!relocateTarget.trim()) return;
    setBusyToolId(tool.id);
    try {
      const r = await tauriInvoke<ActionResult>('relocate_module', {
        toolId: tool.id,
        targetDir: relocateTarget.trim(),
      });
      if (r) setMessage(r.message);
      setRelocateFor(null);
      setRelocateTarget('');
      await reloadTools();
    } catch (e) { setMessage(String(e)); }
    setBusyToolId(null);
  };

  const handleClearOverride = async (tool: ToolManifest) => {
    await tauriInvoke<AppSettings>('clear_module_override', { toolId: tool.id });
    await reloadTools();
    setMessage(`Override removido para ${tool.name}`);
  };

  const startRelocate = (tool: ToolManifest) => {
    const baseHome = summary?.studio_home_effective ?? '';
    setRelocateFor(tool.id);
    setRelocateTarget(`${baseHome}/modules/${tool.id}`);
  };

  // ─── Cola ─────────────────────────────────────────────────────────────────
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
      setQueue((prev) => prev.map((q) => q.toolId === item.toolId ? {
        ...q, status: 'installing', lines: [], startedAt: Date.now(), endedAt: undefined,
        progressPct: 0, phase: 'Iniciando…', source: 'ui',
      } : q));
      const r = await tauriInvoke<ActionResult>('install_tool', { toolId: item.toolId });
      if (!r) {
        setQueue((prev) => prev.map((q) => q.toolId === item.toolId ? { ...q, status: 'failed', message: 'Sin backend' } : q));
      }
      await reloadTools();
    }
    setIsQueueRunning(false);
  };

  const clearQueue = () => { if (!isQueueRunning) { setQueue([]); setQueueVisible(false); } };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
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
          <header className="hero card">
            <div>
              <span className="badge">Fase 4</span>
              <h2>Disco dual · Zona de módulos · Stats en vivo</h2>
              <p>Soporte para volúmenes externos con fallback automático al disco principal. Reubica módulos sin perder configuración.</p>
            </div>
            <div className="hero-meta">
              <strong>{summary?.os ?? '—'} · {summary?.arch ?? ''}</strong>
              <span>Studio Home: {summary?.studio_home_effective ?? '—'}</span>
            </div>
          </header>

          <section className="grid two">
            <article className="card">
              <h3>Resumen</h3>
              <dl className="kv-list">
                <div><dt>App</dt><dd>{summary?.app_name ?? '—'} v{summary?.app_version ?? '—'}</dd></div>
                <div><dt>Solicitado</dt><dd>{summary?.studio_home ?? '—'}</dd></div>
                <div><dt>Efectivo</dt><dd>{summary?.studio_home_effective ?? '—'} {summary?.using_fallback && <span className="pill" style={{background:'rgba(255,165,0,0.18)',color:'#ffcd80',borderColor:'rgba(255,165,0,0.3)'}}>fallback</span>}</dd></div>
                <div><dt>Settings</dt><dd>{summary?.settings_file ?? '—'}</dd></div>
              </dl>
            </article>

            <article className="card">
              <h3>Estado</h3>
              <p className="muted">{message}</p>
              <p className="muted">Instaladas: {installedCount} / {tools.length} · En ejecución: {runningIds.size}</p>
              <ul className="check-list">
                <li>✅ Disco externo + fallback automático</li>
                <li>✅ Zona de módulos / reubicación</li>
                <li>✅ 5 herramientas con scripts</li>
                <li>✅ Stats en vivo (CPU/RAM/disco)</li>
              </ul>
            </article>
          </section>

          {/* Studio Home + selector de volúmenes */}
          <section className="card">
            <div className="section-header">
              <h3>Studio Home</h3>
              <span className="muted">Volumen externo recomendado para modelos pesados</span>
            </div>

            <VolumePicker
              volumes={volumes}
              currentPath={summary?.studio_home ?? ''}
              onPick={(p) => { setStudioHomeInput(p); void saveStudioHome(p); }}
            />

            <div className="settings-row" style={{ marginTop: 14 }}>
              <input
                value={studioHomeInput}
                onChange={(e) => setStudioHomeInput(e.target.value)}
                placeholder="/Volumes/ChofyStudioAPFS/ChofyAIStudio"
              />
              <button onClick={() => saveStudioHome()}>Guardar ruta personalizada</button>
            </div>
            {saveMessage && <p className="muted" style={{ marginTop: 8 }}>{saveMessage}</p>}
          </section>

          {/* Cola */}
          {queueVisible && queue.length > 0 && (
            <section className="card">
              <div className="section-header">
                <h3>Cola de instalación</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={runQueue} disabled={isQueueRunning || queue.every((q) => q.status !== 'pending')}>
                    {isQueueRunning ? '⏳ Instalando...' : '▶ Iniciar cola'}
                  </button>
                  <button className="secondary" onClick={clearQueue} disabled={isQueueRunning}>Limpiar</button>
                </div>
              </div>
              <div className="queue-list">
                {queue.map((item) => {
                  const elapsedMs = item.startedAt
                    ? (item.endedAt ?? Date.now()) - item.startedAt : 0;
                  const pct = Math.max(0, Math.min(100, item.progressPct ?? 0));
                  return (
                    <div key={item.toolId} className={`queue-item queue-${item.status}`}>
                      <div className="queue-row">
                        <span className="queue-icon">
                          {item.status === 'pending' && '⏳'}
                          {item.status === 'installing' && <span className="spin">🔄</span>}
                          {item.status === 'done' && '✅'}
                          {item.status === 'failed' && '❌'}
                        </span>
                        <div className="queue-info">
                          <div className="queue-title-row">
                            <strong>{item.name}</strong>
                            {item.phase && <span className="queue-phase">{item.phase}</span>}
                            {item.startedAt && (
                              <span className="queue-elapsed">⏱ {fmtElapsed(elapsedMs)}</span>
                            )}
                            {item.speed && <span className="queue-speed">⇣ {item.speed}</span>}
                          </div>
                          {(item.status === 'installing' || (item.progressPct ?? 0) > 0) && (
                            <div className="queue-progress">
                              <div className="queue-progress-bar" style={{ width: `${pct}%` }} />
                              <span className="queue-progress-pct">{pct}%</span>
                            </div>
                          )}
                          {item.message && <p className="muted queue-msg">{item.message}</p>}
                        </div>
                      </div>
                      {item.status === 'installing' && item.lines.length > 0 && (
                        <pre className="queue-log">
                          {item.lines.slice(-8).map((l, i) => (
                            <div key={i} className="queue-log-line">{l.replace(/\x1b\[[0-9;]*m/g, '')}</div>
                          ))}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Vista embebida del tool en uso */}
          {viewingTool && (() => {
            const t = tools.find((x) => x.id === viewingTool);
            if (!t || !t.default_port) return null;
            const url = `http://127.0.0.1:${t.default_port}/`;
            return (
              <section className="card embed-card">
                <div className="section-header">
                  <h3>👁 {t.name} <span className="muted" style={{fontFamily:'ui-monospace',fontSize:'0.78rem'}}>{url}</span></h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="secondary" onClick={() => {
                      const ifr = document.getElementById('embed-iframe') as HTMLIFrameElement | null;
                      if (ifr) ifr.src = ifr.src;
                    }}>🔄 Reload</button>
                    <button className="secondary" onClick={() => setViewingTool(null)}>✕ Cerrar</button>
                  </div>
                </div>
                <iframe
                  id="embed-iframe"
                  title={`${t.name} embed`}
                  src={url}
                  className="tool-embed-iframe"
                />
              </section>
            );
          })()}

          {/* Herramientas */}
          <section className="card">
            <div className="section-header">
              <h3>Herramientas</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="secondary"
                  disabled={isRefreshing}
                  onClick={async () => {
                    setIsRefreshing(true);
                    await Promise.all([reloadTools(), reloadSummary(), reloadStats()]);
                    // Health de cada tool con puerto
                    for (const t of tools) {
                      if (t.default_port) {
                        const r = await tauriInvoke<HealthResult>('health_check_tool', { toolId: t.id });
                        if (r) setHealth((prev) => ({ ...prev, [t.id]: r }));
                        if (r?.running || r?.port_open) setRunningIds((prev) => new Set(prev).add(t.id));
                      }
                    }
                    setIsRefreshing(false);
                  }}
                >
                  {isRefreshing ? '⏳ Refrescando…' : '🔄 Refrescar estado'}
                </button>
                <button className="secondary" onClick={addAllPendingToQueue} disabled={isQueueRunning}>
                  + Añadir pendientes a cola
                </button>
              </div>
            </div>
            <div className="tool-grid">
              {tools.map((tool) => {
                const isBusy = busyToolId === tool.id;
                const canInstall = Boolean(tool.install_script);
                const isRunning = runningIds.has(tool.id);
                const toolHealth = health[tool.id];
                const showRelocate = relocateFor === tool.id;

                return (
                  <article key={tool.id} className="tool-card">
                    <div className="tool-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <h4>{tool.name}</h4>
                        <HealthDot health={toolHealth} />
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {tool.recommended && <span className="pill">Recomendado</span>}
                        {isRunning && <span className="pill pill-green">Activo</span>}
                        {tool.relocated && <span className="pill" title="Tiene override de ubicación">📍 Reubicado</span>}
                      </div>
                    </div>
                    <p className="muted">{CATEGORY_LABEL[tool.category]} · {tool.runtime}</p>
                    <p>{tool.description}</p>

                    <dl className="tool-meta">
                      <div><dt>Estado</dt><dd>{tool.installed ? '✅ Instalado' : '⏳ Pendiente'}</dd></div>
                      {toolHealth && (
                        <div><dt>Health</dt><dd>{toolHealth.port_open ? '🟢 Puerto OK' : '🔴 Puerto cerrado'}{toolHealth.pid ? ` · PID ${toolHealth.pid}` : ''}</dd></div>
                      )}
                      <div><dt>Ruta</dt><dd style={{fontFamily:'monospace',fontSize:'0.82rem'}}>{tool.install_dir}</dd></div>
                      {tool.default_port && <div><dt>Puerto</dt><dd>{tool.default_port}</dd></div>}
                    </dl>

                    <div className="tool-actions">
                      {!tool.installed && (
                        <button disabled={isBusy || !canInstall} onClick={() => handleInstall(tool)}>
                          {isBusy ? '⏳' : '📦 Instalar'}
                        </button>
                      )}
                      {tool.installed && !isRunning && (
                        <button disabled={isBusy} onClick={() => handleStart(tool)}>
                          {isBusy ? '⏳' : '▶ Iniciar'}
                        </button>
                      )}
                      {isRunning && (
                        <>
                          <button className="secondary" disabled={isBusy} onClick={() => handleStop(tool)}>⏹ Stop</button>
                          <button className="secondary" disabled={isBusy} onClick={() => handleRestart(tool)}>🔄 Restart</button>
                        </>
                      )}
                      {tool.installed && canInstall && (
                        <button className="secondary" disabled={isBusy} onClick={() => handleUpdate(tool)}>⬆ Update</button>
                      )}
                      {!tool.installed && canInstall && (
                        <button className="secondary" disabled={isQueueRunning || queue.some((q) => q.toolId === tool.id)} onClick={() => addToQueue(tool)}>
                          + Cola
                        </button>
                      )}
                      {tool.default_port && (toolHealth?.port_open || isRunning) && (
                        <button
                          className="primary-soft"
                          onClick={() => setViewingTool(viewingTool === tool.id ? null : tool.id)}
                          title={`Abrir UI en panel embebido (http://127.0.0.1:${tool.default_port})`}
                        >
                          {viewingTool === tool.id ? '✕ Cerrar UI' : '👁 Ver UI'}
                        </button>
                      )}
                      <button className="secondary" disabled={isBusy} onClick={() => handleOpenFolder(tool)} title="Abrir carpeta">📁</button>
                      <button className="secondary" disabled={isBusy} onClick={() => handleOpenLog(tool)} title="Ver log">📋</button>
                      <button className="secondary" disabled={isBusy || isRunning} onClick={() => startRelocate(tool)} title="Reubicar a zona modules">
                        📍 Mover
                      </button>
                      {tool.relocated && (
                        <button className="secondary" disabled={isBusy} onClick={() => handleClearOverride(tool)} title="Quitar override">
                          ↺ Reset ruta
                        </button>
                      )}
                    </div>

                    {showRelocate && (
                      <div className="relocate-row">
                        <input
                          value={relocateTarget}
                          onChange={(e) => setRelocateTarget(e.target.value)}
                          placeholder="/ruta/absoluta/de/destino"
                        />
                        <button onClick={() => handleRelocate(tool)} disabled={isBusy || !relocateTarget.trim()}>Mover</button>
                        <button className="secondary" onClick={() => setRelocateFor(null)}>Cancelar</button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </section>
      </main>

      <StatusBar stats={stats} summary={summary} />
    </>
  );
}
