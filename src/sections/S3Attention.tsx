/** §3 — "Attention is three questions." The centerpiece. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Ast } from '../lisp/types';
import Cite from '../components/Cite';
import CodePanel from '../components/CodePanel';
import KernelRef from '../components/KernelRef';
import TensorView from '../components/TensorView';
import { attentionWeights, attentionValues, nodeSource } from '../model/queries';
import { getImage, setFocusString, useAppState } from '../store/app-store';

const DEFAULT_FOCUS = 'To be, or not to be: that is the question';
const glyph = (ch: string) => (ch === ' ' ? '␣' : ch === '\n' ? '⏎' : ch);

export default function S3Attention() {
  const { imageVersion, focusString, trace } = useAppState();
  const img = getImage();
  const dims = img.checkpoint.manifest.dims;
  const [layer, setLayer] = useState(0);
  const [head, setHead] = useState(0);
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null);
  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [maskHover, setMaskHover] = useState(false);
  const [weightsHover, setWeightsHover] = useState(false);
  const [helpFor, setHelpFor] = useState<string | null>(null);
  const [input, setInput] = useState(DEFAULT_FOCUS);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!focusString) setFocusString(DEFAULT_FOCUS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (focusString) setInput(focusString);
  }, [focusString]);

  const hit = useMemo(() => {
    void imageVersion;
    return trace ? attentionWeights(trace, img.program, layer, head) : null;
  }, [trace, img, layer, head, imageVersion]);

  const values = useMemo(
    () => (trace ? attentionValues(trace, img.program, layer, head) : null),
    [trace, img, layer, head],
  );

  const tokens = useMemo(() => {
    const ctx = img.checkpoint.manifest.ctx;
    return [...(focusString || '')].slice(-ctx);
  }, [focusString, img]);

  // top contributing source tokens for the selected query position: w[i][j]·||v_j||
  const contributions = useMemo(() => {
    if (!hit || !values || selectedPos === null) return [];
    const T = hit.tensor.shape[0];
    const dv = values.shape[1];
    if (selectedPos >= T) return [];
    const out: Array<{ j: number; score: number }> = [];
    for (let j = 0; j <= selectedPos; j++) {
      let n = 0;
      for (let c = 0; c < dv; c++) {
        const x = values.data[j * dv + c];
        n += x * x;
      }
      out.push({ j, score: hit.tensor.data[selectedPos * T + j] * Math.sqrt(n) });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 6);
  }, [hit, values, selectedPos]);

  const highlightIds = useMemo(() => {
    const ids = new Set<number>();
    if (!hit) return ids;
    if (hoverCell || weightsHover) ids.add(hit.node.id);
    return ids;
  }, [hit, hoverCell, weightsHover]);

  const onNodeHover = (node: Ast | null) => {
    if (!node) {
      setMaskHover(false);
      setWeightsHover(false);
      return;
    }
    const src = node.kind === 'list' ? nodeSource(img.program, node) : '';
    setMaskHover(src.startsWith('(causal-mask'));
    setWeightsHover(node.kind === 'sym' && node.name === 'weights');
  };

  const onFocusInput = (v: string) => {
    setInput(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => v.trim() && setFocusString(v), 200);
  };

  const strip = (kind: 'q' | 'k') => (
    <div className="flex flex-wrap gap-px" data-testid={`s3-${kind}-strip`}>
      {tokens.map((ch, i) => {
        const hl = hoverCell !== null && (kind === 'q' ? hoverCell[0] === i : hoverCell[1] === i);
        return (
          <span
            key={i}
            data-hl={hl ? kind : undefined}
            className={`inline-block min-w-[14px] rounded-sm px-0.5 text-center text-xs ${
              hl ? 'bg-amber text-ink' : 'text-dim'
            } ${kind === 'q' && selectedPos === i ? 'underline decoration-amber' : ''}`}
            onClick={() => kind === 'q' && setSelectedPos(i)}
          >
            {glyph(ch)}
          </span>
        );
      })}
    </div>
  );

  return (
    <section id="sec-3" className="mx-auto max-w-measure px-4 py-16 font-mono">
      <h2 className="mb-4 text-xl text-paper">;; §3 attention is three questions</h2>
      <p className="mb-4 text-sm leading-6 text-dim">
        Every position asks three questions of every earlier position: what am I looking for (q),
        what do you contain (k), and what will you pass along (v)
        <Cite n={1} />
        <Cite n={7} />. The matrix below is <span className="text-paper">weights</span> — how much
        each character (row) attends to each earlier character (column). Hover a cell to see the
        pair; the code that computed it lights up. The dark upper triangle is{' '}
        <span className="text-paper">causal-mask</span>: the future is hidden, always
        <Cite n={10} />.
      </p>

      <input
        data-testid="s3-focus"
        className="mb-4 w-full rounded border border-edge bg-panel px-3 py-2 text-sm text-paper outline-none focus:border-amber"
        value={input}
        onChange={(e) => onFocusInput(e.target.value)}
        aria-label="focus string"
      />

      <div className="mb-4 flex flex-wrap gap-2" data-testid="s3-picker">
        {Array.from({ length: dims.n_layer }, (_, l) =>
          Array.from({ length: dims.n_head }, (_, h) => (
            <button
              key={`${l}.${h}`}
              data-testid={`s3-pick-${l}-${h}`}
              aria-pressed={layer === l && head === h}
              className={`rounded border px-2 py-1 text-xs ${
                layer === l && head === h
                  ? 'border-amber text-amber'
                  : 'border-edge text-dim hover:text-paper'
              }`}
              onClick={() => {
                setLayer(l);
                setHead(h);
              }}
            >
              L{l}·H{h}
            </button>
          )),
        )}
      </div>

      {hit ? (
        <div className="mb-4 space-y-2">
          <div className="text-xs text-dim">keys (attended to) →</div>
          {strip('k')}
          <div className={`relative inline-block ${weightsHover ? 'ring-2 ring-amber' : ''}`}>
            <TensorView
              tensor={hit.tensor}
              maxWidth={560}
              onHover={(i, j) => setHoverCell([i, j])}
              onSelect={(i) => setSelectedPos(i)}
              highlight={hoverCell}
              ariaLabel={`attention weights layer ${layer} head ${head}`}
            />
            {maskHover && (
              <svg
                className="pointer-events-none absolute inset-0"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                data-testid="s3-mask-overlay"
              >
                <polygon points="100,0 0,0 100,100" fill="rgba(230,162,60,0.25)" />
              </svg>
            )}
          </div>
          <div className="text-xs text-dim">↑ queries (attending)</div>
          {strip('q')}
        </div>
      ) : (
        <p className="mb-4 text-sm text-dim">;; tracing the forward pass…</p>
      )}

      {selectedPos !== null && contributions.length > 0 && (
        <div className="mb-4 text-sm" data-testid="s3-contrib">
          <div className="mb-1 text-dim">
            top sources feeding position {selectedPos} ('
            {glyph(tokens[selectedPos] ?? '')}') — weights × ‖v‖:
          </div>
          {contributions.map(({ j, score }) => (
            <div key={j} className="flex items-center gap-2">
              <span className="w-8 text-amber">'{glyph(tokens[j] ?? '')}'</span>
              <div
                className="h-3 bg-amber/60"
                style={{
                  width: `${Math.min(100, (score / (contributions[0].score || 1)) * 100)}%`,
                  maxWidth: 240,
                }}
              />
              <span className="text-xs text-dim">{score.toFixed(3)}</span>
            </div>
          ))}
        </div>
      )}

      <CodePanel
        forms={['head']}
        highlightIds={highlightIds}
        onNodeHover={onNodeHover}
        onPrimitiveHelp={setHelpFor}
        testId="s3-code"
      />
      {helpFor && <KernelRef name={helpFor} onClose={() => setHelpFor(null)} />}
      <p className="mt-3 text-sm text-dim">
        try: <span className="text-amber">(shape (wq (nth 0 (heads (nth 0 layers)))))</span>
      </p>
    </section>
  );
}
