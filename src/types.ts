/**
 * types.ts — contratos de datos entre el frontend y el backend Rust.
 *
 * La mayoría de estos tipos son el espejo TypeScript de una `struct` de
 * `src-tauri/src/models.rs` o de `src-tauri/src/system.rs`. **No hay generación
 * automática**: si cambias un campo en Rust tienes que cambiarlo aquí a mano, y
 * si no lo haces, el compilador no se entera y el campo llega como `undefined`.
 *
 * Los tipos que NO tienen contraparte en Rust son los del estado propio de la
 * interfaz: `QueueItem`, `Toast`, `WorkflowDef` y sus auxiliares.
 *
 * Advertencia sobre `ToolManifest`: `category` y `runtime` son uniones cerradas
 * aquí pero cadenas libres en Rust. Un manifiesto con una categoría inventada
 * pasa el backend sin problema; sólo lo detiene el validador de manifiestos de
 * `.github/workflows/ci.yml`.
 *
 * Documentación relacionada:
 * `docs/system-documentation/05-technical-reference.md`, sección 2.
 */

export type ToolManifest = {
  file_name: string;
  id: string;
  name: string;
  icon?: string | null;
  category: 'voice' | 'asr' | 'video' | 'image' | 'music' | 'system';
  runtime: 'python' | 'binary' | 'node' | 'mlx' | 'mixed';
  default_port?: number;
  description: string;
  recommended: boolean;
  install_dir: string;
  install_script?: string;
  run_command?: string;
  installed: boolean;
  installed_checks: string[];
  missing_checks: string[];
  relocated?: boolean;
};

export type SystemSummary = {
  app_name: string;
  app_version: string;
  os: string;
  arch: string;
  studio_home: string;
  studio_home_effective: string;
  using_fallback: boolean;
  settings_file: string;
  platform_key?: string;
  platform_support?: 'validated' | 'experimental' | 'todo' | 'unsupported' | string;
};

export type AppSettings = {
  studio_home: string;
  tool_overrides?: Record<string, string>;
  fallback_home?: string | null;
  sparsebundle_path?: string | null;
  models_dir?: string | null;
  outputs_dir?: string | null;
  cache_dir?: string | null;
};

export type EffectivePaths = {
  studio_home: string;
  models_dir: string;
  outputs_dir: string;
  cache_dir: string;
};

export type ActionResult = {
  ok: boolean;
  message: string;
  log_path?: string | null;
  opened_url?: string | null;
};

export type HealthResult = {
  tool_id: string;
  running: boolean;
  port_open: boolean;
  pid?: number | null;
};

export type InstallEvent = {
  tool_id: string;
  line: string;
};

export type QueueStatus = 'pending' | 'installing' | 'done' | 'failed';

export type QueueItem = {
  toolId: string;
  name: string;
  status: QueueStatus;
  message?: string;
  lines: string[];
  startedAt?: number;
  endedAt?: number;
  phase?: string;
  progressPct?: number;
  speed?: string;
  eta?: string;
  source?: 'ui' | 'cli';
};

export type VolumeCandidate = {
  path: string;
  label: string;
  kind: 'home' | 'external' | 'custom';
  mounted: boolean;
  writable: boolean;
  free_bytes?: number | null;
  total_bytes?: number | null;
};

export type WorkflowInput = {
  id: string;
  type: 'file' | 'text';
  label: string;
  required?: boolean;
  default?: string;
  accept?: string;
  placeholder?: string;
};

export type WorkflowStep = {
  id: string;
  label: string;
  type: 'http' | 'stub';
  method?: 'GET' | 'POST';
  url?: string;
  body_kind?: 'multipart' | 'json';
  fields?: Record<string, string>;
  body?: string;
  note?: string;
  input_from?: string;
  output?: { kind: string; from?: string; label?: string };
};

export type WorkflowDef = {
  id: string;
  name: string;
  category: string;
  emoji?: string;
  description: string;
  requires_tools?: string[];
  inputs?: WorkflowInput[];
  steps: WorkflowStep[];
};

export type MarketplaceEntry = {
  id: string;
  name: string;
  category: string;
  runtime: string;
  short_description: string;
  homepage?: string | null;
  repo?: string | null;
  default_port?: number | null;
  estimated_size_gb?: number | null;
  requires?: string[] | null;
  install_hint?: string | null;
  notes?: string | null;
};

export type ModelEntry = {
  name: string;
  relative_path: string;
  absolute_path: string;
  size_bytes: number;
  modified_secs: number;
};

export type DeclaredModel = {
  repo_id: string;
  local_name: string;
  local_path: string;
  present: boolean;
  size_bytes: number;
};

export type ModelDownloadProgress = {
  tool_id: string;
  repo_id: string;
  line: string;
};

export type ModelDownloadDone = {
  tool_id: string;
  repo_id: string;
  ok: boolean;
};

export type ToastKind = 'info' | 'success' | 'warn' | 'error';

export type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  ts: number;
};

export type SystemStats = {
  cpu_usage: number;
  cpu_cores: number;
  mem_used_bytes: number;
  mem_total_bytes: number;
  disk_free_bytes: number;
  disk_total_bytes: number;
  disk_path: string;
  uptime_secs: number;
  load_avg_1m: number;
};
