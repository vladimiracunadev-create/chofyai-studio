/**
 * utils.ts — helpers puros, sin React ni Tauri.
 *
 * Que este archivo no importe nada del proyecto es intencional: es lo que
 * permite probarlo de verdad (`src/utils.test.ts`, 13 pruebas) mientras el resto
 * del frontend queda sin cobertura. Cualquier lógica que se pueda extraer aquí
 * gana pruebas gratis.
 *
 * Documentación relacionada:
 * `docs/system-documentation/05-technical-reference.md`, sección 4.1.
 */

/**
 * Formatea un tamaño en bytes para mostrarlo al usuario.
 *
 * @param b Tamaño en bytes. `0`, `null` y `undefined` se tratan igual.
 * @returns Cadena legible (`"7.0 GB"`), o `"—"` cuando no hay dato.
 *
 * Usa un decimal por debajo de 10 y ninguno por encima, para que la barra de
 * estado no baile de ancho mientras cambian las cifras.
 */
export function fmtBytes(b?: number | null): string {
  if (!b || b <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = b, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

/**
 * Formatea una duración en milisegundos como `M:SS`.
 *
 * @param ms Milisegundos transcurridos.
 * @returns Por ejemplo `"1:05"`. Los minutos no se rellenan con cero.
 */
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

/**
 * Traduce una línea cruda de salida de instalación a estado de progreso.
 *
 * Reconoce los patrones que emiten git, cmake, pip, uv y curl durante una
 * instalación, y los convierte en una fase legible y un porcentaje.
 *
 * @param prev Estado acumulado hasta ahora. **Se conserva** cuando la línea no
 *   encaja con ningún patrón: sin esto, el porcentaje volvería a cero en cada
 *   línea de ruido, que son la mayoría.
 * @param line Línea de stdout tal como llega del script, posiblemente con
 *   códigos de color ANSI, que se limpian antes de analizar.
 * @returns Nuevo estado con `phase`, `progressPct`, `speed` y `eta` según lo
 *   detectado.
 *
 * Al añadir un patrón nuevo, añade también su prueba en `src/utils.test.ts`:
 * es la única red de seguridad que tiene esta función.
 */
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
