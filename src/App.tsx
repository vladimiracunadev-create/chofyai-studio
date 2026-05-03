import { Component, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  ActionResult,
  AppSettings,
  HealthResult,
  InstallEvent,
  ModelEntry,
  QueueItem,
  SystemStats,
  SystemSummary,
  Toast,
  ToastKind,
  ToolManifest,
  VolumeCandidate,
} from './types';

// ─── Toasts globales ─────────────────────────────────────────────────────────
type Toaster = (kind: ToastKind, title: string, body?: string) => void;
let pushToast: Toaster = () => {};
function setToasterRef(fn: Toaster) { pushToast = fn; }
export function notify(kind: ToastKind, title: string, body?: string) { pushToast(kind, title, body); }

// Notificación nativa macOS (vía osascript). Silent fail si no está en Tauri.
async function notifyNative(title: string, body: string) {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;
  try { await invoke('notify_macos', { title, body }); } catch { /* ignore */ }
}

// Versión actual hardcoded. Match con package.json version.
const APP_VERSION = '0.5.0-dev';

const ONBOARDING_KEY = 'chofyai_onboarding_done';

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

// ─── Helpers (en src/utils.ts para tests) ─────────────────────────────────────
import { fmtBytes, fmtElapsed, parseInstallLine } from './utils';

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>, opts?: { silent?: boolean }): Promise<T | null> {
  if (!inTauri) return null;
  try { return await invoke<T>(cmd, args); }
  catch (err) {
    if (!opts?.silent) {
      const msg = typeof err === 'string' ? err : (err as Error)?.message || String(err);
      notify('error', `${cmd} falló`, msg);
    }
    return null;
  }
}

// ─── Command Palette (⌘K) ────────────────────────────────────────────────────
type CmdAction = { id: string; label: string; hint?: string; group: string; run: () => void };

