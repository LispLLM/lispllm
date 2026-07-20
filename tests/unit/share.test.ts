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

  it('round-trips a compact custom-source patch and workspace context', () => {
    const bundledSource = '(define temperature 0.8)\n(define width 64)\n';
    const source = '(define temperature 1.2)\n(define width 64)\n';
    const encoded = encodeShare({
      seed: 7,
      knobEdits: [],
      replHistory: [],
      source,
      bundledSource,
      lesson: 5,
      rightTab: 'environment',
    });
    expect(encoded.overflow).toBe(false);
    expect(decodeShare(encoded.hash, bundledSource)).toEqual({
      seed: 7,
      knobEdits: [],
      replHistory: [],
      source,
      lesson: 5,
      rightTab: 'environment',
    });
  });

  it('rejects a source patch against a different bundled model', () => {
    const encoded = encodeShare({
      seed: 7,
      knobEdits: [],
      replHistory: [],
      source: '(define x 2)',
      bundledSource: '(define x 1)',
    });
    expect(decodeShare(encoded.hash, '(define x 0)')).toBeNull();
  });

  it('reports exact-state overflow instead of silently dropping custom source', () => {
    const encoded = encodeShare({
      seed: 7,
      knobEdits: [],
      replHistory: ['(display 1)'],
      source: `prefix-${'x'.repeat(5_000)}-suffix`,
      bundledSource: 'prefix-suffix',
    });
    expect(encoded.overflow).toBe(true);
    expect(encoded.hash).toBe('');
    expect(encoded.serialized).toContain('"v":3');
    const exported = JSON.parse(encoded.serialized) as {
      source: string;
      replHistory: string[];
    };
    expect(exported.source).toContain('x'.repeat(5_000));
    expect(exported.replHistory).toEqual(['(display 1)']);
  });

  it('keeps decoding legacy v2 links', () => {
    const payload = JSON.stringify({
      v: 2,
      seed: 19,
      k: [],
      h: ['(help)'],
      l: 3,
      r: 'trace',
    });
    const hash = `#s=${btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
    expect(decodeShare(hash)).toEqual({
      seed: 19,
      knobEdits: [],
      replHistory: ['(help)'],
      lesson: 3,
      rightTab: 'trace',
    });
  });

  it('rejects v3 bundled state when the model fingerprint differs', () => {
    const encoded = encodeShare({
      seed: 19,
      knobEdits: [],
      replHistory: [],
      bundledSource: '(define bundled-version 3)',
    });
    expect(decodeShare(encoded.hash, '(define bundled-version 4)')).toBeNull();
  });
});
