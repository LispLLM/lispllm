/** §6 — "The whole model, one page." */
import { useMemo, useState } from 'react';
import Cite from '../components/Cite';
import CodePanel from '../components/CodePanel';
import KernelRef from '../components/KernelRef';
import { setToast, getImage, useAppState } from '../store/app-store';

/** Group manifest tensors into the defines that use them (computed, never hardcoded). */
function paramShares(img: ReturnType<typeof getImage>) {
  const groups: Record<string, number> = { embeddings: 0, attention: 0, mlp: 0, layernorm: 0 };
  let total = 0;
  for (const t of img.checkpoint.manifest.tensors) {
    const n = t.shape.reduce((a, b) => a * b, 1);
    total += n;
    if (t.name === 'tok-emb' || t.name === 'pos-emb') groups.embeddings += n;
    else if (/\.(head\d+\.(wq|wk|wv)|wo)$/.test(t.name)) groups.attention += n;
    else if (/\.(w-up|w-down)$/.test(t.name)) groups.mlp += n;
    else groups.layernorm += n;
  }
  return { groups, total };
}

export default function S6WholeModel() {
  const { imageVersion } = useAppState();
  const img = getImage();
  const [helpFor, setHelpFor] = useState<string | null>(null);

  const { groups, total } = useMemo(() => paramShares(img), [img]);
  const lineCount = useMemo(() => {
    void imageVersion;
    return img.program.source.trimEnd().split('\n').length;
  }, [img, imageVersion]);
  const defineCount = useMemo(() => {
    void imageVersion;
    return img.program.forms.filter(
      (f) => f.kind === 'list' && f.items[0]?.kind === 'sym' && f.items[0].name === 'define',
    ).length;
  }, [img, imageVersion]);

  const copy = async () => {
    await navigator.clipboard.writeText(img.program.source);
    setToast('model.lisp copied to clipboard');
  };
  const permalink = async () => {
    await navigator.clipboard.writeText(`${location.origin}${location.pathname}#sec-6`);
    setToast('permalink copied');
  };

  return (
    <section id="sec-6" className="mx-auto max-w-measure px-4 py-16 font-mono">
      <h2 className="mb-4 text-xl text-paper">;; §6 the whole model, one page</h2>
      <p className="mb-4 text-sm leading-6 text-dim">
        This is everything — the same source the page has been evaluating all along, edits included.
        McCarthy fit a language on a page in 1960
        <Cite n={2} />
        <Cite n={5} />; the transformer turns out to fit too
        <Cite n={3} />
        <Cite n={6} />. {lineCount} lines, {defineCount} defines, {(total / 1000).toFixed(0)}k
        parameters. The numbers in the gutter are where those parameters live, computed from the
        checkpoint manifest.
      </p>

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-dim" data-testid="s6-shares">
        {Object.entries(groups).map(([name, n]) => (
          <span key={name}>
            {name}: <span className="text-paper">{((n / total) * 100).toFixed(1)}%</span> (
            {(n / 1000).toFixed(1)}k)
          </span>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-3 text-xs">
        <span className="rounded border border-edge px-2 py-1 text-dim" data-testid="s6-lines">
          {lineCount} lines
        </span>
        <button
          className="rounded border border-edge px-2 py-1 text-dim hover:text-amber"
          onClick={copy}
        >
          copy as text
        </button>
        <button
          className="rounded border border-edge px-2 py-1 text-dim hover:text-amber"
          onClick={permalink}
        >
          permalink
        </button>
        <button
          className="rounded border border-edge px-2 py-1 text-dim hover:text-amber print:hidden"
          onClick={() => window.print()}
        >
          print
        </button>
      </div>

      <div className="print-code">
        <CodePanel forms="*" onPrimitiveHelp={setHelpFor} dense testId="s6-code" />
      </div>
      {helpFor && <KernelRef name={helpFor} onClose={() => setHelpFor(null)} />}
      <p className="mt-3 text-sm text-dim">
        try: <span className="text-amber">(generate '(20) 40)</span>
      </p>
    </section>
  );
}
