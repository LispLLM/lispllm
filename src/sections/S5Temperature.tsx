/** §5 — "Temperature is one number in the code." */
import { useMemo, useState } from 'react';
import type { Ast } from '../lisp/types';
import { isTensor } from '../lisp/types';
import Cite from '../components/Cite';
import CodePanel from '../components/CodePanel';
import KernelRef from '../components/KernelRef';
import { entropyBits } from '../model/queries';
import { Rng } from '../tensor/rng';
import { lastRow, sample as sampleK } from '../tensor/kernels';
import { list } from '../lisp/types';
import { applyKnobEdit, getImage, removeKnobEdit, useAppState } from '../store/app-store';

const TEMPS = [0.2, 0.8, 1.5];
const SAMPLE_LEN = 48;

/** Find the canonical span of the sample argument inside next-token (for top-k wrap). */
function findScaleExpr(img: ReturnType<typeof getImage>): Ast | null {
  for (const f of img.canonicalForms) {
    if (
      f.kind === 'list' &&
      f.items[0]?.kind === 'sym' &&
      f.items[0].name === 'define' &&
      f.items[1]?.kind === 'list' &&
      f.items[1].items[0]?.kind === 'sym' &&
      f.items[1].items[0].name === 'next-token'
    ) {
      const body = f.items[2];
      if (body?.kind === 'list' && body.items[0]?.kind === 'sym' && body.items[0].name === 'sample')
        return body.items[1] ?? null;
    }
  }
  return null;
}

export default function S5Temperature() {
  const { imageVersion, focusString, knobEdits } = useAppState();
  const img = getImage();
  const [helpFor, setHelpFor] = useState<string | null>(null);

  const tempSpan = useMemo(() => img.canonicalSpanFor('temperature'), [img]);
  const scaleExpr = useMemo(() => findScaleExpr(img), [img]);
  const topKOn = scaleExpr != null && knobEdits.some((e) => e.at === scaleExpr.span.start);

  const temperature = useMemo(() => {
    void imageVersion;
    const t = img.lookup('temperature');
    return typeof t === 'number' ? t : 0.8;
  }, [img, imageVersion]);

  const focus = focusString || 'To be, or not to be';

  const entropy = useMemo(() => {
    void imageVersion;
    try {
      return entropyBits(img.probs(focus));
    } catch {
      return null;
    }
  }, [img, focus, imageVersion]);

  // three parallel samples at fixed temperatures (seeded, native kernels only)
  const samples = useMemo(() => {
    void imageVersion;
    try {
      return TEMPS.map((T) => {
        const rng = new Rng(42);
        let tokens = img.tokenizer.encode(focus);
        const ctx = img.checkpoint.manifest.ctx;
        for (let i = 0; i < SAMPLE_LEN; i++) {
          const out = img.call('gpt', list(...tokens.slice(-ctx)));
          if (!isTensor(out)) throw new Error('no tensor');
          const l = lastRow(out);
          tokens = [...tokens, sampleK({ shape: l.shape, data: l.data.map((x) => x / T) }, rng)];
        }
        return img.tokenizer.decode(tokens.slice(-SAMPLE_LEN));
      });
    } catch {
      return null;
    }
  }, [img, focus, imageVersion]);

  const setTemp = (t: number) => {
    if (tempSpan == null) return;
    applyKnobEdit({ at: tempSpan, text: t.toFixed(2).replace(/0$/, '') });
  };

  const toggleTopK = () => {
    if (!scaleExpr) return;
    if (topKOn) removeKnobEdit(scaleExpr.span.start);
    else {
      const orig = img.canonicalSource.slice(scaleExpr.span.start, scaleExpr.span.end);
      applyKnobEdit({ at: scaleExpr.span.start, text: `(top-k 40 ${orig})` });
    }
  };

  return (
    <section id="sec-5" className="mx-auto max-w-measure px-4 py-16 font-mono">
      <h2 className="mb-4 text-xl text-paper">;; §5 temperature is one number in the code</h2>
      <p className="mb-4 text-sm leading-6 text-dim">
        Before sampling, the logits are divided by <span className="text-paper">temperature</span>
        . Low values sharpen the distribution toward the single most likely character; high values
        flatten it toward noise
        <Cite n={11} />. The knob below edits the literal in the source — drag it and watch the{' '}
        <span className="text-paper">0.8</span> change, here and in §6. It works the other way too:{' '}
        <span className="text-paper">(set! temperature 2.0)</span> in the REPL moves the knob. One
        image.
      </p>

      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="s5-knob" className="text-sm text-dim">
          temperature
        </label>
        <input
          id="s5-knob"
          data-testid="s5-knob"
          type="range"
          min={0.1}
          max={3}
          step={0.05}
          value={temperature}
          className="w-64 accent-amber"
          onChange={(e) => setTemp(Number(e.target.value))}
        />
        <span className="text-amber" data-testid="s5-temp-value">
          {temperature.toFixed(2)}
        </span>
        {entropy !== null && (
          <span className="text-xs text-dim" data-testid="s5-entropy">
            entropy {entropy.toFixed(2)} bits
          </span>
        )}
      </div>

      <div className="mb-4">
        <button
          data-testid="s5-topk"
          aria-pressed={topKOn}
          className={`rounded border px-3 py-1 text-sm ${
            topKOn ? 'border-amber text-amber' : 'border-edge text-dim hover:text-paper'
          }`}
          onClick={toggleTopK}
        >
          {topKOn ? '(top-k 40 …) — on' : 'wrap in (top-k 40 …)'}
        </button>
      </div>

      {samples && (
        <div className="mb-4 grid gap-2 sm:grid-cols-3" data-testid="s5-samples">
          {TEMPS.map((T, i) => (
            <div key={T} className="rounded border border-edge bg-panel p-2">
              <div className="mb-1 text-xs text-dim">T = {T}</div>
              <pre className="whitespace-pre-wrap text-xs text-paper">{samples[i]}</pre>
            </div>
          ))}
        </div>
      )}

      <CodePanel
        forms={['temperature', 'next-token']}
        onPrimitiveHelp={setHelpFor}
        editable={(() => {
          const lit = img.findDefineLiteral('temperature');
          if (!lit) return undefined;
          const base = temperature;
          return [
            {
              nodeId: lit.id,
              onDrag: (dx: number) => setTemp(Math.min(3, Math.max(0.1, base + dx * 0.01))),
            },
          ];
        })()}
        testId="s5-code"
      />
      {helpFor && <KernelRef name={helpFor} onClose={() => setHelpFor(null)} />}
      <p className="mt-3 text-sm text-dim">
        try: <span className="text-amber">(set! temperature 2.0)</span>
      </p>
    </section>
  );
}
