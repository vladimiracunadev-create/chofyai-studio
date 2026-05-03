// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_LANG, SUPPORTED_LANGS, getLang, knownKeys, setLang, t } from './i18n';

beforeEach(() => {
  // reset al default antes de cada test
  setLang(DEFAULT_LANG);
});

describe('i18n', () => {
  it('default lang is es', () => {
    expect(DEFAULT_LANG).toBe('es');
    expect(getLang()).toBe('es');
  });

  it('cambia entre ES y EN', () => {
    expect(t('btn.install')).toBe('Instalar');
    setLang('en');
    expect(getLang()).toBe('en');
    expect(t('btn.install')).toBe('Install');
    setLang('es');
    expect(t('btn.install')).toBe('Instalar');
  });

  it('substituye parámetros con {key}', () => {
    setLang('es');
    expect(t('toast.installed', { name: 'Whisper' })).toBe('Whisper instalado');
    setLang('en');
    expect(t('toast.installed', { name: 'Whisper' })).toBe('Whisper installed');
  });

  it('fallback al default si la key no existe en el lang activo', () => {
    setLang('en');
    // key inventada → debería devolver la key tal cual (no crashear)
    expect(t('foo.bar.no_existe')).toBe('foo.bar.no_existe');
  });

  it('rechaza langs no soportadas', () => {
    setLang('es');
    // @ts-expect-error
    setLang('xx');
    expect(getLang()).toBe('es'); // no cambió
  });

  it('todas las keys del default existen en EN (paridad de dicts)', () => {
    const esKeys = knownKeys();
    setLang('en');
    for (const k of esKeys) {
      // Si falta en EN, t() devolverá la key cruda — el test detectaría el gap.
      expect(t(k)).not.toBe(k);
    }
  });

  it('SUPPORTED_LANGS contiene es y en', () => {
    expect(SUPPORTED_LANGS).toContain('es');
    expect(SUPPORTED_LANGS).toContain('en');
  });
});