function CommandPalette({
  open, onClose, actions,
}: { open: boolean; onClose: () => void; actions: CmdAction[] }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setQuery(''); setCursor(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return actions.slice(0, 30);
    return actions.filter((a) => (a.label + ' ' + (a.hint ?? '') + ' ' + a.group).toLowerCase().includes(q)).slice(0, 30);
  }, [actions, query]);

  useEffect(() => { setCursor(0); }, [query]);

  if (!open) return null;
  const exec = (a?: CmdAction) => { if (a) { a.run(); onClose(); } };

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk-modal" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="🔎 Buscar comando o tool…   (esc)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); exec(filtered[cursor]); }
          }}
        />
        <div className="cmdk-list">
          {filtered.length === 0 && <div className="cmdk-empty">Sin resultados</div>}
          {filtered.map((a, i) => (
            <button
              key={a.id}
              className={`cmdk-item ${i === cursor ? 'active' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => exec(a)}
            >
              <span className="cmdk-group">{a.group}</span>
              <span className="cmdk-label">{a.label}</span>
              {a.hint && <span className="cmdk-hint">{a.hint}</span>}
            </button>
          ))}
        </div>
        <div className="cmdk-footer">↑↓ navegar · ↵ ejecutar · esc cerrar</div>
      </div>
    </div>
  );
}

// ─── Models panel ────────────────────────────────────────────────────────────
function ModelsPanel({ tool, onClose }: { tool: ToolManifest; onClose: () => void }) {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    const r = await tauriInvoke<ModelEntry[]>('list_tool_models', { toolId: tool.id });
    setModels(r ?? []);
    setLoading(false);
  };
  useEffect(() => { void reload(); }, [tool.id]);

  const totalBytes = models.reduce((acc, m) => acc + m.size_bytes, 0);

  const onDelete = async (m: ModelEntry) => {
    if (!confirm(`¿Borrar "${m.relative_path}" (${fmtBytes(m.size_bytes)})?`)) return;
    const r = await tauriInvoke<ActionResult>('delete_tool_model', { toolId: tool.id, relativePath: m.relative_path });
    if (r?.ok) { notify('success', 'Modelo borrado', m.name); void reload(); }
  };

  return (
    <section className="card models-card">
      <div className="section-header">
        <h3>📦 Modelos · {tool.name} <span className="muted" style={{fontSize:'0.78rem'}}>{models.length} archivo(s) · {fmtBytes(totalBytes)}</span></h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="secondary" onClick={() => void reload()}>🔄</button>
          <button className="secondary" onClick={onClose}>✕</button>
        </div>
      </div>
      {loading && <p className="muted">Escaneando…</p>}
      {!loading && models.length === 0 && (
        <p className="muted">No hay modelos en <code>{tool.install_dir}/models</code> aún.</p>
      )}
      {!loading && models.length > 0 && (
        <div className="models-list">
          {models.map((m) => (
            <div key={m.absolute_path} className="model-row">
              <div className="model-info">
                <strong>{m.name}</strong>
                <span className="muted" style={{fontSize:'0.74rem',fontFamily:'ui-monospace'}}>{m.relative_path}</span>
              </div>
              <span className="model-size">{fmtBytes(m.size_bytes)}</span>
              <button className="secondary danger-soft" onClick={() => void onDelete(m)} title="Borrar archivo">🗑</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Settings modal ──────────────────────────────────────────────────────────
function SettingsModal({
  open, onClose, summary, volumes, onSaved, tools,
}: {
  open: boolean; onClose: () => void; summary: SystemSummary | null;
  volumes: VolumeCandidate[]; onSaved: () => void; tools: ToolManifest[];
}) {
  const [draft, setDraft] = useState<string>('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setDraft(summary?.studio_home ?? '');
    void (async () => {
      // Cargar overrides actuales
      try {
        const settingsResp = await tauriInvoke<Record<string, unknown>>('get_system_summary');
        if (settingsResp) {
          const t = tools.filter((x) => x.relocated);
          const m: Record<string, string> = {};
          for (const x of t) m[x.id] = x.install_dir;
          setOverrides(m);
        }
      } catch { /* noop */ }
    })();
  }, [open, summary, tools]);

  if (!open) return null;

  const onSaveHome = async () => {
    if (!draft.trim()) return;
    const r = await tauriInvoke<unknown>('save_studio_home', { studioHome: draft });
    if (r) {
      notify('success', 'Studio home guardado', draft);
      onSaved();
    }
  };

  const onClearOverride = async (toolId: string) => {
    const r = await tauriInvoke<ActionResult>('clear_module_override', { toolId });
    if (r) {
      notify('success', 'Override eliminado', toolId);
      const next = { ...overrides }; delete next[toolId]; setOverrides(next);
      onSaved();
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-header">
          <h2>⚙️ Configuración</h2>
          <button className="secondary" onClick={onClose}>✕</button>
        </div>

        <section style={{ marginTop: 14 }}>
          <h4>💾 Studio home</h4>
          <p className="muted" style={{ fontSize: '0.82rem' }}>Ruta base donde se instalan las herramientas.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="onb-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="/ruta/absoluta"
            />
            <button onClick={onSaveHome} disabled={!draft.trim() || draft === summary?.studio_home}>Guardar</button>
          </div>
          <div className="vol-grid">
            {volumes.map((v) => (
              <button
                key={v.path}
                className={`vol-chip ${v.path === draft ? 'active' : ''}`}
                onClick={() => setDraft(v.path)}
                disabled={!v.writable || !v.mounted}
                title={v.writable ? 'Escribible' : 'Solo lectura'}
              >
                <strong>{v.label}</strong>
                <span>{v.free_bytes ? fmtBytes(v.free_bytes) + ' libres' : '—'}</span>
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <h4>📍 Overrides de tools</h4>
          {Object.keys(overrides).length === 0 ? (
            <p className="muted" style={{ fontSize: '0.82rem' }}>Sin overrides — todas las tools usan <code>studio_home/tools/&lt;id&gt;</code>.</p>
          ) : (
            <div className="override-list">
              {Object.entries(overrides).map(([id, p]) => (
                <div key={id} className="override-row">
                  <strong>{id}</strong>
                  <code style={{ fontSize: '0.74rem', flex: 1 }}>{p}</code>
                  <button className="secondary" onClick={() => void onClearOverride(id)}>↺ Reset</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginTop: 18, fontSize: '0.78rem' }} className="muted">
          <h4 style={{ marginBottom: 4 }}>🩺 Diagnóstico</h4>
          <div>OS: {summary?.os} · Arch: {summary?.arch} · App: v{APP_VERSION}</div>
          <div>settings.json: <code>{summary?.settings_file}</code></div>
          {summary?.using_fallback && <div style={{ color: '#ffcd80' }}>⚠ Usando fallback ({summary.studio_home_effective})</div>}
        </section>
      </div>
    </div>
  );
}

// ─── Onboarding (first-run wizard) ────────────────────────────────────────────
function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [studioHome, setStudioHome] = useState<string>('');
  const [diskInfo, setDiskInfo] = useState<{ fs?: string; gbFree?: number; suggestion?: 'apfs' | 'sparsebundle' | 'ok' }>({});
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (step !== 1) return;
    void (async () => {
      const sum = await tauriInvoke<SystemSummary>('get_system_summary', undefined, { silent: true });
      const v = await tauriInvoke<VolumeCandidate[]>('list_volume_candidates', undefined, { silent: true });
      const initial = sum?.studio_home_effective ?? sum?.studio_home ?? `${(window as any).__home__ ?? ''}/ChofyAIStudio`;
      setStudioHome(initial);
      // Adivinar FS heurísticamente desde el path (no podemos detectarlo sin un comando extra)
      if (initial.startsWith('/Volumes/')) {
        const target = v?.find((x) => initial.startsWith(x.path));
        const free = target?.free_bytes ? target.free_bytes / (1024 ** 3) : undefined;
        setDiskInfo({ fs: 'externo', gbFree: free, suggestion: 'sparsebundle' });
      } else {
        setDiskInfo({ fs: 'APFS interno', suggestion: 'ok' });
      }
    })();
  }, [step]);

  const finish = () => {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* ignore */ }
    onDone();
  };

  const installWhisper = async () => {
    const wsp = await tauriInvoke<ToolManifest[]>('list_tools', undefined, { silent: true });
    const tool = wsp?.find((t) => t.id === 'whispercpp');
    if (!tool) return;
    setInstalling(true);
    notify('info', 'Instalando whisper.cpp…', 'Esto toma ~2 min en Apple Silicon');
    const r = await tauriInvoke<ActionResult>('install_tool', { toolId: tool.id });
    setInstalling(false);
    if (r) {
      notify('success', 'whisper.cpp listo', 'Puedes pasar al siguiente paso');
      void notifyNative('ChofyAI Studio', 'whisper.cpp instalado correctamente');
      setStep(3);
    }
  };

  const saveStudioHome = async () => {
    const r = await tauriInvoke<ActionResult>('save_studio_home', { studioHome });
    if (r) {
      notify('success', 'Studio home guardado', studioHome);
      setStep(2);
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <div className="onb-progress">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`onb-dot ${i <= step ? 'active' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="onb-step">
            <span className="onb-emoji">🎨</span>
            <h2>Bienvenido a ChofyAI Studio</h2>
            <p>Un launcher local para tus herramientas creativas de IA en Apple Silicon. Te guío en 3 pasos rápidos.</p>
            <ul className="onb-features">
              <li>🎤 Voz · 🎙 ASR · 🎬 Video · 🖼 Imagen · 🎵 Música</li>
              <li>💾 Modelos en disco externo o interno</li>
              <li>👁 UI de cada herramienta dentro de esta ventana</li>
            </ul>
            <div className="onb-actions">
              <button className="secondary" onClick={finish}>Saltar</button>
              <button onClick={() => setStep(1)}>Empezar →</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="onb-step">
            <span className="onb-emoji">💾</span>
            <h2>¿Dónde guardamos tus modelos?</h2>
            <p className="muted">Las herramientas pueden ocupar 1–10 GB cada una. Recomendamos un volumen con espacio.</p>
            <input
              className="onb-input"
              value={studioHome}
              onChange={(e) => setStudioHome(e.target.value)}
              placeholder="/ruta/absoluta"
            />
            {diskInfo.suggestion === 'sparsebundle' && (
              <div className="onb-warn">
                ⚠️ Esta ruta parece estar en un volumen externo. Si es <strong>exFAT/HFS+</strong> los wheels Python fallarán.
                Te recomendamos crear una imagen <strong>APFS sparsebundle</strong>:
                <pre className="onb-code">{`hdiutil create -size 100g -fs APFS \\
  -volname ChofyAIStudio -type SPARSEBUNDLE \\
  ${studioHome}.sparsebundle`}</pre>
                Luego monta y apunta studio_home a <code>/Volumes/ChofyAIStudio</code>.
              </div>
            )}
            {diskInfo.gbFree !== undefined && (
              <p className="muted">Espacio libre detectado: <strong>{diskInfo.gbFree.toFixed(1)} GB</strong></p>
            )}
            <div className="onb-actions">
              <button className="secondary" onClick={() => setStep(0)}>← Atrás</button>
              <button onClick={saveStudioHome} disabled={!studioHome.trim()}>Guardar y continuar →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onb-step">
            <span className="onb-emoji">⚡</span>
            <h2>Instala tu primera herramienta</h2>
            <p>Sugerencia: <strong>whisper.cpp</strong> — transcripción local con Metal/MPS, compila en ~2 min, ocupa 247 MB.</p>
            <div className="onb-card-mini">
              <strong>🎙 whisper.cpp</strong>
              <span className="muted">ASR · sin GPU · base.en model 141 MB</span>
            </div>
            <div className="onb-actions">
              <button className="secondary" onClick={() => setStep(3)}>Lo haré después</button>
              <button onClick={installWhisper} disabled={installing}>
                {installing ? '⏳ Instalando…' : '⚡ Instalar ahora'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onb-step">
            <span className="onb-emoji">🎉</span>
            <h2>Todo listo</h2>
            <p>Cuando una herramienta esté activa, usa <strong>👁 Ver UI</strong> para abrirla dentro de esta ventana.</p>
            <ul className="onb-features">
              <li>📋 Botón log en cada tarjeta para ver logs en vivo</li>
              <li>🔄 Botón refresh si los estados no cuadran</li>
              <li>📍 Reubica modelos pesados a otro volumen sin reinstalar</li>
            </ul>
            <div className="onb-actions">
              <button onClick={finish}>Empezar a usar ✨</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── UpdateChecker ───────────────────────────────────────────────────────────
type ReleaseInfo = { tag_name: string; html_url: string; published_at: string };
function UpdateChecker() {
  const [latest, setLatest] = useState<ReleaseInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('https://api.github.com/repos/vladimiracunadev-create/chofyai-studio/releases/latest', {
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!r.ok) return;
        const data: ReleaseInfo = await r.json();
        if (!data.tag_name) return;
        const remote = data.tag_name.replace(/^v/, '');
        const local = APP_VERSION.replace(/-dev$/, '');
        if (remote !== local && remote > local) setLatest(data);
      } catch { /* offline o sin releases — silencioso */ }
    })();
  }, []);

  if (!latest || dismissed) return null;
  return (
    <div className="update-banner">
      <span className="update-emoji">🆕</span>
      <span>
        Versión <strong>{latest.tag_name}</strong> disponible (tienes <code>{APP_VERSION}</code>).
      </span>
      <a href={latest.html_url} target="_blank" rel="noreferrer" className="update-link">Ver release →</a>
      <button className="update-close" onClick={() => setDismissed(true)} title="Ocultar">×</button>
    </div>
  );
}

// ─── Toaster ─────────────────────────────────────────────────────────────────
function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    setToasterRef((kind, title, body) => {
      const t: Toast = { id: `${Date.now()}_${Math.random()}`, kind, title, body, ts: Date.now() };
      setToasts((prev) => [...prev.slice(-4), t]);
      const ttl = kind === 'error' ? 8000 : kind === 'warn' ? 6000 : 4000;
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), ttl);
    });
  }, []);
  return (
    <div className="toaster">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <div className="toast-row">
            <span className="toast-icon">
              {t.kind === 'error' && '❌'}
              {t.kind === 'warn' && '⚠️'}
              {t.kind === 'success' && '✅'}
              {t.kind === 'info' && 'ℹ️'}
            </span>
            <div className="toast-body">
              <strong>{t.title}</strong>
              {t.body && <p>{t.body}</p>}
            </div>
            <button className="toast-close" onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}>×</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ErrorBoundary ───────────────────────────────────────────────────────────
