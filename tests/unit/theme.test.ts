import { describe, expect, it } from 'vitest';
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  contrastRatio,
  deriveTheme,
  normalizeHex,
} from '../../src/store/theme-store';

describe('accent theme', () => {
  it('normalizes valid colors and rejects malformed input', () => {
    expect(normalizeHex('#aabbcc')).toBe('#aabbcc');
    expect(normalizeHex('55C7D9')).toBe('#55c7d9');
    expect(normalizeHex('#ABC')).toBeNull();
    expect(normalizeHex('#abcd')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
  });

  it('derives an AA-contrast display accent from every preset and extreme custom colors', () => {
    for (const raw of [...ACCENT_PRESETS.map((preset) => preset.value), '#000000', '#ffffff']) {
      const theme = deriveTheme(raw);
      expect(contrastRatio(theme.accent, '#0f0e0c')).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.accent, '#181613')).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.foreground, theme.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('preserves the raw choice while deriving display and foreground colors', () => {
    const theme = deriveTheme('#55c7d9');
    expect(theme.rawAccent).toBe('#55c7d9');
    expect(theme.accent).toBe('#55c7d9');
    expect(['#0f0e0c', '#e8e4dc']).toContain(theme.foreground);
  });

  it('falls back to Amber for malformed stored-style values', () => {
    expect(deriveTheme('not-a-color').rawAccent).toBe(DEFAULT_ACCENT);
  });
});
