/**
 * ProbBars (§12.3): top-10 next-char probability bars with glyph labels,
 * percentages, 150 ms animation, honors prefers-reduced-motion.
 */

export interface ProbBarsProps {
  probs: Float32Array;
  charset: string;
  count?: number;
}

export function glyphFor(ch: string): string {
  if (ch === ' ') return '␣';
  if (ch === '\n') return '⏎';
  return ch;
}

export default function ProbBars({ probs, charset, count = 10 }: ProbBarsProps) {
  const idx = Array.from(probs.keys())
    .sort((a, b) => probs[b] - probs[a])
    .slice(0, count);
  const maxP = probs[idx[0]] ?? 1;
  return (
    <div data-testid="prob-bars" className="flex flex-col gap-1 font-mono text-sm">
      {idx.map((i) => (
        <div key={i} className="flex items-center gap-2" data-prob={probs[i]}>
          <span className="w-6 text-center text-paper">{glyphFor(charset[i] ?? '?')}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-sm bg-panel">
            <div
              className="h-full bg-amber transition-[width] duration-150 motion-reduce:transition-none"
              style={{ width: `${(probs[i] / maxP) * 100}%` }}
            />
          </div>
          <span className="w-14 text-right text-dim">{(probs[i] * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}
