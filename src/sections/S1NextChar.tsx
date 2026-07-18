/**
 * §1 — "It only ever does one thing." Text input; each keystroke (debounced
 * 50 ms) runs an untraced forward and renders the top-10 next-char ProbBars.
 */
import { useEffect, useState } from 'react';
import ProbBars from '../components/ProbBars';
import { getImage, useAppState } from '../store/app-store';
import Cite from '../components/Cite';

export default function S1NextChar({
  labOnly = false,
  active = true,
}: {
  labOnly?: boolean;
  active?: boolean;
}) {
  const { status } = useAppState();
  const [input, setInput] = useState('The king said');
  const [probs, setProbs] = useState<Float32Array | null>(null);

  useEffect(() => {
    if (status !== 'ready' || input.length === 0) return;
    const t = setTimeout(() => {
      try {
        setProbs(Float32Array.from(getImage().probs(input)));
      } catch {
        setProbs(null);
      }
    }, 50);
    return () => clearTimeout(t);
  }, [input, status]);

  return (
    <section
      id="sec-1"
      hidden={labOnly && !active}
      className={labOnly ? 'min-w-0 p-3' : 'mx-auto max-w-4xl px-4 py-16'}
    >
      {!labOnly && (
        <>
          <h2 className="text-2xl text-paper">§1 It only ever does one thing.</h2>
          <p className="mt-3 max-w-measure text-dim">
            Type below. After every keystroke the model reads your whole text and produces one
            distribution: the probability of each possible next character. Everything ChatGPT does
            is this, at scale, in a loop <Cite n={12} />.
          </p>
        </>
      )}
      <div className={`${labOnly ? '' : 'mt-6'} grid min-w-0 gap-4 xl:grid-cols-2`}>
        <textarea
          data-testid="s1-input"
          aria-label="prompt text"
          value={input}
          rows={4}
          spellCheck={false}
          className="rounded border border-edge bg-panel p-3 font-mono text-sm text-paper outline-none focus:border-amber"
          onChange={(e) => setInput(e.target.value)}
        />
        <div data-testid="s1-probs">
          {probs && status === 'ready' && (
            <ProbBars probs={probs} charset={getImage().checkpoint.manifest.charset} />
          )}
        </div>
      </div>
      {!labOnly && (
        <p className="mt-6 text-sm text-dim">
          try: end your text mid-word and watch it finish the word
        </p>
      )}
    </section>
  );
}
