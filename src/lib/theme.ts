/**
 * Theme system. A "palette" is the full set of color CSS variables the app
 * reads. Presets ship complete palettes; the custom theme editor exposes only
 * 8 base colors and we *derive* the remaining surfaces, borders, and a readable
 * syntax palette from them (light vs. dark is decided by background luminance).
 */

import { isObject, sanitizeHexColor } from './validation';

export type ThemePresetId =
  | 'light'
  | 'monokia'
  | 'dracula'
  | 'nord'
  | 'solarized-dark'
  | 'solarized-light'
  | 'gruvbox-dark'
  | 'gruvbox-light'
  | 'tokyo-night'
  | 'forest'
  | 'rose-dawn'
  | 'oceanic'
  | 'midnight-purple'
  | 'hc-light'
  | 'hc-dark'
  | 'ember'
  | 'paper'
  | 'terminal';

export type ThemeId = ThemePresetId | 'custom';

/** The 8 colors the custom-theme editor lets a user pick (see Guide §IV). */
export interface BaseColors {
  background: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  error: string;
  success: string;
  warning: string;
  border: string;
}

/** Full palette = every CSS variable the app sets on <html>. */
export type Palette = Record<string, string>;

/* ----------------------------- color helpers ----------------------------- */

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mix two colors; amount 0 = a, 1 = b. */
function mix(a: string, b: string, amount: number): string {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  return rgbToHex({
    r: c1.r + (c2.r - c1.r) * amount,
    g: c1.g + (c2.g - c1.g) * amount,
    b: c1.b + (c2.b - c1.b) * amount,
  });
}

/** Relative luminance (0 dark – 1 light) for choosing a syntax palette. */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Convert a hex + alpha to an rgba() string (used for translucent borders). */
function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ------------------------------- presets --------------------------------- */

const SYNTAX_LIGHT = {
  '--color-syntax-keyword': '#9d4edd',
  '--color-syntax-string': '#2a9d4a',
  '--color-syntax-comment': '#a3a199',
  '--color-syntax-function': '#1d6f9e',
  '--color-syntax-builtin': '#b5651d',
  '--color-syntax-number': '#b5651d',
  '--color-syntax-operator': '#5a5954',
  '--color-syntax-punctuation': '#6f6e69',
  '--color-syntax-decorator': '#c98a1b',
  '--color-syntax-class': '#1d6f8e',
};

const SYNTAX_DARK = {
  '--color-syntax-keyword': '#c792ea',
  '--color-syntax-string': '#9ece6a',
  '--color-syntax-comment': '#5f5e5a',
  '--color-syntax-function': '#7aa2f7',
  '--color-syntax-builtin': '#e0af68',
  '--color-syntax-number': '#e0af68',
  '--color-syntax-operator': '#89ddff',
  '--color-syntax-punctuation': '#a9b1d6',
  '--color-syntax-decorator': '#e2b714',
  '--color-syntax-class': '#7dcfff',
};

