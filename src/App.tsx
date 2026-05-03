import { Component, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  ActionResult,
  AppSettings,
  HealthResult,
  InstallEvent,
  MarketplaceEntry,
  ModelEntry,
  QueueItem,
  SystemStats,
  SystemSummary,
  Toast,
  ToastKind,
  ToolManifest,
  VolumeCandidate,
  WorkflowDef,
  WorkflowStep,
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
const THEME_KEY = 'chofyai_theme';

type Theme = 'dark' | 'light' | 'system';
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  let resolved: 'dark' | 'light' = 'dark';
  if (theme === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } else {
    resolved = theme;
  }
  root.dataset.theme = resolved;
}

// ─── Catálogo de atajos de teclado ───────────────────────────────────────────
type Shortcut = { keys: string; label: string; group: string };
const SHORTCUTS: Shortcut[] = [
  { keys: '⌘K', label: 'Paleta de comandos', group: 'Navegación' },
  { keys: '⌘,', label: 'Abrir Settings', group: 'Navegación' },
  { keys: '⌘/', label: 'Mostrar ayuda y atajos', group: 'Navegación' },
  { keys: '⌘R', label: 'Refrescar tools y stats', group: 'Acciones' },
  { keys: '⌘L', label: 'Ver logs (último tool tocado)', group: 'Acciones' },
  { keys: '⌘B', label: 'Toggle modo claro/oscuro', group: 'Apariencia' },
  { keys: '⌘M', label: 'Abrir Marketplace', group: 'Navegación' },
  { keys: '⌘W', label: 'Abrir Workflows', group: 'Navegación' },
  { keys: 'Esc', label: 'Cerrar modal/panel actual', group: 'Navegación' },
  { keys: '↑↓', label: 'Navegar lista en paleta ⌘K', group: 'Navegación' },
  { keys: '↵', label: 'Ejecutar comando seleccionado', group: 'Navegación' },
];

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
import { getLang, setLang, t as ti18n, useT } from './i18n';
import type { Lang } from './i18n';

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

// ─── Workflows ───────────────────────────────────────────────────────────────
function substituteVars(template: string, inputs: Record<string, string>): string {
  return template.replace(/\{\{\s*inputs\.(\w+)\s*\}\}/g, (_, k) => inputs[k] ?? '');
}

type StepResult = { stepId: string; status: 'pending' | 'running' | 'ok' | 'fail' | 'skipped'; output?: string; error?: string; durationMs?: number };

async function runWorkflowStep(
  step: WorkflowStep,
  inputs: Record<string, string>,
  files: Record<string, File>,
): Promise<{ ok: boolean; output?: string; error?: string }> {
  if (step.type === 'stub') {
    return { ok: true, output: `(stub) ${step.note ?? 'Step no ejecutable — placeholder'}` };
  }
  if (step.type !== 'http' || !step.url) return { ok: false, error: 'step inválido' };

  const url = substituteVars(step.url, inputs);
  let resp: Response;
  try {
    if (step.body_kind === 'multipart') {
      const form = new FormData();
      for (const [k, vRaw] of Object.entries(step.fields ?? {})) {
        const v = substituteVars(vRaw, inputs);
        if (v.startsWith('__FILE__:')) {
          const fileKey = v.replace('__FILE__:', '');
          const f = files[fileKey];
          if (!f) return { ok: false, error: `archivo '${fileKey}' faltante` };
          form.append(k, f);
        } else {
          form.append(k, v);
        }
      }
      resp = await fetch(url, { method: step.method ?? 'POST', body: form });
    } else if (step.body_kind === 'json') {
      const bodyStr = substituteVars(step.body ?? '{}', inputs);
      resp = await fetch(url, {
        method: step.method ?? 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
      });
    } else {
      resp = await fetch(url, { method: step.method ?? 'GET' });
    }
  } catch (e) {
    return { ok: false, error: `Network: ${(e as Error).message}` };
  }

  if (!resp.ok) return { ok: false, error: `HTTP ${resp.status} ${resp.statusText}` };

  const contentType = resp.headers.get('content-type') ?? '';
  let raw: unknown;
  if (contentType.includes('application/json')) raw = await resp.json();
  else raw = await resp.text();

  const fromKey = step.output?.from;
  let extracted: string;
  if (fromKey && typeof raw === 'object' && raw !== null) {
    const val = (raw as Record<string, unknown>)[fromKey];
    extracted = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
  } else {
    extracted = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
  }
  return { ok: true, output: extracted };
}

