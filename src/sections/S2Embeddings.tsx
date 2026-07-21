/** §2 — "Letters become vectors." */
import { useMemo, useState } from 'react';
import type { Tensor } from '../lisp/types';
import { isTensor } from '../lisp/types';
import CodePanel from '../components/CodePanel';
import KernelRef from '../components/KernelRef';
import TensorView from '../components/TensorView';
import { nearestRows } from '../model/queries';
import { getImage, useAppState } from '../store/app-store';
import { recordLearningEvent } from '../store/learning-store';

const glyph = (ch: string) => (ch === ' ' ? '␣' : ch === '\n' ? '⏎' : ch);

export default function S2Embeddings({
  labOnly = false,
  active = true,
}: {
  labOnly?: boolean;
  active?: boolean;
}) {
  const imageVersion = useAppState((current) => current.imageVersion);
  const img = getImage();
  const charset = img.checkpoint.manifest.charset;
  const [selected, setSelected] = useState(charset.indexOf('e'));
  const [selectedFeature, setSelectedFeature] = useState(0);
  const [helpFor, setHelpFor] = useState<string | null>(null);

  const tokEmb = useMemo(() => {
    void imageVersion;
    const t = img.lookup('tok-emb');
    return isTensor(t) ? t : null;
  }, [img, imageVersion]);

  const neighbors = useMemo(
    () => (tokEmb && selected >= 0 ? nearestRows(tokEmb as Tensor, selected, 5) : []),
    [tokEmb, selected],
  );
  const rowLabels = useMemo(() => [...charset].map((ch) => `'${glyph(ch)}'`), [charset]);
  const featureLabels = useMemo(
    () => Array.from({ length: tokEmb?.shape[1] ?? 0 }, (_, index) => `feature ${index}`),
    [tokEmb],
  );

  return (
    <section
      id="sec-2"
      hidden={labOnly && !active}
      className={labOnly ? 'min-w-0 p-3 font-mono' : 'mx-auto max-w-measure px-4 py-16 font-mono'}
    >
      {!labOnly && (
        <>
          <h2 className="mb-4 text-xl text-paper">;; §2 letters become vectors</h2>
          <p className="mb-4 text-sm leading-6 text-dim">
            The model can't read. It knows {charset.length} characters, and each one is a row of{' '}
            {tokEmb ? tokEmb.shape[1] : '…'} numbers in <span className="text-paper">tok-emb</span>{' '}
            — learned, not designed. Characters that behave alike end up near each other. Click a
            letter below and look at its nearest neighbors by cosine similarity: uppercase and
            lowercase pairs usually find each other, because Shakespeare uses them in the same
            places. Lookup is just <span className="text-paper">rows</span> — no arithmetic, a
            table.
          </p>
        </>
      )}

      <div
        className="mb-4 flex flex-wrap gap-1"
        data-testid="s2-chars"
        role="listbox"
        aria-label="character table"
      >
        {[...charset].map((ch, i) => (
          <button
            key={i}
            role="option"
            aria-selected={i === selected}
            className={`h-7 w-7 rounded border text-sm ${
              i === selected
                ? 'border-amber bg-amber/20 text-paper'
                : 'border-edge text-dim hover:text-paper'
            }`}
            onClick={() => {
              if (i !== selected) recordLearningEvent('embeddings:character-selected');
              setSelected(i);
              setSelectedFeature(0);
            }}
          >
            {glyph(ch)}
          </button>
        ))}
      </div>

      {tokEmb && (
        <div className="mb-4">
          <p className="mb-2 text-xs leading-5 text-dim" data-testid="s2-heatmap-help">
            Each row is one character; each column is a learned feature. Click a cell to choose its
            character row and feature—the selected value and nearest characters update below.
          </p>
          <div className="overflow-x-auto">
            <TensorView
              tensor={tokEmb}
              maxWidth={620}
              selectedCell={selected >= 0 ? [selected, selectedFeature] : null}
              rowLabels={rowLabels}
              colLabels={featureLabels}
              onSelect={(row, column) => {
                if (row !== selected) recordLearningEvent('embeddings:character-selected');
                setSelected(row);
                setSelectedFeature(column);
              }}
              ariaLabel="token embedding matrix"
            />
          </div>
        </div>
      )}

      {selected >= 0 && (
        <div className="mb-4 text-sm" data-testid="s2-neighbors" aria-live="polite">
          <span className="text-dim">nearest to </span>
          <span className="text-amber">'{glyph(charset[selected])}'</span>
          <span className="text-dim">: </span>
          {neighbors.map(({ row, sim }) => (
            <button
              key={row}
              className="mr-3 rounded px-1 text-paper hover:bg-paper/5 hover:text-amber"
              onClick={() => {
                setSelected(row);
                setSelectedFeature(0);
                recordLearningEvent('embeddings:neighbor-selected');
              }}
            >
              '{glyph(charset[row])}' <span className="text-dim">{sim.toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}

      <CodePanel forms={['embed']} onPrimitiveHelp={setHelpFor} testId="s2-code" active={active} />
      {helpFor && <KernelRef name={helpFor} onClose={() => setHelpFor(null)} />}
      {!labOnly && (
        <p className="mt-3 text-sm text-dim">
          try: <span className="text-amber">(shape tok-emb)</span>
        </p>
      )}
    </section>
  );
}