export const PRESETS: Record<ThemePresetId, Palette> = {
  light: {
    '--color-background-primary': '#f8f7f5',
    '--color-background-secondary': '#efefec',
    '--color-background-tertiary': '#e4e3df',
    '--color-text-primary': '#2c2c2a',
    '--color-text-secondary': '#888780',
    '--color-text-tertiary': '#b4b2a9',
    '--color-accent': '#1d9e75',
    '--color-error': '#e24b4a',
    '--color-success': '#639922',
    '--color-warning': '#c98a1b',
    '--color-border-primary': 'rgba(0, 0, 0, 0.4)',
    '--color-border-secondary': 'rgba(0, 0, 0, 0.22)',
    '--color-border-tertiary': 'rgba(0, 0, 0, 0.12)',
    ...SYNTAX_LIGHT,
  },
  // "Monokia": dark, muted amber accent — homage to Monkeytype's dark mode.
  monokia: {
    '--color-background-primary': '#0f0e0d',
    '--color-background-secondary': '#1a1917',
    '--color-background-tertiary': '#232220',
    '--color-text-primary': '#f1f0ed',
    '--color-text-secondary': '#888780',
    '--color-text-tertiary': '#5f5e5a',
    '--color-accent': '#e2b714',
    '--color-error': '#e24b4a',
    '--color-success': '#88b04b',
    '--color-warning': '#e2b714',
    '--color-border-primary': 'rgba(255, 255, 255, 0.32)',
    '--color-border-secondary': 'rgba(255, 255, 255, 0.18)',
    '--color-border-tertiary': 'rgba(255, 255, 255, 0.1)',
    ...SYNTAX_DARK,
  },
  dracula: {
    '--color-background-primary': '#1e1f29',
    '--color-background-secondary': '#282a36',
    '--color-background-tertiary': '#323543',
    '--color-text-primary': '#f8f8f2',
    '--color-text-secondary': '#b5b7c4',
    '--color-text-tertiary': '#85879a',
    '--color-accent': '#bd93f9',
    '--color-error': '#ff5555',
    '--color-success': '#50fa7b',
    '--color-warning': '#ffb86c',
    '--color-border-primary': 'rgba(255, 255, 255, 0.33)',
    '--color-border-secondary': 'rgba(255, 255, 255, 0.2)',
    '--color-border-tertiary': 'rgba(255, 255, 255, 0.11)',
    ...SYNTAX_DARK,
  },
  nord: {
    '--color-background-primary': '#2e3440',
    '--color-background-secondary': '#3b4252',
    '--color-background-tertiary': '#434c5e',
    '--color-text-primary': '#eceff4',
    '--color-text-secondary': '#c3cad6',
    '--color-text-tertiary': '#919cad',
    '--color-accent': '#88c0d0',
    '--color-error': '#bf616a',
    '--color-success': '#a3be8c',
    '--color-warning': '#ebcb8b',
    '--color-border-primary': 'rgba(255, 255, 255, 0.34)',
    '--color-border-secondary': 'rgba(255, 255, 255, 0.2)',
    '--color-border-tertiary': 'rgba(255, 255, 255, 0.12)',
    ...SYNTAX_DARK,
  },
  'solarized-dark': {
    '--color-background-primary': '#002b36',
    '--color-background-secondary': '#073642',
    '--color-background-tertiary': '#0d4755',
    '--color-text-primary': '#fdf6e3',
    '--color-text-secondary': '#93a1a1',
    '--color-text-tertiary': '#657b83',
    '--color-accent': '#2aa198',
    '--color-error': '#dc322f',
    '--color-success': '#859900',
    '--color-warning': '#b58900',
    '--color-border-primary': 'rgba(255, 255, 255, 0.3)',
    '--color-border-secondary': 'rgba(255, 255, 255, 0.18)',
    '--color-border-tertiary': 'rgba(255, 255, 255, 0.1)',
    ...SYNTAX_DARK,
  },
  'solarized-light': {
    '--color-background-primary': '#fdf6e3',
    '--color-background-secondary': '#eee8d5',
    '--color-background-tertiary': '#e3dcc6',
    '--color-text-primary': '#073642',
    '--color-text-secondary': '#586e75',
    '--color-text-tertiary': '#93a1a1',
    '--color-accent': '#268bd2',
    '--color-error': '#dc322f',
    '--color-success': '#859900',
    '--color-warning': '#b58900',
    '--color-border-primary': 'rgba(0, 0, 0, 0.34)',
    '--color-border-secondary': 'rgba(0, 0, 0, 0.22)',
    '--color-border-tertiary': 'rgba(0, 0, 0, 0.12)',
    ...SYNTAX_LIGHT,
  },
  'gruvbox-dark': {
    '--color-background-primary': '#1d2021',
    '--color-background-secondary': '#282828',
    '--color-background-tertiary': '#32302f',
    '--color-text-primary': '#ebdbb2',
    '--color-text-secondary': '#bdae93',
    '--color-text-tertiary': '#928374',
    '--color-accent': '#fe8019',
    '--color-error': '#fb4934',
    '--color-success': '#b8bb26',
    '--color-warning': '#fabd2f',
    '--color-border-primary': 'rgba(255, 255, 255, 0.3)',
    '--color-border-secondary': 'rgba(255, 255, 255, 0.18)',
    '--color-border-tertiary': 'rgba(255, 255, 255, 0.1)',
    ...SYNTAX_DARK,
  },
  'gruvbox-light': {
    '--color-background-primary': '#fbf1c7',
    '--color-background-secondary': '#f2e5bc',
    '--color-background-tertiary': '#eadcad',
    '--color-text-primary': '#3c3836',
    '--color-text-secondary': '#665c54',
    '--color-text-tertiary': '#928374',
    '--color-accent': '#d65d0e',
    '--color-error': '#cc241d',
    '--color-success': '#98971a',
    '--color-warning': '#d79921',
    '--color-border-primary': 'rgba(0, 0, 0, 0.35)',
    '--color-border-secondary': 'rgba(0, 0, 0, 0.22)',
    '--color-border-tertiary': 'rgba(0, 0, 0, 0.12)',
    ...SYNTAX_LIGHT,
  },
  'tokyo-night': {
    '--color-background-primary': '#1a1b26',
    '--color-background-secondary': '#24283b',
    '--color-background-tertiary': '#2f334d',
    '--color-text-primary': '#c0caf5',
    '--color-text-secondary': '#9aa5ce',
    '--color-text-tertiary': '#7f86a9',
    '--color-accent': '#7aa2f7',
    '--color-error': '#f7768e',
    '--color-success': '#9ece6a',
    '--color-warning': '#e0af68',
    '--color-border-primary': 'rgba(255, 255, 255, 0.3)',
    '--color-border-secondary': 'rgba(255, 255, 255, 0.18)',
    '--color-border-tertiary': 'rgba(255, 255, 255, 0.1)',
    ...SYNTAX_DARK,
  },
  forest: {
    '--color-background-primary': '#102219',
    '--color-background-secondary': '#163126',
    '--color-background-tertiary': '#1c4133',
    '--color-text-primary': '#e4f0e9',
    '--color-text-secondary': '#a3c0ae',
    '--color-text-tertiary': '#6f9180',
    '--color-accent': '#6bcf8e',
    '--color-error': '#ef6f6c',
    '--color-success': '#8ddf5a',
    '--color-warning': '#d7b14a',
    '--color-border-primary': 'rgba(255, 255, 255, 0.28)',
    '--color-border-secondary': 'rgba(255, 255, 255, 0.16)',
    '--color-border-tertiary': 'rgba(255, 255, 255, 0.1)',
    ...SYNTAX_DARK,
  },
  'rose-dawn': {
    '--color-background-primary': '#fff6fa',
    '--color-background-secondary': '#f8e9f0',
    '--color-background-tertiary': '#f0dce6',
    '--color-text-primary': '#44343f',
    '--color-text-secondary': '#7a6270',
    '--color-text-tertiary': '#aa95a1',
    '--color-accent': '#cf6f9b',
    '--color-error': '#dd5f6d',
    '--color-success': '#74a971',
    '--color-warning': '#c48f45',
    '--color-border-primary': 'rgba(0, 0, 0, 0.32)',
    '--color-border-secondary': 'rgba(0, 0, 0, 0.2)',
    '--color-border-tertiary': 'rgba(0, 0, 0, 0.11)',
    ...SYNTAX_LIGHT,
  },
  oceanic: {
    '--color-background-primary': '#0f1f2e',
    '--color-background-secondary': '#152a3d',
    '--color-background-tertiary': '#1d3450',
    '--color-text-primary': '#d7e6f4',
    '--color-text-secondary': '#9eb4ca',
    '--color-text-tertiary': '#7289a0',
    '--color-accent': '#56c7d9',
    '--color-error': '#f07178',
    '--color-success': '#8fcf7b',
    '--color-warning': '#f2c179',
    '--color-border-primary': 'rgba(255, 255, 255, 0.3)',
    '--color-border-secondary': 'rgba(255, 255, 255, 0.17)',
    '--color-border-tertiary': 'rgba(255, 255, 255, 0.1)',
    ...SYNTAX_DARK,
  },
  'midnight-purple': {
    '--color-background-primary': '#150f24',
    '--color-background-secondary': '#201738',
    '--color-background-tertiary': '#2a1f48',
    '--color-text-primary': '#ebe5ff',
    '--color-text-secondary': '#baaddf',
    '--color-text-tertiary': '#887bb2',
    '--color-accent': '#b48efc',
    '--color-error': '#ff6c8f',
    '--color-success': '#8ce39a',
    '--color-warning': '#f0c066',
    '--color-border-primary': 'rgba(255, 255, 255, 0.32)',
    '--color-border-secondary': 'rgba(255, 255, 255, 0.2)',
    '--color-border-tertiary': 'rgba(255, 255, 255, 0.11)',
    ...SYNTAX_DARK,
  },
  'hc-light': {
    '--color-background-primary': '#ffffff',
    '--color-background-secondary': '#f3f3f3',
    '--color-background-tertiary': '#e7e7e7',
    '--color-text-primary': '#000000',
    '--color-text-secondary': '#1a1a1a',
    '--color-text-tertiary': '#2e2e2e',
    '--color-accent': '#0050c8',
    '--color-error': '#9f0000',
    '--color-success': '#166534',
    '--color-warning': '#854d0e',
    '--color-border-primary': 'rgba(0, 0, 0, 0.72)',
    '--color-border-secondary': 'rgba(0, 0, 0, 0.45)',
    '--color-border-tertiary': 'rgba(0, 0, 0, 0.28)',
    ...SYNTAX_LIGHT,
  },
  'hc-dark': {
    '--color-background-primary': '#000000',
    '--color-background-secondary': '#161616',
    '--color-background-tertiary': '#242424',
    '--color-text-primary': '#ffffff',
    '--color-text-secondary': '#f2f2f2',
    '--color-text-tertiary': '#d6d6d6',
    '--color-accent': '#7eb6ff',
    '--color-error': '#ff6b6b',
    '--color-success': '#86efac',
    '--color-warning': '#fde047',
    '--color-border-primary': 'rgba(255, 255, 255, 0.7)',
    '--color-border-secondary': 'rgba(255, 255, 255, 0.45)',
    '--color-border-tertiary': 'rgba(255, 255, 255, 0.28)',
    ...SYNTAX_DARK,
  },
  ember: {
    '--color-background-primary': '#1a100c',
    '--color-background-secondary': '#271910',
    '--color-background-tertiary': '#342117',
    '--color-text-primary': '#f8efe6',
    '--color-text-secondary': '#d7b79a',
    '--color-text-tertiary': '#a8876c',
    '--color-accent': '#f08c4a',
    '--color-error': '#f07167',
    '--color-success': '#9ccc65',
    '--color-warning': '#f0c05a',
    '--color-border-primary': 'rgba(255, 255, 255, 0.32)',
    '--color-border-secondary': 'rgba(255, 255, 255, 0.18)',
    '--color-border-tertiary': 'rgba(255, 255, 255, 0.1)',
    ...SYNTAX_DARK,
  },
  paper: {
    '--color-background-primary': '#f6f1e4',
    '--color-background-secondary': '#ece4d0',
    '--color-background-tertiary': '#e0d4b8',
    '--color-text-primary': '#2a2418',
    '--color-text-secondary': '#5c5344',
    '--color-text-tertiary': '#857966',
    '--color-accent': '#0f6b5c',
    '--color-error': '#b42318',
    '--color-success': '#3f7d20',
    '--color-warning': '#a16207',
    '--color-border-primary': 'rgba(0, 0, 0, 0.38)',
    '--color-border-secondary': 'rgba(0, 0, 0, 0.22)',
    '--color-border-tertiary': 'rgba(0, 0, 0, 0.12)',
    ...SYNTAX_LIGHT,
  },
  terminal: {
    '--color-background-primary': '#03140b',
    '--color-background-secondary': '#0a1f14',
    '--color-background-tertiary': '#12291c',
    '--color-text-primary': '#d7ffe6',
    '--color-text-secondary': '#8fd9ab',
    '--color-text-tertiary': '#5fa67d',
    '--color-accent': '#3ddc84',
    '--color-error': '#ff7a7a',
    '--color-success': '#7dff9a',
    '--color-warning': '#e6d36a',
    '--color-border-primary': 'rgba(61, 220, 132, 0.45)',
    '--color-border-secondary': 'rgba(61, 220, 132, 0.25)',
    '--color-border-tertiary': 'rgba(61, 220, 132, 0.12)',
    ...SYNTAX_DARK,
  },
};

