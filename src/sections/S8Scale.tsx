/** §8 — "What ChatGPT has that this doesn't." Honest scale comparison. */
import { useMemo } from 'react';
import Cite from '../components/Cite';
import { getImage, useAppState } from '../store/app-store';

// labeled static constants for comparison (not computed — they can't be)
const COMPARISONS = [
  { name: 'GPT-2', params: 1.5e9, note: 'static constant' },
  { name: 'a frontier model (order of magnitude)', params: 1e12, note: 'static constant' },
];

export default function S8Scale({
  labOnly = false,
  active = true,
}: {
  labOnly?: boolean;
  active?: boolean;
}) {
  const imageVersion = useAppState((current) => current.imageVersion);
  const img = getImage();

  const params = useMemo(() => {
    void imageVersion;
    return img.checkpoint.manifest.tensors.reduce(
      (a, t) => a + t.shape.reduce((x, y) => x * y, 1),
      0,
    );
  }, [img, imageVersion]);

  const bars = [{ name: 'this page', params, note: 'from the manifest' }, ...COMPARISONS];
  const logMax = Math.log10(1e12);
  const logMin = Math.log10(1e5);

  return (
    <section
      id="sec-8"
      hidden={labOnly && !active}
      className={labOnly ? 'min-w-0 p-3 font-mono' : 'mx-auto max-w-measure px-4 py-16 font-mono'}
    >
      {!labOnly && (
        <>
          <h2 className="mb-4 text-xl text-paper">;; §8 what chatgpt has that this doesn't</h2>
          <div className="mb-6 space-y-3 text-sm leading-6 text-dim">
            <p>
              Honesty section. This model lacks: BPE tokenization (it reads characters, not word
              pieces); a KV cache (§0 recomputes the whole context for every character, which is
              O(T²) — real systems cache k and v per layer); instruction tuning and RLHF (it
              continues text, it doesn't converse); mixture-of-experts; and above all, scale
              <Cite n={11} />.
            </p>
            <p>
              The architecture, though — the thing you scrolled through — is the same
              <Cite n={3} />. Scale is a quantity, not a different kind of thing.
            </p>
          </div>
        </>
      )}

      <div className="mb-6 space-y-2" data-testid="s8-scale-bar">
        {bars.map((b) => {
          const w = ((Math.log10(b.params) - logMin) / (logMax - logMin)) * 100;
          return (
            <div key={b.name} className="text-xs">
              <div className="mb-0.5 flex justify-between text-dim">
                <span className={b.name === 'this page' ? 'text-amber' : ''}>{b.name}</span>
                <span>
                  {b.params >= 1e12
                    ? '~1T'
                    : b.params >= 1e9
                      ? `${(b.params / 1e9).toFixed(1)}B`
                      : `${Math.round(b.params / 1e3)}k`}{' '}
                  params <span className="text-dim">({b.note})</span>
                </span>
              </div>
              <div
                className={`h-3 rounded-sm ${b.name === 'this page' ? 'bg-amber' : 'bg-edge'}`}
                style={{ width: `${Math.max(2, w)}%` }}
              />
            </div>
          );
        })}
        <div className="text-right text-[10px] text-dim">log scale</div>
      </div>

      {!labOnly && (
        <>
          <p className="mb-4 text-sm leading-6 text-dim">
            Want more? The repo has <span className="text-paper">train.py</span> — train your own
            tonight, it's included. Then watch Karpathy build the real thing from zero
            <Cite n={4} />.
          </p>
          <p className="mt-3 text-sm text-dim">
            try: <span className="text-amber">(length layers)</span>
          </p>
          <footer className="mt-16 border-t border-edge pt-6 text-center text-sm text-dim">
            (made-with (lots-of '(parens)))
          </footer>
        </>
      )}
    </section>
  );
}
