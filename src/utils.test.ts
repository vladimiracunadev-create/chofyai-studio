import { describe, expect, it } from 'vitest';
import { fmtBytes, fmtElapsed, parseInstallLine } from './utils';

describe('fmtBytes', () => {
  it('handles empty/zero', () => {
    expect(fmtBytes(0)).toBe('—');
    expect(fmtBytes(null)).toBe('—');
    expect(fmtBytes(undefined)).toBe('—');
  });
  it('formats KB/MB/GB with appropriate decimals', () => {
    expect(fmtBytes(512)).toBe('512 B');
    expect(fmtBytes(2048)).toBe('2.0 KB');
    expect(fmtBytes(1024 * 1024 * 50)).toBe('50 MB');
    expect(fmtBytes(1024 * 1024 * 1024 * 7)).toBe('7.0 GB');
  });
});

describe('fmtElapsed', () => {
  it('formats MM:SS', () => {
    expect(fmtElapsed(0)).toBe('0:00');
    expect(fmtElapsed(5_000)).toBe('0:05');
    expect(fmtElapsed(65_000)).toBe('1:05');
    expect(fmtElapsed(599_000)).toBe('9:59');
  });
});

describe('parseInstallLine', () => {
  const start = {};
  it('detecta clonado', () => {
    expect(parseInstallLine(start, "Clonando en '/path'...").phase).toBe('Clonando repositorio');
    expect(parseInstallLine(start, "Cloning into 'foo'...").phase).toBe('Clonando repositorio');
  });
  it('extrae % de receiving objects', () => {
    const r = parseInstallLine(start, 'Receiving objects:  47% (123/261), 1.2 MiB');
    expect(r.phase).toBe('Descargando objetos git');
    expect(r.progressPct).toBe(47);
  });
  it('extrae % de cmake [12%]', () => {
    const r = parseInstallLine(start, '[ 12%] Building CXX object foo.cpp.o');
    expect(r.phase).toBe('Compilando (cmake/make)');
    expect(r.progressPct).toBe(12);
  });
  it('clampea cmake > 100% a 100', () => {
    const r = parseInstallLine(start, '[198%] Built target whisper-server');
    expect(r.progressPct).toBe(100);
  });
  it('detecta linking', () => {
    expect(parseInstallLine(start, '[ 73%] Linking CXX shared library libfoo.dylib').phase).toBe('Compilando (cmake/make)');
  });
  it('detecta dependencias Python', () => {
    expect(parseInstallLine(start, 'Resolved 173 packages in 200ms').phase).toBe('Instalando dependencias Python');
    expect(parseInstallLine(start, 'Installed 4 packages in 11.06s').phase).toBe('Instalando dependencias Python');
  });
  it('detecta descarga de modelo', () => {
    expect(parseInstallLine(start, "Downloading ggml model base.en").phase).toBe('Descargando modelo');
    expect(parseInstallLine(start, "Done! Model 'base.en' saved in '/path/ggml.bin'").phase).toBe('Descargando modelo');
  });
  it('marca completado en INSTALL_OK', () => {
    const r = parseInstallLine(start, 'WHISPERCPP_INSTALL_OK');
    expect(r.progressPct).toBe(100);
    expect(r.phase).toBe('Listo');
  });
  it('preserva valores previos cuando no matchea', () => {
    const prev = { phase: 'Clonando repositorio', progressPct: 30 };
    const r = parseInstallLine(prev, 'línea aleatoria sin patrón conocido');
    expect(r.phase).toBe('Clonando repositorio');
    expect(r.progressPct).toBe(30);
  });
  it('strip ANSI codes', () => {
    const r = parseInstallLine(start, '\x1b[1m\x1b[92m   Compiling\x1b[0m foo');
    // sin matcher específico → preserva start, pero NO crashea
    expect(r).toBeDefined();
  });
});
