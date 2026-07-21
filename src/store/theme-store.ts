import { useExternalStoreSelector } from './selector';
import type { EqualityFn } from './selector';

export const DEFAULT_ACCENT = '#e6a23c';
export const ACCENT_PRESETS = [
  { name: 'Amber', value: DEFAULT_ACCENT },
  { name: 'Cyan', value: '#55c7d9' },
  { name: 'Mint', value: '#63d6a2' },
  { name: 'Violet', value: '#b49cff' },
  { name: 'Rose', value: '#f08ba8' },
  { name: 'Lime', value: '#b5cf62' },
] as const;

const STORAGE_KEY = 'lispllm.theme.v1';
export const THEME_SURFACES = {
  dark: { canvas: '#0f0e0c', panel: '#181613', chrome: '#141311' },
  light: { canvas: '#f8f6f2', panel: '#fffdf8', chrome: '#eee9e1' },
} as const;

export type ThemeMode = 'dark' | 'light';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface ThemeState {
  mode: ThemeMode;
  rawAccent: string;
  accent: string;
  foreground: string;
}

export function normalizeHex(value: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  return match ? `#${match[1].toLowerCase()}` : null;
}

function toRgb(hex: string): Rgb {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function luminance(rgb: Rgb): number {
  const linear = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(a: string, b: string): number {
  const firstHex = normalizeHex(a);
  const secondHex = normalizeHex(b);
  if (!firstHex || !secondHex) return 1;
  const first = luminance(toRgb(firstHex));
  const second = luminance(toRgb(secondHex));
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function mixToward(rgb: Rgb, target: number, amount: number): Rgb {
  return {
    r: rgb.r + (target - rgb.r) * amount,
    g: rgb.g + (target - rgb.g) * amount,
    b: rgb.b + (target - rgb.b) * amount,
  };
}

export function deriveTheme(value: string, mode: ThemeMode = 'dark'): ThemeState {
  const rawAccent = normalizeHex(value) ?? DEFAULT_ACCENT;
  const raw = toRgb(rawAccent);
  let accent = rawAccent;
  const surfaces = THEME_SURFACES[mode];
  const target = mode === 'dark' ? 255 : 0;
  for (let step = 0; step <= 100; step++) {
    const candidate = toHex(mixToward(raw, target, step / 100));
    if (
      Math.min(
        contrastRatio(candidate, surfaces.canvas),
        contrastRatio(candidate, surfaces.panel),
        contrastRatio(candidate, surfaces.chrome),
      ) >= 4.5
    ) {
      accent = candidate;
      break;
    }
  }
  const foreground = surfaces.canvas;
  return { mode, rawAccent, accent, foreground };
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light';
}

function load(): ThemeState {
  if (typeof localStorage === 'undefined') return deriveTheme(DEFAULT_ACCENT);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as {
      v?: number;
      accent?: unknown;
      mode?: unknown;
    };
    const accent =
      (saved.v === 1 || saved.v === 2) && typeof saved.accent === 'string' ? saved.accent : '';
    const mode = saved.v === 2 && isThemeMode(saved.mode) ? saved.mode : 'dark';
    return deriveTheme(accent, mode);
  } catch {
    return deriveTheme(DEFAULT_ACCENT);
  }
}

let state = load();
const listeners = new Set<() => void>();

function rgbChannels(hex: string): string {
  const { r, g, b } = toRgb(hex);
  return `${r} ${g} ${b}`;
}

export function applyTheme(theme = state): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme.mode;
  root.style.colorScheme = theme.mode;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_SURFACES[theme.mode].chrome);
  root.style.setProperty('--accent-rgb', rgbChannels(theme.accent));
  root.style.setProperty('--accent-foreground-rgb', rgbChannels(theme.foreground));
  root.style.setProperty('--accent', theme.accent);
}

function emit(next: ThemeState): void {
  if (
    next.mode === state.mode &&
    next.rawAccent === state.rawAccent &&
    next.accent === state.accent &&
    next.foreground === state.foreground
  )
    return;
  state = next;
  applyTheme(state);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 2, accent: state.rawAccent, mode: state.mode }),
    );
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getThemeState(): ThemeState {
  return state;
}

export function useThemeState<Selection = ThemeState>(
  selector: (current: ThemeState) => Selection = (current) => current as unknown as Selection,
  isEqual: EqualityFn<Selection> = Object.is,
): Selection {
  return useExternalStoreSelector(subscribe, getThemeState, selector, isEqual);
}

export function setAccentColor(value: string): void {
  emit(deriveTheme(value, state.mode));
}

export function setThemeMode(mode: ThemeMode): void {
  emit(deriveTheme(state.rawAccent, mode));
}

export function resetAccentColor(): void {
  setAccentColor(DEFAULT_ACCENT);
}

applyTheme();
