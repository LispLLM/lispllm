import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from '../../src/store/share';

describe('share codec', () => {
  it('round-trips state', () => {
    const state = {
      seed: 1337,
      knobEdits: [{ at: 1042, text: '1.5' }],
      replHistory: ['(set! temperature 1.5)', "(generate '(20) 10)"],
    };
    const { hash, dropped } = encodeShare(state);
    expect(dropped).toBe(0);
    expect(hash.startsWith('#s=')).toBe(true);
    expect(decodeShare(hash)).toEqual(state);
  });

  it('drops oldest history entries to fit 2 KB', () => {
    const state = {
      seed: 1,
      knobEdits: [],
      replHistory: Array.from({ length: 100 }, (_, i) => `(define x${i} ${'9'.repeat(40)})`),
    };
    const { hash, dropped } = encodeShare(state);
    expect(hash.length).toBeLessThanOrEqual(2048);
    expect(dropped).toBeGreaterThan(0);
    const restored = decodeShare(hash);
    expect(restored?.replHistory.at(-1)).toBe(state.replHistory.at(-1));
  });

  it('rejects malformed hashes', () => {
    expect(decodeShare('#s=!!!')).toBeNull();
    expect(decodeShare('#sec-3')).toBeNull();
    expect(decodeShare('#s=' + btoa('{"v":9}'))).toBeNull();
  });

  it('survives unicode in history', () => {
    const state = { seed: 2, knobEdits: [], replHistory: ['(display "héllo — ⏎")'] };
    expect(decodeShare(encodeShare(state).hash)).toEqual(state);
  });
});