class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('UI ErrorBoundary:', error, info);
    notify('error', 'Error de interfaz', error.message);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h2>💥 La interfaz se rompió</h2>
          <p>{this.state.error.message}</p>
          <button onClick={() => { this.setState({ error: null }); location.reload(); }}>🔄 Recargar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── LogsViewer (panel inline) ───────────────────────────────────────────────
function LogsViewer({ toolId, name, onClose }: { toolId: string; name: string; onClose: () => void }) {
  const [content, setContent] = useState<string>('Cargando…');
  const [kind, setKind] = useState<'install' | 'run'>('run');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState('');
  const preRef = useRef<HTMLPreElement>(null);

  const reload = async () => {
    const res = await tauriInvoke<string>('read_tool_log', { toolId, kind, lastLines: 500 });
    if (res !== null) setContent(res);
  };
  useEffect(() => { void reload(); }, [toolId, kind]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { void reload(); }, 2000);
    return () => clearInterval(id);
  }, [autoRefresh, toolId, kind]);
  useEffect(() => {
    if (preRef.current && autoRefresh) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [content, autoRefresh]);

  const filtered = filter
    ? content.split('\n').filter((l) => l.toLowerCase().includes(filter.toLowerCase())).join('\n')
    : content;

  return (
    <section className="card logs-card">
      <div className="section-header">
        <h3>📋 Logs · {name}</h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select value={kind} onChange={(e) => setKind(e.target.value as 'install' | 'run')}>
            <option value="run">▶ run</option>
            <option value="install">📦 install</option>
          </select>
          <input
            placeholder="🔍 filtrar…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: 6, background: '#0f1115', border: '1px solid rgba(255,255,255,0.08)', color: '#d3dcec' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            auto
          </label>
          <button className="secondary" onClick={() => void reload()}>🔄</button>
          <button className="secondary" onClick={onClose}>✕</button>
        </div>
      </div>
      <pre ref={preRef} className="logs-pre">{filtered || '(vacío)'}</pre>
    </section>
  );
}