export interface ThemeOption {
  id: ThemeId;
  label: string;
  /** Exclusive aesthetic palettes; high-contrast presets stay free for accessibility. */
  pro?: boolean;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'light', label: 'Light' },
  { id: 'monokia', label: 'Monokia' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'nord', label: 'Nord' },
  { id: 'solarized-dark', label: 'Solarized Dark' },
  { id: 'solarized-light', label: 'Solarized Light' },
  { id: 'gruvbox-dark', label: 'Gruvbox Dark' },
  { id: 'gruvbox-light', label: 'Gruvbox Light' },
  { id: 'tokyo-night', label: 'Tokyo Night' },
  { id: 'forest', label: 'Forest' },
  { id: 'rose-dawn', label: 'Rose Dawn' },
  { id: 'oceanic', label: 'Oceanic' },
  { id: 'midnight-purple', label: 'Midnight Purple' },
  { id: 'hc-light', label: 'High Contrast Light' },
  { id: 'hc-dark', label: 'High Contrast Dark' },
  { id: 'ember', label: 'Ember', pro: true },
  { id: 'paper', label: 'Paper', pro: true },
  { id: 'terminal', label: 'Terminal', pro: true },
  { id: 'custom', label: 'Custom' },
];

export const PRO_THEME_IDS: ThemeId[] = THEME_OPTIONS.filter((option) => option.pro).map((option) => option.id);

