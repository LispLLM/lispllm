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
const INK = '#0f0e0c';
const PANEL = '#181613';
const PAPER = '#e8e4dc';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface ThemeState {
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
  const first = luminance(toRgb(normalizeHex(a) ?? DEFAULT_ACCENT));
  const second = luminance(toRgb(normalizeHex(b) ?? INK));
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function mixWithWhite(rgb: Rgb, amount: number): Rgb {
  return {
    r: rgb.r + (255 - rgb.r) * amount,
    g: rgb.g + (255 - rgb.g) * amount,
    b: rgb.b + (255 - rgb.b) * amount,
  };
}

export function deriveTheme(value: string): ThemeState {
  const rawAccent = normalizeHex(value) ?? DEFAULT_ACCENT;
  const raw = toRgb(rawAccent);
  let accent = rawAccent;
  for (let step = 0; step <= 100; step++) {
    const candidate = toHex(mixWithWhite(raw, step / 100));
    if (Math.min(contrastRatio(candidate, INK), contrastRatio(candidate, PANEL)) >= 4.5) {
      accent = candidate;
      break;
    }
  }
  const foreground = contrastRatio(accent, INK) >= contrastRatio(accent, PAPER) ? INK : PAPER;
  return { rawAccent, accent, foreground };
}

function load(): ThemeState {
  if (typeof localStorage === 'undefined') return deriveTheme(DEFAULT_ACCENT);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as {
      v?: number;
      accent?: unknown;
    };
    return deriveTheme(saved.v === 1 && typeof saved.accent === 'string' ? saved.accent : '');
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
  root.style.setProperty('--accent-rgb', rgbChannels(theme.accent));
  root.style.setProperty('--accent-foreground-rgb', rgbChannels(theme.foreground));
  root.style.setProperty('--accent', theme.accent);
}

function emit(next: ThemeState): void {
  if (
    next.rawAccent === state.rawAccent &&
    next.accent === state.accent &&
    next.foreground === state.foreground
  )
    return;
  state = next;
  applyTheme(state);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, accent: state.rawAccent }));
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
  emit(deriveTheme(value));
}

export function resetAccentColor(): void {
  setAccentColor(DEFAULT_ACCENT);
}

applyTheme();