// ─── Componentes ─────────────────────────────────────────────────────────────
function HealthDot({ health, starting }: { health?: HealthResult; starting?: boolean }) {
  if (!health && !starting) return null;
  const ok = health?.running || health?.port_open;
  const color = ok ? '#36d7b7' : starting ? '#f5a623' : '#666';
  const title = ok ? `Activo · PID ${health?.pid ?? '—'}` : starting ? 'Iniciando…' : 'Detenido';
  return (
    <span
      title={title}
      style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', marginLeft: 6, flexShrink: 0,
        background: color,
        boxShadow: ok ? `0 0 6px ${color}` : starting ? `0 0 6px ${color}` : 'none',
        animation: starting && !ok ? 'pulse 1.2s ease-in-out infinite' : undefined }}
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
  const [viewingLogsFor, setViewingLogsFor] = useState<string | null>(null);
  const [startingTools, setStartingTools] = useState<Record<string, number>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try { return !localStorage.getItem(ONBOARDING_KEY); } catch { return false; }
  });
  const [showCmdK, setShowCmdK] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewingModelsFor, setViewingModelsFor] = useState<string | null>(null);

  // Atajo global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCmdK((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Acciones para la paleta
  const cmdActions = useMemo<CmdAction[]>(() => {
    const list: CmdAction[] = [
      { id: 'open-settings', label: '⚙️ Abrir configuración', group: 'App', run: () => setShowSettings(true) },
      { id: 'open-tour', label: '👋 Re-abrir tour', group: 'App', run: () => setShowOnboarding(true) },
      { id: 'refresh-all', label: '🔄 Refrescar tools y stats', group: 'App', run: () => { void reloadTools(); void reloadStats(); } },
      { id: 'clear-queue', label: '🧹 Limpiar cola', group: 'App', run: () => { if (!isQueueRunning) { setQueue([]); setQueueVisible(false); } } },
    ];
    for (const t of tools) {
      const port = t.default_port ? `:${t.default_port}` : '';
      const installed = t.installed;
      if (!installed) {
        list.push({ id: `install-${t.id}`, label: `📦 Instalar ${t.name}`, hint: t.id, group: t.category, run: () => { void handleInstall(t); } });
      } else {
        list.push({ id: `start-${t.id}`, label: `▶ Iniciar ${t.name}`, hint: port, group: t.category, run: () => { void handleStart(t); } });
        list.push({ id: `stop-${t.id}`, label: `⏹ Detener ${t.name}`, group: t.category, run: () => { void handleStop(t); } });
        list.push({ id: `restart-${t.id}`, label: `🔄 Reiniciar ${t.name}`, group: t.category, run: () => { void handleRestart(t); } });
        if (t.default_port) {
          list.push({ id: `view-${t.id}`, label: `👁 Ver UI de ${t.name}`, hint: port, group: t.category, run: () => setViewingTool(t.id) });
        }
        list.push({ id: `logs-${t.id}`, label: `📋 Ver logs de ${t.name}`, group: t.category, run: () => setViewingLogsFor(t.id) });
        list.push({ id: `models-${t.id}`, label: `📦 Modelos de ${t.name}`, group: t.category, run: () => setViewingModelsFor(t.id) });
        list.push({ id: `folder-${t.id}`, label: `📁 Abrir carpeta de ${t.name}`, group: t.category, run: () => { void handleOpenFolder(t); } });
      }
    }
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools, isQueueRunning]);
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
      const t = tools.find((x) => x.id === tool_id);
      if (ok) {
        notify('success', `${t?.name ?? tool_id} instalado`, line);
        void notifyNative('ChofyAI Studio', `${t?.name ?? tool_id} instalado correctamente`);
      } else {
        notify('error', `${t?.name ?? tool_id} falló`, line);
        void notifyNative('ChofyAI Studio · error', `Falló la instalación de ${t?.name ?? tool_id}`);
      }
    });
    return () => { void unP.then((fn) => fn()); void unD.then((fn) => fn()); };
  }, []);

  // Health periódico — CADA tool con puerto (no solo runningIds)
  // Tolera 60s en estado "starting" antes de marcar como caído
  useEffect(() => {
    if (!inTauri || tools.length === 0) return;
    const probe = async () => {
      for (const t of tools) {
        if (!t.default_port) continue;
        const result = await tauriInvoke<HealthResult>('health_check_tool', { toolId: t.id }, { silent: true });
        if (!result) continue;
        setHealth((prev) => ({ ...prev, [t.id]: result }));
        if (result.running || result.port_open) {
          setRunningIds((prev) => prev.has(t.id) ? prev : new Set(prev).add(t.id));
          // Limpia starting si ya respondió
          setStartingTools((prev) => {
            if (!(t.id in prev)) return prev;
            const n = { ...prev }; delete n[t.id]; return n;
          });
        } else {
          // Durante 60s post-start: NO declarar caído
          const startedAt = startingTools[t.id];
          if (startedAt && Date.now() - startedAt < 60_000) continue;
          setRunningIds((prev) => {
            if (!prev.has(t.id)) return prev;
            const s = new Set(prev); s.delete(t.id); return s;
          });
          setStartingTools((prev) => {
            if (!(t.id in prev)) return prev;
            const n = { ...prev }; delete n[t.id]; return n;
          });
        }
      }
    };
    void probe();
    const interval = setInterval(probe, 5000);
    return () => clearInterval(interval);
  }, [tools, startingTools]);

  // Adopta PIDs persistidos al primer load (mantiene UI sincronizada con Rust)
  useEffect(() => {
    if (!inTauri) return;
    void (async () => {
      const pids = await tauriInvoke<Record<string, number>>('list_running_pids', undefined, { silent: true });
      if (pids && Object.keys(pids).length > 0) {
        setRunningIds(new Set(Object.keys(pids)));
        notify('info', 'Procesos restaurados', `${Object.keys(pids).length} servidor(es) sigue(n) vivo(s)`);
      }
    })();
  }, []);

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
    setStartingTools((prev) => ({ ...prev, [tool.id]: Date.now() }));
    const r = await tauriInvoke<ActionResult>('start_tool', { toolId: tool.id });
    setRunningIds((prev) => new Set([...prev, tool.id]));
    if (r) {
      setMessage(r.message);
      notify('success', `${tool.name} iniciado`, r.message);
    } else {
      setStartingTools((prev) => { const n = { ...prev }; delete n[tool.id]; return n; });
    }
    setBusyToolId(null);
  };

  const handleStop = async (tool: ToolManifest) => {
    setBusyToolId(tool.id);
    const r = await tauriInvoke<ActionResult>('stop_tool', { toolId: tool.id });
    setRunningIds((prev) => { const s = new Set(prev); s.delete(tool.id); return s; });
    setHealth((prev) => { const next = { ...prev }; delete next[tool.id]; return next; });
    setStartingTools((prev) => { const n = { ...prev }; delete n[tool.id]; return n; });
    if (r) { setMessage(r.message); notify('info', `${tool.name} detenido`); }
    setBusyToolId(null);
  };

  const handleRestart = async (tool: ToolManifest) => {
    setBusyToolId(tool.id);
    setStartingTools((prev) => ({ ...prev, [tool.id]: Date.now() }));
    const r = await tauriInvoke<ActionResult>('restart_tool', { toolId: tool.id });
    setRunningIds((prev) => new Set([...prev, tool.id]));
    if (r) { setMessage(r.message); notify('success', `${tool.name} reiniciado`); }
    setBusyToolId(null);
  };

  const handleOpenFolder = async (tool: ToolManifest) => {
    const r = await tauriInvoke<ActionResult>('open_tool_directory', { toolId: tool.id });
    if (r) setMessage(r.message);
  };

  const handleOpenLog = (tool: ToolManifest) => {
    setViewingLogsFor(viewingLogsFor === tool.id ? null : tool.id);
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
    <AppErrorBoundary>
      <Toaster />
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
      <UpdateChecker />
      <CommandPalette open={showCmdK} onClose={() => setShowCmdK(false)} actions={cmdActions} />
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        summary={summary}
        volumes={volumes}
        tools={tools}
        onSaved={() => { void reloadSummary(); void reloadTools(); void reloadVolumes(); }}
      />
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
            <button className="nav-item" onClick={() => setShowSettings(true)} title="Editar studio_home, volúmenes y overrides">
              ⚙️ Settings
            </button>
            <button className="nav-item">Doctor</button>
            <button className="nav-item" onClick={() => setShowOnboarding(true)} title="Re-abrir onboarding">
              👋 Tour
            </button>
            <button className="nav-item" onClick={() => setShowCmdK(true)} title="⌘K paleta de comandos">
              ⌘K Comandos
            </button>
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

          {/* Logs viewer panel */}
          {viewingLogsFor && (() => {
            const t = tools.find((x) => x.id === viewingLogsFor);
            if (!t) return null;
            return <LogsViewer toolId={t.id} name={t.name} onClose={() => setViewingLogsFor(null)} />;
          })()}

          {/* Models panel */}
          {viewingModelsFor && (() => {
            const t = tools.find((x) => x.id === viewingModelsFor);
            if (!t) return null;
            return <ModelsPanel tool={t} onClose={() => setViewingModelsFor(null)} />;
          })()}

          {/* Empty state si no hay tools instaladas */}
          {tools.length > 0 && tools.every((t) => !t.installed) && (
            <section className="card empty-state-card">
              <div className="empty-content">
                <span className="empty-emoji">🚀</span>
                <h3>Aún no tienes herramientas instaladas</h3>
                <p className="muted">
                  Instala tu primera herramienta para empezar. Recomendamos <strong>whisper.cpp</strong>:
                  rápido (compila en ~2 min), funciona sin GPU, y descarga solo 141 MB.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {(() => {
                    const wsp = tools.find((x) => x.id === 'whispercpp');
                    return wsp ? (
                      <button onClick={() => handleInstall(wsp)} disabled={busyToolId === 'whispercpp'}>
                        ⚡ Instalar whisper.cpp ahora
                      </button>
                    ) : null;
                  })()}
                  <button className="secondary" onClick={addAllPendingToQueue} disabled={isQueueRunning}>
                    📦 Encolar las 5 herramientas
                  </button>
                </div>
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
                        <HealthDot health={toolHealth} starting={Boolean(startingTools[tool.id])} />
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
                      {tool.installed && (
                        <button className="secondary" onClick={() => setViewingModelsFor(viewingModelsFor === tool.id ? null : tool.id)} title="Ver/borrar modelos">📦</button>
                      )}
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
    </AppErrorBoundary>
  );
}
