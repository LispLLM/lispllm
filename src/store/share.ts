/**
 * Share codec (§12.4): `#s=` base64url JSON of {seed, knobEdits, replHistory}.
 * Cap 2 KB; if exceeded, drop the oldest history entries (caller toasts).
 */
import type { KnobEdit } from '../model/image';

export interface ShareState {
  seed: number;
  knobEdits: KnobEdit[];
  replHistory: string[];
  /** Exact applied source for v2/v3 custom-source shares. */
  source?: string;
  lesson?: number;
  rightTab?: 'lesson' | 'trace' | 'environment' | 'references' | 'model';
}

interface SourcePatch {
  /** shared prefix length */
  p: number;
  /** shared suffix length */
  s: number;
  /** replacement middle */
  i: string;
  /** fingerprint of the bundled base source */
  f: string;
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

export function sourceFingerprint(source: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function makeSourcePatch(base: string, source: string): SourcePatch {
  let prefix = 0;
  while (prefix < base.length && prefix < source.length && base[prefix] === source[prefix])
    prefix++;
  let suffix = 0;
  while (
    suffix < base.length - prefix &&
    suffix < source.length - prefix &&
    base[base.length - 1 - suffix] === source[source.length - 1 - suffix]
  ) {
    suffix++;
  }
  return {
    p: prefix,
    s: suffix,
    i: source.slice(prefix, source.length - suffix),
    f: sourceFingerprint(base),
  };
}

function applySourcePatch(base: string, patch: SourcePatch): string | null {
  if (sourceFingerprint(base) !== patch.f) return null;
  if (patch.p < 0 || patch.s < 0 || patch.p + patch.s > base.length) return null;
  return base.slice(0, patch.p) + patch.i + base.slice(base.length - patch.s);
}

function isSourcePatch(value: unknown): value is SourcePatch {
  if (!value || typeof value !== 'object') return false;
  const patch = value as Partial<SourcePatch>;
  return (
    Number.isInteger(patch.p) &&
    Number.isInteger(patch.s) &&
    typeof patch.i === 'string' &&
    typeof patch.f === 'string'
  );
}

/** Encode; drops oldest history entries until ≤ 2 KB. Reports drops. */
export function encodeShare(state: ShareState & { bundledSource?: string }): {
  hash: string;
  dropped: number;
  overflow: boolean;
  serialized: string;
} {
  let history = [...state.replHistory];
  let dropped = 0;
  const exactExport = JSON.stringify({
    format: 'lispllm-state',
    v: 3,
    seed: state.seed,
    knobEdits: state.knobEdits,
    replHistory: state.replHistory,
    source: state.source,
    bundledFingerprint:
      state.bundledSource === undefined ? undefined : sourceFingerprint(state.bundledSource),
    lesson: state.lesson,
    rightTab: state.rightTab,
  });
  for (;;) {
    const patch =
      state.source !== undefined && state.bundledSource !== undefined
        ? makeSourcePatch(state.bundledSource, state.source)
        : undefined;
    const serialized = JSON.stringify({
      v: 3,
      seed: state.seed,
      k: patch ? [] : state.knobEdits,
      h: history,
      x: patch,
      b: state.bundledSource === undefined ? undefined : sourceFingerprint(state.bundledSource),
      l: state.lesson,
      r: state.rightTab,
    });
    const hash = `#s=${b64urlEncode(serialized)}`;
    if (hash.length <= CAP) return { hash, dropped, overflow: false, serialized };
    if (history.length === 0) return { hash: '', dropped, overflow: true, serialized: exactExport };
    history = history.slice(1);
    dropped++;
  }
}

export function decodeShare(hash: string, bundledSource?: string): ShareState | null {
  const m = /^#s=(.+)$/.exec(hash);
  if (!m) return null;
  try {
    const o = JSON.parse(b64urlDecode(m[1])) as {
      v: number;
      seed: number;
      k: KnobEdit[];
      h: string[];
      x?: unknown;
      b?: unknown;
      l?: number;
      r?: ShareState['rightTab'];
    };
    if (
      ![1, 2, 3].includes(o.v) ||
      typeof o.seed !== 'number' ||
      !Array.isArray(o.k) ||
      !Array.isArray(o.h)
    )
      return null;
    if (
      o.v === 3 &&
      typeof o.b === 'string' &&
      (bundledSource === undefined || sourceFingerprint(bundledSource) !== o.b)
    )
      return null;
    if (o.x !== undefined && (!isSourcePatch(o.x) || bundledSource === undefined)) return null;
    const source = o.x ? applySourcePatch(bundledSource!, o.x) : undefined;
    if (o.x && source === null) return null;
    const rightTabs: NonNullable<ShareState['rightTab']>[] = [
      'lesson',
      'trace',
      'environment',
      'references',
      'model',
    ];
    const rightTab = rightTabs.find((tab) => tab === o.r);
    return {
      seed: o.seed,
      knobEdits: o.k,
      replHistory: o.h,
      ...(source !== null && source !== undefined ? { source } : {}),
      ...(Number.isInteger(o.l) && o.l! >= 0 && o.l! <= 8 ? { lesson: o.l } : {}),
      ...(rightTab ? { rightTab } : {}),
    };
  } catch {
    return null;
  }
}