export const THEME_IDS: ThemeId[] = THEME_OPTIONS.map((option) => option.id);

/** Base colors pre-filled into the custom editor (derived from Monokia). */
export const DEFAULT_CUSTOM: BaseColors = {
  background: '#0f0e0d',
  textPrimary: '#f1f0ed',
  textSecondary: '#888780',
  accent: '#7aa2f7',
  error: '#e24b4a',
  success: '#88b04b',
  warning: '#e2b714',
  border: '#ffffff',
};

/** Coerce an untrusted object into BaseColors, forcing every field to a valid
 *  hex color. This is the security gate for custom themes: a bad value (e.g.
 *  an attempt to inject CSS) is replaced by the corresponding default. */
export function sanitizeBaseColors(raw: unknown): BaseColors {
  const r = isObject(raw) ? raw : {};
  return {
    background: sanitizeHexColor(r.background, DEFAULT_CUSTOM.background),
    textPrimary: sanitizeHexColor(r.textPrimary, DEFAULT_CUSTOM.textPrimary),
    textSecondary: sanitizeHexColor(r.textSecondary, DEFAULT_CUSTOM.textSecondary),
    accent: sanitizeHexColor(r.accent, DEFAULT_CUSTOM.accent),
    error: sanitizeHexColor(r.error, DEFAULT_CUSTOM.error),
    success: sanitizeHexColor(r.success, DEFAULT_CUSTOM.success),
    warning: sanitizeHexColor(r.warning, DEFAULT_CUSTOM.warning),
    border: sanitizeHexColor(r.border, DEFAULT_CUSTOM.border),
  };
}

