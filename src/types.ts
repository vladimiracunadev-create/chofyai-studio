export type ToolManifest = {
  file_name: string;
  id: string;
  name: string;
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
};

export type AppSettings = {
  studio_home: string;
  tool_overrides?: Record<string, string>;
  fallback_home?: string | null;
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

export type ModelEntry = {
  name: string;
  relative_path: string;
  absolute_path: string;
  size_bytes: number;
  modified_secs: number;
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
