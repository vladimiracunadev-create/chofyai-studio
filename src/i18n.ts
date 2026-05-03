// i18n minimalista sin dependencias externas.
// Uso:
//   import { t, useT } from './i18n';
//   const _ = useT();   // hook que re-renderiza al cambiar idioma
//   <button>{t('common.install')}</button>

import { useEffect, useState } from 'react';

export type Lang = 'es' | 'en';

export const SUPPORTED_LANGS: Lang[] = ['es', 'en'];
export const DEFAULT_LANG: Lang = 'es';
const STORAGE_KEY = 'chofyai_lang';

type Dict = Record<string, string>;
const dictionaries: Record<Lang, Dict> = {
  es: {
    // Sidebar
    'sidebar.dashboard': 'Dashboard',
    'sidebar.tools': 'Tools',
    'sidebar.models': 'Models',
    'sidebar.voices': 'Voices',
    'sidebar.outputs': 'Outputs',
    'sidebar.logs': 'Logs',
    'sidebar.settings': 'Settings',
    'sidebar.doctor': 'Doctor',
    'sidebar.tour': 'Tour',
    'sidebar.commands': 'Comandos',
    'sidebar.shortcuts': 'Atajos',
    'sidebar.marketplace': 'Marketplace',
    'sidebar.workflows': 'Workflows',
    'sidebar.theme': 'Tema',
    'sidebar.lang': 'Idioma',
    'sidebar.lead': 'Launcher local para voz, video, imágenes y música.',
    'sidebar.summary': 'Resumen',
    'sidebar.orphans': 'Huérfanos',
    // Topbar
    'topbar.search': '🔎 Buscar',
    'topbar.tools': 'Tools',
    'topbar.active': 'Activas',
    'topbar.fallback': '⚠ Fallback',
    'topbar.orphans': '👻 {n} huérfanos',
    // Categorías
    'cat.voice': 'Voz',
    'cat.asr': 'ASR',
    'cat.video': 'Video/Cara',
    'cat.image': 'Imágenes',
    'cat.music': 'Música',
    'cat.system': 'Sistema',
    'cat.chain': 'Chain',
    // Más botones
    'btn.folder': 'Carpeta',
    'btn.log': 'Log',
    'btn.models': 'Modelos',
    'btn.new_workflow': '+ Nuevo workflow',
    // Section headers
    'section.tools': 'Herramientas',
    'section.queue': 'Cola de instalación',
    'section.orphans': 'Procesos huérfanos detectados',
    'section.logs': 'Logs',
    'section.models': 'Modelos',
    'section.workflows': 'Workflows',
    'section.marketplace': 'Marketplace de tools',
    'section.settings': 'Configuración',
    'section.shortcuts': 'Atajos de teclado',
    // Buttons
    'btn.install': 'Instalar',
    'btn.start': 'Iniciar',
    'btn.stop': 'Stop',
    'btn.restart': 'Restart',
    'btn.update': 'Update',
    'btn.refresh': 'Refrescar',
    'btn.refresh_state': 'Refrescar estado',
    'btn.view_ui': 'Ver UI',
    'btn.close_ui': 'Cerrar UI',
    'btn.close': 'Cerrar',
    'btn.cancel': 'Cancelar',
    'btn.run': 'Ejecutar',
    'btn.add_to_queue': '+ Cola',
    'btn.add_pending_to_queue': '+ Añadir pendientes a cola',
    'btn.start_queue': '▶ Iniciar cola',
    'btn.installing': '⏳ Instalando...',
    'btn.clear': 'Limpiar',
    'btn.move': '📍 Mover',
    'btn.reset_path': '↺ Reset ruta',
    'btn.import_manifest': '+ Importar manifest',
    'btn.already_imported': 'Ya importado',
    'btn.run_workflow': '▶ Ejecutar workflow',
    'btn.running': '⏳ Ejecutando…',
    // States
    'state.installed': '✅ Instalado',
    'state.pending': '⏳ Pendiente',
    'state.active': 'Activo',
    'state.recommended': 'Recomendado',
    'state.relocated': '📍 Reubicado',
    'state.starting': 'Iniciando…',
    'state.stopped': 'Detenido',
    'state.port_open': '🟢 Puerto OK',
    'state.port_closed': '🔴 Puerto cerrado',
    // Empty state
    'empty.title': 'Aún no tienes herramientas instaladas',
    'empty.body': 'Instala tu primera herramienta para empezar. Recomendamos whisper.cpp: rápido (compila en ~2 min), funciona sin GPU, y descarga solo 141 MB.',
    'empty.install_whisper': '⚡ Instalar whisper.cpp ahora',
    'empty.queue_all': '📦 Encolar las 5 herramientas',
    // Tool card
    'tool.state': 'Estado',
    'tool.health': 'Health',
    'tool.path': 'Ruta',
    'tool.port': 'Puerto',
    // Toasts
    'toast.refreshed': 'Refrescado',
    'toast.installed': '{name} instalado',
    'toast.install_failed': '{name} falló',
    'toast.started': '{name} iniciado',
    'toast.stopped': '{name} detenido',
    'toast.restarted': '{name} reiniciado',
    'toast.processes_restored': 'Procesos restaurados',
    'toast.processes_restored_body': '{n} servidor(es) sigue(n) vivo(s)',
    // Onboarding
    'onb.welcome.title': 'Bienvenido a ChofyAI Studio',
    'onb.welcome.body': 'Un launcher local para tus herramientas creativas de IA en Apple Silicon. Te guío en 3 pasos rápidos.',
    'onb.skip': 'Saltar',
    'onb.start': 'Empezar →',
    'onb.back': '← Atrás',
    'onb.save_continue': 'Guardar y continuar →',
    'onb.later': 'Lo haré después',
    'onb.install_now': '⚡ Instalar ahora',
    'onb.done.title': 'Todo listo',
    'onb.start_using': 'Empezar a usar ✨',
  },
  en: {
    // Sidebar
    'sidebar.dashboard': 'Dashboard',
    'sidebar.tools': 'Tools',
    'sidebar.models': 'Models',
    'sidebar.voices': 'Voices',
    'sidebar.outputs': 'Outputs',
    'sidebar.logs': 'Logs',
    'sidebar.settings': 'Settings',
    'sidebar.doctor': 'Doctor',
    'sidebar.tour': 'Tour',
    'sidebar.commands': 'Commands',
    'sidebar.shortcuts': 'Shortcuts',
    'sidebar.marketplace': 'Marketplace',
    'sidebar.workflows': 'Workflows',
    'sidebar.theme': 'Theme',
    'sidebar.lang': 'Language',
    'sidebar.lead': 'Local launcher for voice, video, images and music.',
    'sidebar.summary': 'Summary',
    'sidebar.orphans': 'Orphans',
    // Topbar
    'topbar.search': '🔎 Search',
    'topbar.tools': 'Tools',
    'topbar.active': 'Active',
    'topbar.fallback': '⚠ Fallback',
    'topbar.orphans': '👻 {n} orphans',
    // Categorías
    'cat.voice': 'Voice',
    'cat.asr': 'ASR',
    'cat.video': 'Video/Face',
    'cat.image': 'Image',
    'cat.music': 'Music',
    'cat.system': 'System',
    'cat.chain': 'Chain',
    // More buttons
    'btn.folder': 'Folder',
    'btn.log': 'Log',
    'btn.models': 'Models',
    'btn.new_workflow': '+ New workflow',
    // Section headers
    'section.tools': 'Tools',
    'section.queue': 'Install queue',
    'section.orphans': 'Orphan processes detected',
    'section.logs': 'Logs',
    'section.models': 'Models',
    'section.workflows': 'Workflows',
    'section.marketplace': 'Tools Marketplace',
    'section.settings': 'Settings',
    'section.shortcuts': 'Keyboard shortcuts',
    // Buttons
    'btn.install': 'Install',
    'btn.start': 'Start',
    'btn.stop': 'Stop',
    'btn.restart': 'Restart',
    'btn.update': 'Update',
    'btn.refresh': 'Refresh',
    'btn.refresh_state': 'Refresh state',
    'btn.view_ui': 'View UI',
    'btn.close_ui': 'Close UI',
    'btn.close': 'Close',
    'btn.cancel': 'Cancel',
    'btn.run': 'Run',
    'btn.add_to_queue': '+ Queue',
    'btn.add_pending_to_queue': '+ Add pending to queue',
    'btn.start_queue': '▶ Start queue',
    'btn.installing': '⏳ Installing...',
    'btn.clear': 'Clear',
    'btn.move': '📍 Move',
    'btn.reset_path': '↺ Reset path',
    'btn.import_manifest': '+ Import manifest',
    'btn.already_imported': 'Already imported',
    'btn.run_workflow': '▶ Run workflow',
    'btn.running': '⏳ Running…',
    // States
    'state.installed': '✅ Installed',
    'state.pending': '⏳ Pending',
    'state.active': 'Active',
    'state.recommended': 'Recommended',
    'state.relocated': '📍 Relocated',
    'state.starting': 'Starting…',
    'state.stopped': 'Stopped',
    'state.port_open': '🟢 Port OK',
    'state.port_closed': '🔴 Port closed',
    // Empty state
    'empty.title': "You don't have any tool installed yet",
    'empty.body': "Install your first tool to get started. We recommend whisper.cpp: fast (compiles in ~2 min), runs without GPU, and only downloads 141 MB.",
    'empty.install_whisper': '⚡ Install whisper.cpp now',
    'empty.queue_all': '📦 Queue all 5 tools',
    // Tool card
    'tool.state': 'State',
    'tool.health': 'Health',
    'tool.path': 'Path',
    'tool.port': 'Port',
    // Toasts
    'toast.refreshed': 'Refreshed',
    'toast.installed': '{name} installed',
    'toast.install_failed': '{name} failed',
    'toast.started': '{name} started',
    'toast.stopped': '{name} stopped',
    'toast.restarted': '{name} restarted',
    'toast.processes_restored': 'Processes restored',
    'toast.processes_restored_body': '{n} server(s) still alive',
    // Onboarding
    'onb.welcome.title': 'Welcome to ChofyAI Studio',
    'onb.welcome.body': 'A local launcher for your creative AI tools on Apple Silicon. I will guide you through 3 quick steps.',
    'onb.skip': 'Skip',
    'onb.start': 'Start →',
    'onb.back': '← Back',
    'onb.save_continue': 'Save and continue →',
    'onb.later': "I'll do it later",
    'onb.install_now': '⚡ Install now',
    'onb.done.title': 'All set',
    'onb.start_using': 'Start using ✨',
  },
};

let currentLang: Lang = (() => {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as Lang | null;
    return v && SUPPORTED_LANGS.includes(v) ? v : DEFAULT_LANG;
  } catch { return DEFAULT_LANG; }
})();

const listeners = new Set<() => void>();

export function getLang(): Lang { return currentLang; }

export function setLang(l: Lang) {
  if (!SUPPORTED_LANGS.includes(l)) return;
  currentLang = l;
  try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  document.documentElement.lang = l;
  for (const cb of listeners) cb();
}

export function t(key: string, params?: Record<string, string | number>): string {
  const dict = dictionaries[currentLang] ?? dictionaries[DEFAULT_LANG];
  let s = dict[key];
  if (s === undefined) {
    // fallback al default si la key no existe en el idioma actual
    s = dictionaries[DEFAULT_LANG][key] ?? key;
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}

/** Hook que fuerza re-render del componente cuando el idioma cambia. */
export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force((n) => n + 1);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);
  return t;
}

/** Lista de keys conocidas — útil para tests. */
export function knownKeys(): string[] {
  return Object.keys(dictionaries[DEFAULT_LANG]);
}
