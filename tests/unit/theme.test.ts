import { describe, expect, it } from 'vitest';
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  THEME_SURFACES,
  contrastRatio,
  deriveTheme,
  normalizeHex,
} from '../../src/store/theme-store';

describe('appearance theme', () => {
  it('normalizes valid colors and rejects malformed input', () => {
    expect(normalizeHex('#aabbcc')).toBe('#aabbcc');
    expect(normalizeHex('55C7D9')).toBe('#55c7d9');
    expect(normalizeHex('#ABC')).toBeNull();
    expect(normalizeHex('#abcd')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
  });

  it('derives an AA-contrast display accent for every mode, preset, and extreme color', () => {
    for (const mode of ['dark', 'light'] as const) {
      const surfaces = THEME_SURFACES[mode];
      for (const raw of [...ACCENT_PRESETS.map((preset) => preset.value), '#000000', '#ffffff']) {
        const theme = deriveTheme(raw, mode);
        expect(theme.mode).toBe(mode);
        expect(contrastRatio(theme.accent, surfaces.canvas)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.accent, surfaces.panel)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.accent, surfaces.chrome)).toBeGreaterThanOrEqual(4.5);
        expect(theme.foreground).toBe(surfaces.canvas);
        expect(contrastRatio(theme.foreground, theme.accent)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('preserves the raw choice while deriving mode-specific display colors', () => {
    const dark = deriveTheme('#55c7d9', 'dark');
    const light = deriveTheme('#55c7d9', 'light');
    expect(dark.rawAccent).toBe('#55c7d9');
    expect(light.rawAccent).toBe('#55c7d9');
    expect(dark.accent).toBe('#55c7d9');
    expect(light.accent).not.toBe('#55c7d9');
    expect(dark.foreground).toBe(THEME_SURFACES.dark.canvas);
    expect(light.foreground).toBe(THEME_SURFACES.light.canvas);
  });

  it('falls back to Amber for malformed stored-style values', () => {
    expect(deriveTheme('not-a-color').rawAccent).toBe(DEFAULT_ACCENT);
    expect(contrastRatio('not-a-color', '#ffffff')).toBe(1);
  });
});
