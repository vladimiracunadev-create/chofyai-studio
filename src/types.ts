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
};

export type SystemSummary = {
  app_name: string;
  app_version: string;
  os: string;
  arch: string;
  studio_home: string;
  settings_file: string;
};

export type AppSettings = {
  studio_home: string;
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

/** Estado de un ítem en la cola de instalación. */
export type QueueStatus = 'pending' | 'installing' | 'done' | 'failed';

export type QueueItem = {
  toolId: string;
  name: string;
  status: QueueStatus;
  message?: string;
  lines: string[];
};
