/**
 * Share codec (§12.4): `#s=` base64url JSON of {seed, knobEdits, replHistory}.
 * Cap 2 KB; if exceeded, drop the oldest history entries (caller toasts).
 */
import type { KnobEdit } from '../model/image';

export interface ShareState {
  seed: number;
  knobEdits: KnobEdit[];
  replHistory: string[];
}

const CAP = 2048;

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Encode; drops oldest history entries until ≤ 2 KB. Reports drops. */
export function encodeShare(state: ShareState): { hash: string; dropped: number } {
  let history = [...state.replHistory];
  let dropped = 0;
  for (;;) {
    const hash = `#s=${b64urlEncode(
      JSON.stringify({ v: 1, seed: state.seed, k: state.knobEdits, h: history }),
    )}`;
    if (hash.length <= CAP || history.length === 0) return { hash, dropped };
    history = history.slice(1);
    dropped++;
  }
}

export function decodeShare(hash: string): ShareState | null {
  const m = /^#s=(.+)$/.exec(hash);
  if (!m) return null;
  try {
    const o = JSON.parse(b64urlDecode(m[1])) as {
      v: number;
      seed: number;
      k: KnobEdit[];
      h: string[];
    };
    if (o.v !== 1 || typeof o.seed !== 'number' || !Array.isArray(o.k) || !Array.isArray(o.h))
      return null;
    return { seed: o.seed, knobEdits: o.k, replHistory: o.h };
  } catch {
    return null;
  }
}
