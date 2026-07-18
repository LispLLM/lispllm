/**
 * §0 Hero — "A language model in one page of Lisp."
 * (generate prompt 400) streams beside its own source. Play/pause/step +
 * cosmetic speed slider. Pause reveals live top-10 next-char ProbBars.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import CodePanel from '../components/CodePanel';
import ProbBars from '../components/ProbBars';
import { clearStaleGeneration, getImage, setFocusString, useAppState } from '../store/app-store';

const PROMPT = 'ROMEO: ';
const TOTAL = 400;

export default function S0Hero() {
  const { status, imageVersion, staleGeneration } = useAppState();
  const [text, setText] = useState(PROMPT);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(16); // chars/s, cosmetic pacing only
  const [probs, setProbs] = useState<Float32Array | null>(null);
  const tokens = useRef<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedFor = useRef(-1);

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
    if (status !== 'ready' || !playing) return;
    if (startedFor.current === -1) startedFor.current = imageVersion;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
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
  }, [status, playing, speed, step, updateProbs]);

  useEffect(() => {
    if (!playing && status === 'ready' && tokens.current.length > 0) updateProbs();
  }, [playing, status, updateProbs]);

  const regenerate = () => {
    tokens.current = [];
    setText(PROMPT);
    clearStaleGeneration();
    startedFor.current = imageVersion;
    setPlaying(true);
  };

  return (
    <section id="sec-0" className="mx-auto max-w-4xl px-4 pb-20 pt-16">
      <h1 className="text-3xl leading-tight text-paper">A language model in one page of Lisp.</h1>
      <p className="mt-3 max-w-measure text-dim">
        It's running in your browser right now. Every figure below is computed by the code beside
        it. Pause it. Poke it. Break it.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <CodePanel forms={['temperature', 'next-token', 'generate']} testId="hero-code" />
        <div>
          <div className="mb-2 flex items-center gap-3 text-sm">
            <button
              data-testid="hero-toggle"
              className="rounded border border-edge px-3 py-1 text-paper hover:border-amber"
              onClick={() => setPlaying(!playing)}
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
                className="accent-amber"
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
      <p className="mt-6 text-sm text-dim">
        try: press pause, then step through one character at a time
      </p>
    </section>
  );
}
