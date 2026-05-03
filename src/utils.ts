// Helpers puros — testables sin React ni Tauri

export function fmtBytes(b?: number | null): string {
  if (!b || b <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = b, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60), ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export type LineParse = {
  phase?: string;
  progressPct?: number;
  speed?: string;
  eta?: string;
};

export function parseInstallLine(prev: LineParse, line: string): LineParse {
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
  else if (/Downloading .*\bmodel\b|Downloading ggml|saved in.*\.bin/i.test(stripped)) out.phase = 'Descargando modelo';
  else if (/Resolved \d+ packages|Installing collected|Downloading|Installed \d+ packages/i.test(stripped)) out.phase = 'Instalando dependencias Python';
  else if (/^\[\s*(\d+)%\]/.test(stripped)) {
    const m = stripped.match(/^\[\s*(\d+)%\]/)!;
    out.phase = 'Compilando (cmake/make)'; out.progressPct = Math.min(+m[1], 100);
  }
  else if (/Linking CXX|Linking C /i.test(stripped)) out.phase = 'Enlazando binarios';
  else if (/^\s*(\d{1,3})\s+\d+[KMG]?\s+(\d{1,3})\s+\d+[KMG]?\s+\d+\s+\d+\s+(\d+[KMG]?)\s/.test(stripped)) {
    const m = stripped.match(/^\s*(\d{1,3})\s+(\d+[KMG]?)\s+(\d{1,3})\s+(\d+[KMG]?)\s+\d+\s+\d+\s+(\d+[KMG]?)/)!;
    out.progressPct = +m[1];
    out.speed = `${m[5]}B/s`;
  }
  else if (/INSTALL_OK\b/.test(stripped)) { out.phase = 'Listo'; out.progressPct = 100; }

  return out;
}
