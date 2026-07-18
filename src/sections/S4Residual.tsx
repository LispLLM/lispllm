/** §4 — "The residual stream." Contribution norms + the ablation lab. */
import { useEffect, useMemo, useState } from 'react';
import { useNearViewport } from '../components/useNearViewport';
import Cite from '../components/Cite';
import CodePanel from '../components/CodePanel';
import KernelRef from '../components/KernelRef';
import { residualContributions } from '../model/queries';
import { getImage, replSubmit, useAppState } from '../store/app-store';

const CONT_CHARS = 60;

export default function S4Residual({
  labOnly = false,
  active = true,
}: {
  labOnly?: boolean;
  active?: boolean;
}) {
  const { imageVersion, focusString, trace, sourceDirty } = useAppState();
  const img = getImage();
  const dims = img.checkpoint.manifest.dims;
  const [helpFor, setHelpFor] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<{ text: string; nll: number } | null>(null);
  const { ref: sectionRef, visible } = useNearViewport<HTMLElement>();
  const shouldCompute = labOnly ? active : visible;

  const focus = focusString || 'To be, or not to be';

  const contribs = useMemo(
    () => (trace ? residualContributions(trace, img.program, dims.n_layer) : []),
    [trace, img, dims.n_layer],
  );
  const maxNorm = Math.max(1e-9, ...contribs.flatMap((c) => [c.attn, c.mlp]));

  // which heads are currently ablated, read from the image (code is truth)
  const ablated = useMemo(() => {
    void imageVersion;
    const set = new Set<string>();
    try {
      let v = img.lookup('ablated');
      while (v && typeof v === 'object' && 'car' in v) {
        const p = v.car as { car: number; cdr: number };
        if (p && typeof p === 'object') set.add(`${p.car}.${p.cdr}`);
        v = (v as { cdr: unknown }).cdr as typeof v;
      }
    } catch {
      /* not bound */
    }
    return set;
  }, [img, imageVersion]);

  const computeContinuation = () => {
    try {
      let text = focus;
      for (let i = 0; i < CONT_CHARS; i++) text += img.tokenizer.decode([img.greedyNext(text)]);
      return { text: text.slice(focus.length), nll: img.nll(focus) };
    } catch {
      return null;
    }
  };

  const current = useMemo(() => {
    void imageVersion;
    if (!shouldCompute) return null;
    return computeContinuation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, focus, imageVersion, shouldCompute]);

  // remember the un-ablated continuation as the baseline for the diff
  useEffect(() => {
    if (current && ablated.size === 0) setBaseline(current);
  }, [current, ablated]);

  const toggle = (l: number, h: number) => {
    // capture the un-ablated baseline now if the deferred compute hasn't run yet
    if (ablated.size === 0 && !baseline) {
      const c = current ?? computeContinuation();
      if (c) setBaseline(c);
    }
    const next = new Set(ablated);
    const key = `${l}.${h}`;
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const pairs = [...next]
      .sort()
      .map((k) => {
        const [a, b] = k.split('.');
        return `(${a} . ${b})`;
      })
      .join(' ');
    replSubmit(`(set! ablated '(${pairs}))`, true);
  };

  const ppl = (nll: number) => Math.exp(nll);

  return (
    <section
      ref={sectionRef}
      id="sec-4"
      hidden={labOnly && !active}
      className={labOnly ? 'min-w-0 p-3 font-mono' : 'mx-auto max-w-measure px-4 py-16 font-mono'}
    >
      {!labOnly && (
        <>
          <h2 className="mb-4 text-xl text-paper">;; §4 the residual stream</h2>
          <p className="mb-4 text-sm leading-6 text-dim">
            Layers don't replace the representation; they add to it. Each block reads from a shared
            stream, computes a correction, and writes it back — that's the two{' '}
            <span className="text-paper">add</span> calls in{' '}
            <span className="text-paper">block</span>
            <Cite n={9} />. The bars show how loudly each layer speaks. Below, the ablation lab:
            switch off any head and <span className="text-paper">ablated</span> changes in the code
            — watch the REPL echo, then read what the wounded model writes
            <Cite n={8} />.
          </p>
        </>
      )}

      {contribs.length > 0 && (
        <div className="mb-6 space-y-2" data-testid="s4-stream">
          {contribs.map((c, l) => (
            <div key={l} className="flex items-center gap-2 text-xs">
              <span className="w-14 text-dim">layer {l}</span>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 bg-amber/70"
                    style={{ width: `${(c.attn / maxNorm) * 60}%` }}
                  />
                  <span className="text-dim">‖attention(x)‖ {c.attn.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 bg-[#8fb0c0]/70"
                    style={{ width: `${(c.mlp / maxNorm) * 60}%` }}
                  />
                  <span className="text-dim">‖mlp(x)‖ {c.mlp.toFixed(1)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4" data-testid="s4-ablation-grid">
        <div className="mb-1 text-xs text-dim">ablation lab — click to silence a head:</div>
        {Array.from({ length: dims.n_layer }, (_, l) => (
          <div key={l} className="mb-1 flex gap-1">
            {Array.from({ length: dims.n_head }, (_, h) => {
              const on = ablated.has(`${l}.${h}`);
              return (
                <button
                  key={h}
                  data-testid={`s4-abl-${l}-${h}`}
                  aria-pressed={on}
                  disabled={sourceDirty}
                  title={sourceDirty ? 'Run or revert the editor draft first' : undefined}
                  className={`h-8 w-14 rounded border text-xs ${
                    on
                      ? 'border-red-400 bg-red-400/20 text-red-300 line-through'
                      : 'border-edge text-dim hover:text-paper'
                  }`}
                  onClick={() => toggle(l, h)}
                >
                  L{l}·H{h}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {current && (
        <div className="mb-4 space-y-2 text-sm" data-testid="s4-diff">
          {baseline && ablated.size > 0 && (
            <div>
              <div className="text-xs text-dim">before (all heads):</div>
              <pre className="whitespace-pre-wrap rounded border border-edge bg-panel p-2 text-paper">
                {focus}
                <span className="text-dim">{baseline.text}</span>
              </pre>
            </div>
          )}
          <div>
            <div className="text-xs text-dim">
              {ablated.size > 0
                ? `after (${ablated.size} head${ablated.size > 1 ? 's' : ''} silenced):`
                : 'greedy continuation:'}
            </div>
            <pre className="whitespace-pre-wrap rounded border border-edge bg-panel p-2 text-paper">
              {focus}
              <span className={ablated.size > 0 ? 'text-amber' : 'text-dim'}>{current.text}</span>
            </pre>
          </div>
          <div className="text-xs text-dim" data-testid="s4-ppl">
            perplexity of the focus string: {ppl(current.nll).toFixed(2)}
            {baseline && ablated.size > 0 && (
              <span className="text-amber">
                {' '}
                (Δ {ppl(current.nll) - ppl(baseline.nll) >= 0 ? '+' : ''}
                {(ppl(current.nll) - ppl(baseline.nll)).toFixed(2)} vs{' '}
                {ppl(baseline.nll).toFixed(2)})
              </span>
            )}
          </div>
        </div>
      )}

      <CodePanel
        forms={['ablated', 'attention', 'block']}
        onPrimitiveHelp={setHelpFor}
        testId="s4-code"
      />
      {helpFor && <KernelRef name={helpFor} onClose={() => setHelpFor(null)} />}
      {!labOnly && (
        <p className="mt-3 text-sm text-dim">
          try: <span className="text-amber">(set! ablated '((0 . 0) (0 . 1)))</span>
        </p>
      )}
    </section>
  );
}
