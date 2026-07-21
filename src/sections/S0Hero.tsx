/**
 * §0 Hero — "A language model in one page of Lisp."
 * The tokenized `ROMEO: ` prompt streams beside its own source. Play/pause/step +
 * cosmetic speed slider. Pause reveals live top-10 next-char ProbBars.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import CodePanel from '../components/CodePanel';
import ProbBars from '../components/ProbBars';
import { clearStaleGeneration, getImage, setFocusString, useAppState } from '../store/app-store';
import { shallowEqual } from '../store/selector';
import { recordLearningEvent } from '../store/learning-store';

const PROMPT = 'ROMEO: ';
const TOTAL = 400;
const INTERACTION_QUIET_MS = 400;
const HERO_FORMS = ['temperature', 'next-token', 'generate'];

export default function S0Hero({
  labOnly = false,
  active = true,
}: {
  labOnly?: boolean;
  active?: boolean;
}) {
  const { status, imageVersion, staleGeneration } = useAppState(
    (current) => ({
      status: current.status,
      imageVersion: current.imageVersion,
      staleGeneration: current.staleGeneration,
    }),
    shallowEqual,
  );
  const [text, setText] = useState(PROMPT);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(8); // leaves main-thread time for editor interaction
  const [probs, setProbs] = useState<Float32Array | null>(null);
  const tokens = useRef<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedFor = useRef(-1);
  const lastInteraction = useRef(-Infinity);

  useEffect(() => {
    if (!active) return;
    const markInteraction = () => {
      lastInteraction.current = performance.now();
    };
    window.addEventListener('keydown', markInteraction, true);
    window.addEventListener('pointerdown', markInteraction, true);
    window.addEventListener('input', markInteraction, true);
    return () => {
      window.removeEventListener('keydown', markInteraction, true);
      window.removeEventListener('pointerdown', markInteraction, true);
      window.removeEventListener('input', markInteraction, true);
    };
  }, [active]);

  const step = useCallback(() => {
    const img = getImage();
    if (tokens.current.length === 0) tokens.current = img.tokenizer.encode(PROMPT);
    if (tokens.current.length >= TOTAL + PROMPT.length) return false;
    const t = img.sampleNextUi(tokens.current);
    tokens.current.push(t);
    const s = img.tokenizer.decode(tokens.current);
    setText(s);
    return true;
  }, []);

  const updateProbs = useCallback(() => {
    const img = getImage();
    const s = img.tokenizer.decode(
      tokens.current.length ? tokens.current : img.tokenizer.encode(PROMPT),
    );
    setProbs(Float32Array.from(img.probs(s)));
    setFocusString(s.slice(-64));
  }, []);

  // stream loop
  useEffect(() => {
    if (status !== 'ready' || !playing || !active) return;
    if (startedFor.current === -1) startedFor.current = imageVersion;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const quietFor = performance.now() - lastInteraction.current;
      if (quietFor < INTERACTION_QUIET_MS) {
        timer.current = setTimeout(tick, INTERACTION_QUIET_MS - quietFor);
        return;
      }
      const more = step();
      if (more) timer.current = setTimeout(tick, 1000 / speed);
      else {
        setPlaying(false);
        updateProbs();
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [status, imageVersion, playing, speed, step, updateProbs, active]);

  useEffect(() => {
    if (!playing && status === 'ready' && tokens.current.length > 0) updateProbs();
  }, [playing, status, updateProbs]);

  useEffect(() => {
    if (text.length >= PROMPT.length + 10) recordLearningEvent('hero:generated-10');
  }, [text.length]);

  const regenerate = () => {
    tokens.current = [];
    setText(PROMPT);
    clearStaleGeneration();
    startedFor.current = imageVersion;
    setPlaying(true);
  };

  return (
    <section
      id="sec-0"
      hidden={labOnly && !active}
      className={labOnly ? 'min-w-0 p-3' : 'mx-auto max-w-4xl px-4 pb-20 pt-16'}
    >
      {!labOnly && (
        <>
          <h1 className="text-3xl leading-tight text-paper">
            A language model in one page of Lisp.
          </h1>
          <p className="mt-3 max-w-measure text-dim">
            It's running in your browser right now. Every figure below is computed by the code
            beside it. Pause it. Poke it. Break it.
          </p>
        </>
      )}

      <div className={`${labOnly ? '' : 'mt-8'} grid min-w-0 gap-4 xl:grid-cols-2`}>
        <CodePanel forms={HERO_FORMS} testId="hero-code" active={active} />
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
            <button
              data-testid="hero-toggle"
              className="rounded border border-edge px-3 py-1 text-paper hover:border-amber"
              onClick={() => {
                if (playing) recordLearningEvent('hero:paused');
                setPlaying(!playing);
              }}
            >
              {playing ? 'pause' : 'play'}
            </button>
            <button
              data-testid="hero-step"
              className="rounded border border-edge px-3 py-1 text-paper hover:border-amber disabled:opacity-40"
              disabled={playing}
              onClick={() => {
                step();
                updateProbs();
                recordLearningEvent('hero:step');
              }}
            >
              step
            </button>
            <label className="flex items-center gap-2 text-dim">
              speed
              <input
                type="range"
                min={2}
                max={30}
                value={speed}
                className="max-w-24 accent-amber"
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
            </label>
          </div>
          {staleGeneration && startedFor.current !== imageVersion && (
            <button
              data-testid="regenerate-chip"
              className="mb-2 rounded-full border border-amber px-3 py-0.5 text-xs text-amber"
              onClick={regenerate}
            >
              definitions changed — regenerate
            </button>
          )}
          <pre
            data-testid="hero-output"
            className="h-72 overflow-y-auto whitespace-pre-wrap rounded border border-edge bg-panel p-4 font-mono text-sm leading-6 text-paper"
          >
            {text}
            <span className="cursor-blink text-amber">▍</span>
          </pre>
          {!playing && probs && (
            <div className="mt-4" data-testid="hero-probs">
              <ProbBars probs={probs} charset={getImage().checkpoint.manifest.charset} />
              <p className="mt-2 text-xs text-dim">
                It's picking the next character. That's all it ever does.
              </p>
            </div>
          )}
        </div>
      </div>
      {!labOnly && (
        <p className="mt-6 text-sm text-dim">
          try: press pause, then step through one character at a time
        </p>
      )}
    </section>
  );
}