/**
 * Expand the 8 user-chosen colors into the full palette. Secondary/tertiary
 * surfaces are nudged toward white (light bg) or away (dark bg); borders use
 * the chosen border color at decreasing alpha; the syntax set is picked by the
 * background's luminance so code stays readable on either polarity.
 */
export function paletteFromBase(base: BaseColors): Palette {
  const isDark = luminance(base.background) < 0.5;
  const shiftTarget = isDark ? '#ffffff' : '#000000';
  return {
    '--color-background-primary': base.background,
    '--color-background-secondary': mix(base.background, shiftTarget, 0.05),
    '--color-background-tertiary': mix(base.background, shiftTarget, 0.1),
    '--color-text-primary': base.textPrimary,
    '--color-text-secondary': base.textSecondary,
    '--color-text-tertiary': mix(base.textSecondary, base.background, 0.45),
    '--color-accent': base.accent,
    '--color-error': base.error,
    '--color-success': base.success,
    '--color-warning': base.warning,
    '--color-border-primary': rgba(base.border, 0.4),
    '--color-border-secondary': rgba(base.border, 0.2),
    '--color-border-tertiary': rgba(base.border, 0.1),
    ...(isDark ? SYNTAX_DARK : SYNTAX_LIGHT),
  };
}

/** Write a palette onto the document root as inline CSS variables. */
export function applyPalette(palette: Palette): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(key, value);
  }
  // Mark the active polarity so the CSS first-paint fallback steps aside.
  const isDark = luminance(palette['--color-background-primary'] ?? '#ffffff') < 0.5;
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

/** Resolve the palette for a given theme selection. */
export function resolvePalette(themeId: ThemeId, custom: BaseColors): Palette {
  if (themeId === 'custom') return paletteFromBase(custom);
  return PRESETS[themeId];
}