function WorkflowRunner({
  wf, onClose,
}: { wf: WorkflowDef; onClose: () => void }) {
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const i of wf.inputs ?? []) if (i.default) init[i.id] = i.default;
    return init;
  });
  const [files, setFiles] = useState<Record<string, File>>({});
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<StepResult[]>([]);

  const canRun = (wf.inputs ?? []).every((i) => {
    if (!i.required) return true;
    return i.type === 'file' ? Boolean(files[i.id]) : Boolean(inputs[i.id]?.trim());
  });

  const runAll = async () => {
    setRunning(true);
    const initialResults: StepResult[] = wf.steps.map((s) => ({ stepId: s.id, status: 'pending' }));
    setResults(initialResults);

    // Inputs efectivos: para 'file' pasamos un placeholder __FILE__:<id>
    const effInputs: Record<string, string> = { ...inputs };
    for (const i of wf.inputs ?? []) {
      if (i.type === 'file' && files[i.id]) effInputs[i.id] = `__FILE__:${i.id}`;
    }

    let prevOutput: string | undefined;
    for (let idx = 0; idx < wf.steps.length; idx++) {
      const step = wf.steps[idx];
      setResults((prev) => prev.map((r, i) => i === idx ? { ...r, status: 'running' } : r));
      const t0 = Date.now();
      const stepInputs = step.input_from
        ? { ...effInputs, [step.input_from]: prevOutput ?? '' }
        : effInputs;
      const r = await runWorkflowStep(step, stepInputs, files);
      const dur = Date.now() - t0;
      if (r.ok) {
        prevOutput = r.output;
        setResults((prev) => prev.map((x, i) => i === idx ? { ...x, status: 'ok', output: r.output, durationMs: dur } : x));
      } else {
        setResults((prev) => prev.map((x, i) => i === idx ? { ...x, status: 'fail', error: r.error, durationMs: dur } : x));
        notify('error', `Step "${step.label}" falló`, r.error);
        break;
      }
    }
    setRunning(false);
    notify('success', 'Workflow terminado', wf.name);
    void notifyNative('Workflow', `${wf.name} terminado`);
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal wf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-header">
          <h2>{wf.emoji ?? '🔗'} {wf.name}</h2>
          <button className="secondary" onClick={onClose}>✕</button>
        </div>
        <p className="muted" style={{ fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>{wf.description}</p>

        <section style={{ marginTop: 14 }}>
          <h4>📥 Entradas</h4>
          <div className="wf-inputs">
            {(wf.inputs ?? []).map((i) => (
              <label key={i.id} className="wf-field">
                <span>{i.label}{i.required && <span style={{ color: '#ff8080' }}> *</span>}</span>
                {i.type === 'file' ? (
                  <input
                    type="file"
                    accept={i.accept}
                    onChange={(e) => setFiles((prev) => ({ ...prev, [i.id]: e.target.files?.[0] ?? prev[i.id] }))}
                  />
                ) : (
                  <input
                    type="text"
                    placeholder={i.placeholder}
                    value={inputs[i.id] ?? ''}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [i.id]: e.target.value }))}
                  />
                )}
              </label>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 14 }}>
          <h4>⚙️ Pasos</h4>
          <div className="wf-steps">
            {wf.steps.map((s, i) => {
              const r = results[i];
              const icon = r?.status === 'ok' ? '✅' : r?.status === 'fail' ? '❌' : r?.status === 'running' ? '🔄' : r?.status === 'skipped' ? '⏭' : '⏳';
              return (
                <div key={s.id} className={`wf-step ${r?.status ?? 'pending'}`}>
                  <div className="wf-step-head">
                    <span className="wf-step-icon">{icon}</span>
                    <strong>{s.label}</strong>
                    {s.type === 'stub' && <span className="pill">stub</span>}
                    {r?.durationMs !== undefined && <span className="muted" style={{fontSize:'0.74rem'}}>· {(r.durationMs / 1000).toFixed(2)}s</span>}
                  </div>
                  {r?.error && <pre className="wf-step-err">{r.error}</pre>}
                  {r?.output && (
                    <pre className="wf-step-out">{r.output.slice(0, 4000)}{r.output.length > 4000 && '\n…(truncado)'}</pre>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="onb-actions">
          <button className="secondary" onClick={onClose}>Cerrar</button>
          <button onClick={runAll} disabled={!canRun || running}>
            {running ? '⏳ Ejecutando…' : '▶ Ejecutar workflow'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Overview modal (Resumen + Estado + System stats + Studio Home) ─────────
function OverviewModal({
  open, onClose, summary, stats, tools, runningIds, message,
}: {
  open: boolean;
  onClose: () => void;
  summary: SystemSummary | null;
  stats: SystemStats | null;
  tools: ToolManifest[];
  runningIds: Set<string>;
  message: string;
}) {
  if (!open) return null;
  const installed = tools.filter((t) => t.installed).length;
  const cpuPct = stats ? Math.round(stats.cpu_usage) : 0;
  const memPct = stats?.mem_total_bytes ? Math.round((stats.mem_used_bytes / stats.mem_total_bytes) * 100) : 0;
  const diskUsed = stats ? stats.disk_total_bytes - stats.disk_free_bytes : 0;
  const diskPct = stats?.disk_total_bytes ? Math.round((diskUsed / stats.disk_total_bytes) * 100) : 0;
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" style={{ width: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="section-header">
          <h2>📋 Resumen del sistema</h2>
          <button className="secondary" onClick={onClose}>✕</button>
        </div>

        <section style={{ marginTop: 12 }}>
          <h4>App</h4>
          <dl className="kv-list">
            <div><dt>Versión</dt><dd>{summary?.app_name ?? 'ChofyAI Studio'} v{summary?.app_version ?? APP_VERSION}</dd></div>
            <div><dt>OS / Arch</dt><dd>{summary?.os ?? '—'} · {summary?.arch ?? ''}</dd></div>
            <div><dt>Settings</dt><dd style={{ fontFamily: 'ui-monospace', fontSize: '0.78rem' }}>{summary?.settings_file ?? '—'}</dd></div>
          </dl>
        </section>

        <section style={{ marginTop: 16 }}>
          <h4>💾 Studio Home</h4>
          <dl className="kv-list">
            <div><dt>Solicitado</dt><dd style={{ fontFamily: 'ui-monospace', fontSize: '0.78rem' }}>{summary?.studio_home ?? '—'}</dd></div>
            <div><dt>Efectivo</dt><dd style={{ fontFamily: 'ui-monospace', fontSize: '0.78rem' }}>
              {summary?.studio_home_effective ?? '—'}
              {summary?.using_fallback && <span className="pill" style={{ marginLeft: 6, background: 'rgba(255,165,0,0.18)', color: '#ffcd80', borderColor: 'rgba(255,165,0,0.3)' }}>fallback</span>}
            </dd></div>
          </dl>
        </section>

        <section style={{ marginTop: 16 }}>
          <h4>🛠 Tools</h4>
          <dl className="kv-list">
            <div><dt>Instaladas</dt><dd><strong>{installed}</strong> / {tools.length}</dd></div>
            <div><dt>En ejecución</dt><dd>{runningIds.size}</dd></div>
            <div><dt>Mensaje</dt><dd className="muted" style={{ fontSize: '0.82rem' }}>{message}</dd></div>
          </dl>
        </section>

        {stats && (
          <section style={{ marginTop: 16 }}>
            <h4>📊 Recursos del equipo</h4>
            <div className="overview-stats">
              <div className="overview-stat">
                <div className="overview-stat-row">
                  <span>CPU</span>
                  <span>{cpuPct}% · {stats.cpu_cores} núcleos · load {stats.load_avg_1m.toFixed(2)}</span>
                </div>
                <div className="overview-bar"><div className="overview-bar-fill" style={{ width: `${cpuPct}%` }} /></div>
              </div>
              <div className="overview-stat">
                <div className="overview-stat-row">
                  <span>RAM</span>
                  <span>{fmtBytes(stats.mem_used_bytes)} / {fmtBytes(stats.mem_total_bytes)} ({memPct}%)</span>
                </div>
                <div className="overview-bar"><div className="overview-bar-fill" style={{ width: `${memPct}%` }} /></div>
              </div>
              <div className="overview-stat">
                <div className="overview-stat-row">
                  <span>Disco</span>
                  <span>{fmtBytes(stats.disk_free_bytes)} libres ({100 - diskPct}%)</span>
                </div>
                <div className="overview-bar"><div className="overview-bar-fill" style={{ width: `${diskPct}%` }} /></div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Orphans modal ───────────────────────────────────────────────────────────
function OrphansModal({
  open, onClose, orphans, onResolved,
}: {
  open: boolean; onClose: () => void; orphans: OrphanPort[]; onResolved: () => void;
}) {
  if (!open) return null;
  const adopt = async (o: OrphanPort) => {
    if (!o.pid) return;
    const r = await tauriInvoke<ActionResult>('adopt_orphan', { toolId: o.tool_id, pid: o.pid });
    if (r) { notify('success', `${o.tool_name} adoptado`, `PID ${o.pid}`); onResolved(); }
  };
  const kill = async (o: OrphanPort) => {
    if (!o.pid) return;
    if (!confirm(`¿Enviar SIGTERM a ${o.command ?? 'proceso'} (PID ${o.pid}) en ${o.port}?`)) return;
    const r = await tauriInvoke<ActionResult>('kill_orphan', { pid: o.pid });
    if (r) { notify('info', 'SIGTERM enviado', `PID ${o.pid}`); onResolved(); }
  };
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" style={{ width: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="section-header">
          <h2>👻 Procesos huérfanos ({orphans.length})</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="secondary" onClick={onResolved}>↻ Re-escanear</button>
            <button className="secondary" onClick={onClose}>✕</button>
          </div>
        </div>
        <p className="muted" style={{ fontSize: '0.84rem' }}>
          Procesos escuchando en puertos de tools conocidas pero no registrados en la app —
          probablemente quedaron de una sesión previa o se lanzaron desde CLI.
        </p>
        {orphans.length === 0 ? (
          <p className="muted" style={{ marginTop: 14 }}>No hay procesos huérfanos detectados. ✅</p>
        ) : (
          <div className="orphan-list" style={{ marginTop: 12 }}>
            {orphans.map((o) => (
              <div key={`${o.tool_id}-${o.port}`} className="orphan-row">
                <div className="orphan-info">
                  <strong>{o.tool_name}</strong>
                  <span className="muted">:{o.port} · PID {o.pid} · {o.command ?? '?'}</span>
                </div>
                <button className="primary-soft" onClick={() => void adopt(o)}>👋 Adoptar</button>
                <button className="secondary danger-soft" onClick={() => void kill(o)}>🛑 Matar</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Doctor modal (ejecuta scripts/mac/doctor.sh) ────────────────────────────
function DoctorModal({ open, onClose, studioHome }: { open: boolean; onClose: () => void; studioHome: string }) {
  const [output, setOutput] = useState<string>('');
  const [running, setRunning] = useState(false);

  const runDoctor = async () => {
    setRunning(true);
    setOutput('Ejecutando doctor.sh…');
    const r = await tauriInvoke<string>('run_doctor', { studioHome }, { silent: true });
    setOutput(r ?? '(sin output o comando no disponible — revisa que run_doctor esté registrado)');
    setRunning(false);
  };

  useEffect(() => { if (open) void runDoctor(); }, [open]);

  if (!open) return null;
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" style={{ width: 700 }} onClick={(e) => e.stopPropagation()}>
        <div className="section-header">
          <h2>🩺 Doctor</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="secondary" disabled={running} onClick={runDoctor}>{running ? '⏳…' : '↻ Re-ejecutar'}</button>
            <button className="secondary" onClick={onClose}>✕</button>
          </div>
        </div>
        <p className="muted" style={{ fontSize: '0.84rem' }}>
          Ejecuta <code>scripts/mac/doctor.sh "{studioHome}"</code> y muestra el reporte.
        </p>
        <pre className="logs-pre" style={{ marginTop: 12 }}>{output}</pre>
      </div>
    </div>
  );
}

// ─── Workflow Builder (drag & drop) ──────────────────────────────────────────
type BuilderInput = { id: string; type: 'file' | 'text'; label: string; required?: boolean; default?: string; accept?: string; placeholder?: string };
type BuilderStep = {
  uid: string; // local-only para reordenar
  id: string;
  label: string;
  type: 'http' | 'stub';
  method?: 'GET' | 'POST';
  url?: string;
  body_kind?: 'multipart' | 'json';
  fields_text?: string;  // KEY: VAL por línea (más fácil que UI compleja)
  body?: string;
  note?: string;
  output_kind?: string;
  output_from?: string;
};

function emptyStep(): BuilderStep {
  return {
    uid: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    id: `step${Math.floor(Math.random() * 9999)}`,
    label: 'Nuevo paso',
    type: 'http',
    method: 'POST',
    url: 'http://127.0.0.1:8178/inference',
    body_kind: 'multipart',
    fields_text: 'file: {{inputs.audio}}\nresponse_format: json',
    output_kind: 'text',
    output_from: 'text',
  };
}

function buildYaml(meta: { id: string; name: string; emoji: string; category: string; description: string; requires_tools: string[] }, inputs: BuilderInput[], steps: BuilderStep[]): string {
  let out = '';
  out += `id: ${meta.id}\n`;
  out += `name: ${meta.name}\n`;
  out += `category: ${meta.category}\n`;
  if (meta.emoji) out += `emoji: "${meta.emoji}"\n`;
  out += `description: |\n`;
  for (const line of meta.description.split('\n')) out += `  ${line}\n`;
  if (meta.requires_tools.length > 0) {
    out += `requires_tools:\n`;
    for (const t of meta.requires_tools) out += `  - ${t}\n`;
  }
  if (inputs.length > 0) {
    out += `inputs:\n`;
    for (const i of inputs) {
      out += `  - id: ${i.id}\n`;
      out += `    type: ${i.type}\n`;
      out += `    label: ${JSON.stringify(i.label)}\n`;
      if (i.required) out += `    required: true\n`;
      if (i.default) out += `    default: ${JSON.stringify(i.default)}\n`;
      if (i.accept) out += `    accept: ${JSON.stringify(i.accept)}\n`;
      if (i.placeholder) out += `    placeholder: ${JSON.stringify(i.placeholder)}\n`;
    }
  }
  out += `steps:\n`;
  for (const s of steps) {
    out += `  - id: ${s.id}\n`;
    out += `    label: ${JSON.stringify(s.label)}\n`;
    out += `    type: ${s.type}\n`;
    if (s.type === 'http') {
      if (s.method) out += `    method: ${s.method}\n`;
      if (s.url) out += `    url: ${JSON.stringify(s.url)}\n`;
      if (s.body_kind) out += `    body_kind: ${s.body_kind}\n`;
      if (s.body_kind === 'multipart' && s.fields_text) {
        out += `    fields:\n`;
        for (const line of s.fields_text.split('\n')) {
          const [k, ...rest] = line.split(':');
          if (!k.trim()) continue;
          const v = rest.join(':').trim();
          out += `      ${k.trim()}: ${JSON.stringify(v)}\n`;
        }
      }
      if (s.body_kind === 'json' && s.body) {
        out += `    body: |\n`;
        for (const line of s.body.split('\n')) out += `      ${line}\n`;
      }
    } else if (s.type === 'stub' && s.note) {
      out += `    note: ${JSON.stringify(s.note)}\n`;
    }
    if (s.output_kind) {
      out += `    output:\n      kind: ${s.output_kind}\n`;
      if (s.output_from) out += `      from: ${s.output_from}\n`;
    }
  }
  return out;
}

function WorkflowBuilder({
  open, onClose, onSaved,
}: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [meta, setMeta] = useState({
    id: 'mi-workflow',
    name: 'Mi workflow',
    emoji: '🔗',
    category: 'asr',
    description: 'Descripción del workflow.',
    requires_tools: '' as string,
  });
  const [inputs, setInputs] = useState<BuilderInput[]>([
    { id: 'audio', type: 'file', label: 'Archivo de audio', required: true, accept: 'audio/*' },
  ]);
  const [steps, setSteps] = useState<BuilderStep[]>([emptyStep()]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showYaml, setShowYaml] = useState(false);

  if (!open) return null;

  const yaml = useMemo(() => buildYaml({
    ...meta,
    requires_tools: meta.requires_tools.split(',').map((s) => s.trim()).filter(Boolean),
  }, inputs, steps), [meta, inputs, steps]);

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    setSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    const r = await tauriInvoke<ActionResult>('save_workflow', { id: meta.id, yamlContent: yaml });
    setSaving(false);
    if (r?.ok) {
      notify('success', 'Workflow guardado', r.message);
      void notifyNative('Workflow', `Guardado workflows/${meta.id}.yaml`);
      onSaved();
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal builder-modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-header">
          <h2>🛠 Workflow Builder</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="secondary" onClick={() => setShowYaml((v) => !v)}>{showYaml ? 'Ocultar YAML' : 'Ver YAML'}</button>
            <button className="secondary" onClick={onClose}>✕</button>
          </div>
        </div>

        <section className="builder-grid">
          {/* Metadata */}
          <div className="builder-section">
            <h4>📝 Metadata</h4>
            <div className="builder-fields">
              <label>ID (sin espacios)<input value={meta.id} onChange={(e) => setMeta({ ...meta, id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })} /></label>
              <label>Nombre<input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} /></label>
              <label>Emoji<input value={meta.emoji} onChange={(e) => setMeta({ ...meta, emoji: e.target.value })} maxLength={4} /></label>
              <label>Categoría
                <select value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })}>
                  <option>asr</option><option>voice</option><option>image</option><option>video</option><option>music</option><option>chain</option><option>system</option>
                </select>
              </label>
              <label>Descripción<textarea rows={3} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></label>
              <label>Requiere tools (coma)<input value={meta.requires_tools} onChange={(e) => setMeta({ ...meta, requires_tools: e.target.value })} placeholder="whispercpp, qwen3-tts" /></label>
            </div>
          </div>

          {/* Inputs */}
          <div className="builder-section">
            <h4>📥 Inputs <button className="secondary" onClick={() => setInputs([...inputs, { id: `input${inputs.length + 1}`, type: 'text', label: 'Texto' }])}>+ añadir</button></h4>
            <div className="builder-list">
              {inputs.map((inp, i) => (
                <div key={i} className="builder-card">
                  <div className="builder-row">
                    <input value={inp.id} onChange={(e) => { const a = [...inputs]; a[i] = { ...inp, id: e.target.value.replace(/\W/g, '') }; setInputs(a); }} placeholder="id" />
                    <select value={inp.type} onChange={(e) => { const a = [...inputs]; a[i] = { ...inp, type: e.target.value as 'file' | 'text' }; setInputs(a); }}>
                      <option value="text">text</option><option value="file">file</option>
                    </select>
                    <input value={inp.label} onChange={(e) => { const a = [...inputs]; a[i] = { ...inp, label: e.target.value }; setInputs(a); }} placeholder="label" />
                    <label className="builder-checkbox"><input type="checkbox" checked={Boolean(inp.required)} onChange={(e) => { const a = [...inputs]; a[i] = { ...inp, required: e.target.checked }; setInputs(a); }} />req</label>
                    <button className="secondary danger-soft" onClick={() => setInputs(inputs.filter((_, j) => j !== i))}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Steps con drag-drop */}
          <div className="builder-section">
            <h4>⚙️ Steps <span className="muted" style={{ fontSize: '0.74rem' }}>(arrastra ↕ para reordenar)</span> <button className="secondary" onClick={() => setSteps([...steps, emptyStep()])}>+ añadir</button></h4>
            <div className="builder-list">
              {steps.map((s, i) => (
                <div
                  key={s.uid}
                  className={`builder-card builder-step ${dragIdx === i ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); if (dragIdx !== null) reorder(dragIdx, i); setDragIdx(null); }}
                  onDragEnd={() => setDragIdx(null)}
                >
                  <div className="builder-row">
                    <span className="builder-grip" title="Arrastra">⋮⋮</span>
                    <strong>#{i + 1}</strong>
                    <input value={s.id} onChange={(e) => { const a = [...steps]; a[i] = { ...s, id: e.target.value.replace(/\W/g, '') }; setSteps(a); }} placeholder="step id" />
                    <input value={s.label} onChange={(e) => { const a = [...steps]; a[i] = { ...s, label: e.target.value }; setSteps(a); }} placeholder="Etiqueta visible" style={{ flex: 1 }} />
                    <select value={s.type} onChange={(e) => { const a = [...steps]; a[i] = { ...s, type: e.target.value as 'http' | 'stub' }; setSteps(a); }}>
                      <option value="http">http</option><option value="stub">stub</option>
                    </select>
                    <button className="secondary danger-soft" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>🗑</button>
                  </div>
                  {s.type === 'http' && (
                    <div className="builder-row builder-step-config">
                      <select value={s.method ?? 'POST'} onChange={(e) => { const a = [...steps]; a[i] = { ...s, method: e.target.value as 'GET' | 'POST' }; setSteps(a); }}>
                        <option>POST</option><option>GET</option>
                      </select>
                      <input value={s.url ?? ''} onChange={(e) => { const a = [...steps]; a[i] = { ...s, url: e.target.value }; setSteps(a); }} placeholder="http://127.0.0.1:8178/inference" style={{ flex: 1 }} />
                      <select value={s.body_kind ?? 'multipart'} onChange={(e) => { const a = [...steps]; a[i] = { ...s, body_kind: e.target.value as 'multipart' | 'json' }; setSteps(a); }}>
                        <option value="multipart">multipart</option><option value="json">json</option>
                      </select>
                    </div>
                  )}
                  {s.type === 'http' && s.body_kind === 'multipart' && (
                    <textarea rows={3} value={s.fields_text ?? ''} onChange={(e) => { const a = [...steps]; a[i] = { ...s, fields_text: e.target.value }; setSteps(a); }} placeholder="key: valor (uno por línea)" />
                  )}
                  {s.type === 'http' && s.body_kind === 'json' && (
                    <textarea rows={4} value={s.body ?? ''} onChange={(e) => { const a = [...steps]; a[i] = { ...s, body: e.target.value }; setSteps(a); }} placeholder='{"prompt": "{{inputs.prompt}}"}' />
                  )}
                  {s.type === 'stub' && (
                    <textarea rows={2} value={s.note ?? ''} onChange={(e) => { const a = [...steps]; a[i] = { ...s, note: e.target.value }; setSteps(a); }} placeholder="Nota — placeholder" />
                  )}
                  <div className="builder-row">
                    <span className="muted" style={{ fontSize: '0.72rem' }}>output</span>
                    <select value={s.output_kind ?? 'text'} onChange={(e) => { const a = [...steps]; a[i] = { ...s, output_kind: e.target.value }; setSteps(a); }}>
                      <option>text</option><option>json</option><option>audio_url</option>
                    </select>
                    <input value={s.output_from ?? ''} onChange={(e) => { const a = [...steps]; a[i] = { ...s, output_from: e.target.value }; setSteps(a); }} placeholder="from (key del JSON, opcional)" />
                  </div>
                </div>
              ))}
              {steps.length === 0 && <p className="muted" style={{ fontSize: '0.84rem' }}>Sin steps. Añade al menos uno.</p>}
            </div>
          </div>
        </section>

        {showYaml && (
          <pre className="builder-yaml">{yaml}</pre>
        )}

        <div className="onb-actions">
          <button className="secondary" onClick={onClose}>Cancelar</button>
          <button onClick={save} disabled={saving || !meta.id || steps.length === 0}>
            {saving ? '⏳…' : `💾 Guardar workflows/${meta.id}.yaml`}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkflowsPanel({
  open, onClose, onRun, onNew,
}: {
  open: boolean;
  onClose: () => void;
  onRun: (wf: WorkflowDef) => void;
  onNew: () => void;
}) {
  const [list, setList] = useState<WorkflowDef[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const r = await tauriInvoke<WorkflowDef[]>('list_workflows');
    setList(r ?? []);
    setLoading(false);
  };

  useEffect(() => { if (open) void reload(); }, [open]);

  if (!open) return null;

  const onDelete = async (id: string) => {
    if (!confirm(`¿Borrar workflows/${id}.yaml?`)) return;
    const r = await tauriInvoke<ActionResult>('delete_workflow', { id });
    if (r?.ok) { notify('success', 'Workflow borrado', id); void reload(); }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal wf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-header">
          <h2>🔗 Workflows</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { onClose(); onNew(); }}>+ Nuevo workflow</button>
            <button className="secondary" onClick={onClose}>✕</button>
          </div>
        </div>
        <p className="muted" style={{ fontSize: '0.84rem' }}>
          Recetas declarativas que orquestan llamadas HTTP a tus tools locales. Definidas en <code>workflows/*.yaml</code>.
        </p>
        {loading && <p className="muted">Cargando…</p>}
        {!loading && list.length === 0 && (
          <p className="muted">Sin workflows. Crea uno en <code>workflows/&lt;id&gt;.yaml</code>.</p>
        )}
        <div className="wf-grid">
          {list.map((w) => (
            <div key={w.id} className="wf-card">
              <div className="wf-card-head">
                <span style={{ fontSize: '1.6rem' }}>{w.emoji ?? '🔗'}</span>
                <strong>{w.name}</strong>
              </div>
              <p className="muted" style={{ fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>{w.description.split('\n')[0]}</p>
              <div className="wf-card-meta">
                <span>{w.category}</span>
                <span>·</span>
                <span>{w.steps?.length ?? 0} step(s)</span>
                {w.requires_tools && w.requires_tools.length > 0 && <>
                  <span>·</span>
                  <span>requiere: {w.requires_tools.join(', ')}</span>
                </>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                <button onClick={() => { onClose(); onRun(w); }} style={{ flex: 1 }}>▶ Ejecutar</button>
                <button className="secondary danger-soft" onClick={() => void onDelete(w.id)} title="Borrar workflow">🗑</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Marketplace ─────────────────────────────────────────────────────────────
const CATEGORY_EMOJI: Record<string, string> = {
  voice: '🎤', asr: '🎙', video: '🎬', image: '🖼', music: '🎵', system: '⚙️',
};

function MarketplacePanel({
  open, onClose, alreadyInstalledIds, onImported,
}: {
  open: boolean;
  onClose: () => void;
  alreadyInstalledIds: Set<string>;
  onImported: () => void;
}) {
  const [entries, setEntries] = useState<MarketplaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void (async () => {
      const r = await tauriInvoke<MarketplaceEntry[]>('list_marketplace_tools');
      setEntries(r ?? []);
      setLoading(false);
    })();
  }, [open]);

  if (!open) return null;

  const filtered = entries.filter((e) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (e.name + ' ' + e.short_description + ' ' + e.category + ' ' + e.runtime + ' ' + (e.id ?? ''))
      .toLowerCase().includes(q);
  });

  const onImport = async (entry: MarketplaceEntry) => {
    if (alreadyInstalledIds.has(entry.id)) {
      notify('warn', 'Ya está en tu catálogo', `apps/${entry.id}.yaml ya existe`);
      return;
    }
    if (!confirm(`Importar manifest de "${entry.name}" a apps/${entry.id}.yaml?\n\nEsto añade la tool a tu catálogo. La instalación real (clone + venv) la harás después.`)) return;
    setBusy(entry.id);
    const r = await tauriInvoke<ActionResult>('import_marketplace_tool', { id: entry.id });
    setBusy(null);
    if (r?.ok) {
      notify('success', `${entry.name} importado`, r.message);
      void notifyNative('Marketplace', `${entry.name} añadido al catálogo`);
      onImported();
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal market-modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-header">
          <h2>🛒 Marketplace de tools</h2>
          <button className="secondary" onClick={onClose}>✕</button>
        </div>
        <p className="muted" style={{ fontSize: '0.84rem' }}>
          Catálogo curado de herramientas adicionales. Importa el manifest y luego configura el `install_script` y `run.command` según el tool.
        </p>
        <input
          className="onb-input"
          placeholder="🔎 Buscar por nombre, categoría o palabra clave…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginTop: 10 }}
        />
        {loading && <p className="muted" style={{ marginTop: 16 }}>Cargando catálogo…</p>}
        {!loading && (
          <div className="market-grid">
            {filtered.length === 0 && (
              <p className="muted" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 30 }}>
                Sin resultados para "{query}".
              </p>
            )}
            {filtered.map((e) => {
              const installed = alreadyInstalledIds.has(e.id);
              return (
                <div key={e.id} className={`market-card ${installed ? 'installed' : ''}`}>
                  <div className="market-head">
                    <span className="market-emoji">{CATEGORY_EMOJI[e.category] ?? '🧩'}</span>
                    <strong>{e.name}</strong>
                    {installed && <span className="pill pill-green">✓ Instalado</span>}
                  </div>
                  <p className="market-desc muted">{e.short_description}</p>
                  <div className="market-meta">
                    <span>{e.category}</span>
                    <span>·</span>
                    <span>{e.runtime}</span>
                    {e.estimated_size_gb && <><span>·</span><span>~{e.estimated_size_gb} GB</span></>}
                    {e.default_port && <><span>·</span><span>:{e.default_port}</span></>}
                  </div>
                  {e.requires && e.requires.length > 0 && (
                    <div className="market-requires">
                      {e.requires.map((r) => <span key={r} className="market-req">{r}</span>)}
                    </div>
                  )}
                  <div className="market-actions">
                    <button
                      onClick={() => void onImport(e)}
                      disabled={installed || busy === e.id}
                      className={installed ? 'secondary' : ''}
                    >
                      {busy === e.id ? '⏳…' : installed ? 'Ya importado' : '+ Importar manifest'}
                    </button>
                    {e.homepage && (
                      <a href={e.homepage} target="_blank" rel="noreferrer" className="market-link">↗ Web</a>
                    )}
                    {e.repo && (
                      <a href={e.repo} target="_blank" rel="noreferrer" className="market-link">↗ Repo</a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="muted" style={{ fontSize: '0.74rem', marginTop: 14 }}>
          Catálogo: <code>marketplace/registry.yaml</code> · {entries.length} tool(s) disponibles
        </p>
      </div>
    </div>
  );
}

// ─── Help Panel (⌘/) ─────────────────────────────────────────────────────────
function HelpPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const groups = SHORTCUTS.reduce<Record<string, Shortcut[]>>((acc, s) => {
    (acc[s.group] = acc[s.group] || []).push(s); return acc;
  }, {});
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-header">
          <h2>⌨️ Atajos de teclado</h2>
          <button className="secondary" onClick={onClose}>✕</button>
        </div>
        <p className="muted" style={{ fontSize: '0.86rem' }}>
          Pulsa <kbd>⌘K</kbd> para acceder al catálogo completo de comandos disponibles.
        </p>
        {Object.entries(groups).map(([g, items]) => (
          <section key={g} style={{ marginTop: 14 }}>
            <h4 style={{ marginBottom: 6 }}>{g}</h4>
            <div className="shortcut-list">
              {items.map((s) => (
                <div key={s.keys} className="shortcut-row">
                  <kbd>{s.keys}</kbd>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// ─── PreInstallCheck (modal de confirmación con info de espacio) ─────────────
function PreInstallCheck({
  tool, freeBytes, onConfirm, onCancel,
}: {
  tool: ToolManifest | null;
  freeBytes: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!tool) return null;
  const ESTIMATES: Record<string, number> = {
    'whispercpp': 250 * 1024 ** 2,
    'comfyui': 2 * 1024 ** 3,
    'aceforge': 1.5 * 1024 ** 3,
    'facefusion': 1.5 * 1024 ** 3,
    'qwen3-tts': 8 * 1024 ** 3,
  };
  const est = ESTIMATES[tool.id] ?? 1 * 1024 ** 3;
  const free = freeBytes ?? 0;
  const enough = free > est * 1.2;
  return (
    <div className="settings-overlay" onClick={onCancel}>
      <div className="settings-modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="section-header">
          <h2>📦 Instalar {tool.name}</h2>
          <button className="secondary" onClick={onCancel}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <p className="muted" style={{ margin: 0 }}>{tool.description}</p>
          <div className="precheck-grid">
            <div><dt>Estimado</dt><dd><strong>{fmtBytes(est)}</strong></dd></div>
            <div><dt>Libre en disco</dt><dd>{free > 0 ? <strong>{fmtBytes(free)}</strong> : '—'}</dd></div>
            <div><dt>Destino</dt><dd style={{fontSize:'0.74rem',fontFamily:'ui-monospace'}}>{tool.install_dir}</dd></div>
          </div>
          {!enough && free > 0 && (
            <div className="onb-warn">⚠️ Espacio insuficiente. Necesitas al menos {fmtBytes(est * 1.2)} libres (estimado × 1.2 buffer).</div>
          )}
        </div>
        <div className="onb-actions">
          <button className="secondary" onClick={onCancel}>Cancelar</button>
          <button onClick={onConfirm} disabled={!enough && free > 0}>Instalar ahora</button>
        </div>
      </div>
    </div>
  );
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
    // Persistir en crash log para post-mortem
    const stack = (error.stack ?? '') + '\n--- componentStack ---\n' + (info.componentStack ?? '');
    void tauriInvoke('append_crash_log', {
      message: `[UI] ${error.message}\n${stack.slice(0, 4000)}`,
    }, { silent: true });
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

// ─── Orphan banner ───────────────────────────────────────────────────────────
type OrphanPort = { tool_id: string; tool_name: string; port: number; pid?: number; command?: string };

function OrphanBanner({ orphans, onResolved }: { orphans: OrphanPort[]; onResolved: () => void }) {
  if (orphans.length === 0) return null;
  const adopt = async (o: OrphanPort) => {
    if (!o.pid) return;
    const r = await tauriInvoke<ActionResult>('adopt_orphan', { toolId: o.tool_id, pid: o.pid });
    if (r) { notify('success', `${o.tool_name} adoptado`, `PID ${o.pid}`); onResolved(); }
  };
  const kill = async (o: OrphanPort) => {
    if (!o.pid) return;
    if (!confirm(`¿Enviar SIGTERM a ${o.command ?? 'proceso'} (PID ${o.pid}) en ${o.port}?`)) return;
    const r = await tauriInvoke<ActionResult>('kill_orphan', { pid: o.pid });
    if (r) { notify('info', 'SIGTERM enviado', `PID ${o.pid}`); onResolved(); }
  };
  return (
    <section className="card orphan-card">
      <div className="section-header">
        <h3>👻 Procesos huérfanos detectados ({orphans.length})</h3>
        <button className="secondary" onClick={onResolved}>Re-escanear</button>
      </div>
      <p className="muted" style={{ fontSize: '0.84rem' }}>
        Estos procesos están escuchando en puertos de tools conocidas pero la app no los registró —
        probablemente quedaron de una sesión previa o se lanzaron desde CLI.
      </p>
      <div className="orphan-list">
        {orphans.map((o) => (
          <div key={`${o.tool_id}-${o.port}`} className="orphan-row">
            <div className="orphan-info">
              <strong>{o.tool_name}</strong>
              <span className="muted">:{o.port} · PID {o.pid} · {o.command ?? '?'}</span>
            </div>
            <button className="primary-soft" onClick={() => void adopt(o)}>👋 Adoptar</button>
            <button className="secondary danger-soft" onClick={() => void kill(o)}>🛑 Matar</button>
          </div>
        ))}
      </div>
    </section>
  );
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
  const t = useT();
  const [lang, setLangState] = useState<Lang>(() => getLang());
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
  const [showHelp, setShowHelp] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [showWorkflows, setShowWorkflows] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [runningWorkflow, setRunningWorkflow] = useState<WorkflowDef | null>(null);
  const [showOverview, setShowOverview] = useState(false);
  const [showOrphans, setShowOrphans] = useState(false);
  const [showDoctor, setShowDoctor] = useState(false);
  const [viewingModelsFor, setViewingModelsFor] = useState<string | null>(null);
  const [lastTouchedToolId, setLastTouchedToolId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem(THEME_KEY) as Theme) || 'dark'; } catch { return 'dark'; }
  });
  const [preInstallTool, setPreInstallTool] = useState<ToolManifest | null>(null);
  const [orphans, setOrphans] = useState<OrphanPort[]>([]);

  const reloadOrphans = async () => {
    const r = await tauriInvoke<OrphanPort[]>('list_orphan_ports', undefined, { silent: true });
    setOrphans(r ?? []);
  };

  // Escanea orphans al cargar y cada 60s
  useEffect(() => {
    if (!inTauri) return;
    void reloadOrphans();
    const id = setInterval(() => { void reloadOrphans(); }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Aplica el tema al DOM y persiste
  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  // Listener para cambios de "system" si aplica
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const cb = () => applyTheme('system');
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  }, [theme]);

  // Atajos globales
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) {
        if (e.key === 'Escape') {
          setShowCmdK(false); setShowSettings(false); setShowHelp(false);
          setViewingTool(null); setViewingLogsFor(null); setViewingModelsFor(null);
          setPreInstallTool(null);
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'k') { e.preventDefault(); setShowCmdK((v) => !v); }
      else if (k === ',') { e.preventDefault(); setShowSettings((v) => !v); }
      else if (k === '/') { e.preventDefault(); setShowHelp((v) => !v); }
      else if (k === 'r') { e.preventDefault(); void reloadTools(); void reloadStats(); notify('info', 'Refrescado'); }
      else if (k === 'b') { e.preventDefault(); setTheme((t) => t === 'dark' ? 'light' : 'dark'); }
      else if (k === 'l') {
        e.preventDefault();
        if (lastTouchedToolId) setViewingLogsFor((v) => v === lastTouchedToolId ? null : lastTouchedToolId);
      }
      else if (k === 'm') { e.preventDefault(); setShowMarket((v) => !v); }
      else if (k === 'w') { e.preventDefault(); setShowWorkflows((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lastTouchedToolId]);

  // Acciones para la paleta
  const cmdActions = useMemo<CmdAction[]>(() => {
    const list: CmdAction[] = [
      { id: 'open-settings', label: '⚙️ Abrir configuración', group: 'App', run: () => setShowSettings(true) },
      { id: 'open-tour', label: '👋 Re-abrir tour', group: 'App', run: () => setShowOnboarding(true) },
      { id: 'open-market', label: '🛒 Abrir Marketplace', group: 'App', run: () => setShowMarket(true) },
      { id: 'open-workflows', label: '🔗 Abrir Workflows', group: 'App', run: () => setShowWorkflows(true) },
      { id: 'open-help', label: '⌨️ Mostrar atajos', group: 'App', run: () => setShowHelp(true) },
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

  const requestInstall = (tool: ToolManifest) => {
    setLastTouchedToolId(tool.id);
    setPreInstallTool(tool);
  };

  const handleInstall = async (tool: ToolManifest) => {
    setBusyToolId(tool.id);
    setMessage(`Instalando ${tool.name}...`);
    setLastTouchedToolId(tool.id);
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
    setLastTouchedToolId(tool.id);
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
    setLastTouchedToolId(tool.id);
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
      <HelpPanel open={showHelp} onClose={() => setShowHelp(false)} />
      <MarketplacePanel
        open={showMarket}
        onClose={() => setShowMarket(false)}
        alreadyInstalledIds={new Set(tools.map((t) => t.id))}
        onImported={() => { void reloadTools(); }}
      />
      <WorkflowsPanel
        open={showWorkflows}
        onClose={() => setShowWorkflows(false)}
        onRun={(wf) => setRunningWorkflow(wf)}
        onNew={() => setShowBuilder(true)}
      />
      <WorkflowBuilder
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        onSaved={() => { setShowBuilder(false); setShowWorkflows(true); }}
      />
      {runningWorkflow && (
        <WorkflowRunner wf={runningWorkflow} onClose={() => setRunningWorkflow(null)} />
      )}
      <OverviewModal
        open={showOverview}
        onClose={() => setShowOverview(false)}
        summary={summary}
        stats={stats}
        tools={tools}
        runningIds={runningIds}
        message={message}
      />
      <OrphansModal
        open={showOrphans}
        onClose={() => setShowOrphans(false)}
        orphans={orphans}
        onResolved={() => { void reloadOrphans(); void reloadTools(); }}
      />
      <DoctorModal
        open={showDoctor}
        onClose={() => setShowDoctor(false)}
        studioHome={summary?.studio_home_effective ?? ''}
      />
      <PreInstallCheck
        tool={preInstallTool}
        freeBytes={stats?.disk_free_bytes ?? null}
        onCancel={() => setPreInstallTool(null)}
        onConfirm={() => {
          const t = preInstallTool;
          setPreInstallTool(null);
          if (t) void handleInstall(t);
        }}
      />
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
              <p>{t('sidebar.lead')}</p>
            </div>
          </div>
          <nav>
            <div className="nav-group">
              <span className="nav-group-label">Workspace</span>
              <button className="nav-item active" title="Vista principal con tarjetas de tools">
                <span className="nav-icon">🏠</span>
                <span className="nav-label">{t('sidebar.dashboard')}</span>
              </button>
              <button className="nav-item" onClick={() => setShowOverview(true)} title="Resumen del sistema, recursos y studio_home">
                <span className="nav-icon">📋</span>
                <span className="nav-label">Resumen</span>
              </button>
              <button className="nav-item" onClick={() => setShowOrphans(true)} title="Procesos huérfanos detectados">
                <span className="nav-icon">👻</span>
                <span className="nav-label">Huérfanos</span>
                {orphans.length > 0 && <span className="nav-badge">{orphans.length}</span>}
              </button>
              <button className="nav-item" onClick={() => setShowDoctor(true)} title="Ejecuta scripts/mac/doctor.sh">
                <span className="nav-icon">🩺</span>
                <span className="nav-label">{t('sidebar.doctor')}</span>
              </button>
            </div>

            <div className="nav-group">
              <span className="nav-group-label">Tools</span>
              <button className="nav-item" onClick={() => setShowMarket(true)} title="Catálogo curado de tools comunitarias">
                <span className="nav-icon">🛒</span>
                <span className="nav-label">{t('sidebar.marketplace')}</span>
                <kbd className="nav-kbd">⌘M</kbd>
              </button>
              <button className="nav-item" onClick={() => setShowWorkflows(true)} title="Pipelines y chains entre tools">
                <span className="nav-icon">🔗</span>
                <span className="nav-label">{t('sidebar.workflows')}</span>
                <kbd className="nav-kbd">⌘W</kbd>
              </button>
            </div>

            <div className="nav-group">
              <span className="nav-group-label">Sistema</span>
              <button className="nav-item" onClick={() => setShowSettings(true)} title="Editar studio_home, volúmenes y overrides">
                <span className="nav-icon">⚙️</span>
                <span className="nav-label">{t('sidebar.settings')}</span>
                <kbd className="nav-kbd">⌘,</kbd>
              </button>
              <button className="nav-item" onClick={() => setShowCmdK(true)} title="Paleta de comandos">
                <span className="nav-icon">🔎</span>
                <span className="nav-label">{t('sidebar.commands')}</span>
                <kbd className="nav-kbd">⌘K</kbd>
              </button>
              <button className="nav-item" onClick={() => setShowHelp(true)} title="Atajos de teclado">
                <span className="nav-icon">⌨️</span>
                <span className="nav-label">{t('sidebar.shortcuts')}</span>
                <kbd className="nav-kbd">⌘/</kbd>
              </button>
              <button className="nav-item" onClick={() => setShowOnboarding(true)} title="Re-abrir onboarding">
                <span className="nav-icon">👋</span>
                <span className="nav-label">{t('sidebar.tour')}</span>
              </button>
            </div>

            <div className="nav-group nav-group-bottom">
              <button className="nav-item" onClick={() => setTheme((t) => t === 'dark' ? 'light' : t === 'light' ? 'system' : 'dark')} title="Toggle tema (⌘B)">
                <span className="nav-icon">{theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥'}</span>
                <span className="nav-label">{t('sidebar.theme')}</span>
                <span className="nav-value">{theme}</span>
              </button>
              <button
                className="nav-item"
                onClick={() => { const next: Lang = lang === 'es' ? 'en' : 'es'; setLang(next); setLangState(next); }}
                title="Toggle language ES/EN"
              >
                <span className="nav-icon">🌐</span>
                <span className="nav-label">{t('sidebar.lang')}</span>
                <span className="nav-value">{lang.toUpperCase()}</span>
              </button>
            </div>
          </nav>
          {queue.length > 0 && (
            <button className="nav-item queue-trigger" onClick={() => setQueueVisible(!queueVisible)}>
              {isQueueRunning ? '⏳ Cola activa' : `📋 Cola (${queue.length})`}
            </button>
          )}
        </aside>

        <section className="content">
          {/* Top bar: chips de acceso rápido + stats colapsado */}
          <div className="topbar">
            <div className="topbar-stats">
              <button className="topbar-chip" onClick={() => setShowOverview(true)}>
                <span className="topbar-chip-label">Tools</span>
                <span className="topbar-chip-value">{installedCount}/{tools.length}</span>
              </button>
              <button className="topbar-chip" onClick={() => setShowOverview(true)}>
                <span className="topbar-chip-label">Activas</span>
                <span className="topbar-chip-value">{runningIds.size}</span>
              </button>
              {orphans.length > 0 && (
                <button className="topbar-chip topbar-chip-warn" onClick={() => setShowOrphans(true)}>
                  <span>👻 {orphans.length} huérfanos</span>
                </button>
              )}
              {summary?.using_fallback && (
                <button className="topbar-chip topbar-chip-warn" onClick={() => setShowOverview(true)}>
                  <span>⚠ Fallback</span>
                </button>
              )}
            </div>
            <div className="topbar-actions">
              <button className="secondary" onClick={() => setShowCmdK(true)} title="⌘K">🔎 Buscar</button>
              <button className="secondary" onClick={() => setShowMarket(true)}>🛒 Marketplace</button>
              <button className="secondary" onClick={() => setShowWorkflows(true)}>🔗 Workflows</button>
            </div>
          </div>

          {/* Cola */}
          {queueVisible && queue.length > 0 && (
            <section className="card">
              <div className="section-header">
                <h3>{t('section.queue')}</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={runQueue} disabled={isQueueRunning || queue.every((q) => q.status !== 'pending')}>
                    {isQueueRunning ? t('btn.installing') : t('btn.start_queue')}
                  </button>
                  <button className="secondary" onClick={clearQueue} disabled={isQueueRunning}>{t('btn.clear')}</button>
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
          {tools.length > 0 && tools.every((x) => !x.installed) && (
            <section className="card empty-state-card">
              <div className="empty-content">
                <span className="empty-emoji">🚀</span>
                <h3>{t('empty.title')}</h3>
                <p className="muted">{t('empty.body')}</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {(() => {
                    const wsp = tools.find((x) => x.id === 'whispercpp');
                    return wsp ? (
                      <button onClick={() => handleInstall(wsp)} disabled={busyToolId === 'whispercpp'}>
                        {t('empty.install_whisper')}
                      </button>
                    ) : null;
                  })()}
                  <button className="secondary" onClick={addAllPendingToQueue} disabled={isQueueRunning}>
                    {t('empty.queue_all')}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Sección principal: Herramientas (grid) ó Vista del tool (iframe en lugar del grid) */}
          {viewingTool ? (() => {
            const tool = tools.find((x) => x.id === viewingTool);
            if (!tool || !tool.default_port) { setViewingTool(null); return null; }
            const url = `http://127.0.0.1:${tool.default_port}/`;
            return (
              <section className="card workspace-card">
                <div className="workspace-header">
                  <button className="workspace-back" onClick={() => setViewingTool(null)} title="Volver a Herramientas">
                    ← {t('section.tools')}
                  </button>
                  <span className="workspace-sep">/</span>
                  <span className="workspace-icon">{tool.icon || CATEGORY_EMOJI[tool.category] || '🧩'}</span>
                  <h3 className="workspace-title">{tool.name}</h3>
                  <span className="workspace-url">{url}</span>
                  <div className="workspace-actions">
                    <button className="secondary" onClick={() => handleRestart(tool)} title="Reiniciar el servicio">🔄 {t('btn.restart')}</button>
                    <button className="secondary" onClick={() => {
                      const ifr = document.getElementById('embed-iframe') as HTMLIFrameElement | null;
                      if (ifr) ifr.src = ifr.src;
                    }} title="Recargar el iframe">↻ Reload UI</button>
                    <button className="secondary" onClick={() => window.open(url, '_blank')} title="Abrir en navegador">↗</button>
                    <button className="secondary" onClick={() => setViewingTool(null)} title="Cerrar y volver">✕</button>
                  </div>
                </div>
                <div className="workspace-body">
                  <iframe
                    id="embed-iframe"
                    title={`${tool.name} embed`}
                    src={url}
                    className="workspace-iframe"
                  />
                </div>
              </section>
            );
          })() : (
          <section className="card">
            <div className="section-header">
              <h3>{t('section.tools')}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="secondary"
                  disabled={isRefreshing}
                  onClick={async () => {
                    setIsRefreshing(true);
                    await Promise.all([reloadTools(), reloadSummary(), reloadStats()]);
                    for (const x of tools) {
                      if (x.default_port) {
                        const r = await tauriInvoke<HealthResult>('health_check_tool', { toolId: x.id });
                        if (r) setHealth((prev) => ({ ...prev, [x.id]: r }));
                        if (r?.running || r?.port_open) setRunningIds((prev) => new Set(prev).add(x.id));
                      }
                    }
                    setIsRefreshing(false);
                  }}
                >
                  {isRefreshing ? '⏳ Refrescando…' : `🔄 ${t('btn.refresh_state')}`}
                </button>
                <button className="secondary" onClick={addAllPendingToQueue} disabled={isQueueRunning}>
                  {t('btn.add_pending_to_queue')}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="tool-icon">{tool.icon || CATEGORY_EMOJI[tool.category] || '🧩'}</span>
                        <h4 style={{ margin: 0 }}>{tool.name}</h4>
                        <HealthDot health={toolHealth} starting={Boolean(startingTools[tool.id])} />
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {tool.recommended && <span className="pill">{t('state.recommended')}</span>}
                        {isRunning && <span className="pill pill-green">{t('state.active')}</span>}
                        {tool.relocated && <span className="pill" title="Tiene override de ubicación">{t('state.relocated')}</span>}
                      </div>
                    </div>
                    <p className="muted">{CATEGORY_LABEL[tool.category]} · {tool.runtime}</p>
                    <p>{tool.description}</p>

                    <dl className="tool-meta">
                      <div><dt>{t('tool.state')}</dt><dd>{tool.installed ? t('state.installed') : t('state.pending')}</dd></div>
                      {toolHealth && (
                        <div><dt>{t('tool.health')}</dt><dd>{toolHealth.port_open ? t('state.port_open') : t('state.port_closed')}{toolHealth.pid ? ` · PID ${toolHealth.pid}` : ''}</dd></div>
                      )}
                      <div><dt>{t('tool.path')}</dt><dd style={{fontFamily:'monospace',fontSize:'0.82rem'}}>{tool.install_dir}</dd></div>
                      {tool.default_port && <div><dt>{t('tool.port')}</dt><dd>{tool.default_port}</dd></div>}
                    </dl>

                    <div className="tool-actions">
                      {!tool.installed && (
                        <button disabled={isBusy || !canInstall} onClick={() => requestInstall(tool)}>
                          {isBusy ? '⏳' : `📦 ${t('btn.install')}`}
                        </button>
                      )}
                      {tool.installed && !isRunning && (
                        <button disabled={isBusy} onClick={() => handleStart(tool)}>
                          {isBusy ? '⏳' : `▶ ${t('btn.start')}`}
                        </button>
                      )}
                      {isRunning && (
                        <>
                          <button className="secondary" disabled={isBusy} onClick={() => handleStop(tool)}>⏹ {t('btn.stop')}</button>
                          <button className="secondary" disabled={isBusy} onClick={() => handleRestart(tool)}>🔄 {t('btn.restart')}</button>
                        </>
                      )}
                      {tool.installed && canInstall && (
                        <button className="secondary" disabled={isBusy} onClick={() => handleUpdate(tool)}>⬆ {t('btn.update')}</button>
                      )}
                      {!tool.installed && canInstall && (
                        <button className="secondary" disabled={isQueueRunning || queue.some((q) => q.toolId === tool.id)} onClick={() => addToQueue(tool)}>
                          {t('btn.add_to_queue')}
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
          )}
        </section>
      </main>

      <StatusBar stats={stats} summary={summary} />
    </AppErrorBoundary>
  );
}
