import { useEffect, useState } from 'react';
import PanelInfoButton from './PanelInfoButton';

export default function KernelSourceView() {
  const [source, setSource] = useState(';; loading kernels-ref.lisp…');
  useEffect(() => {
    let cancelled = false;
    fetch('/kernels-ref.lisp')
      .then((response) => {
        if (!response.ok) throw new Error(`kernel source: ${response.status}`);
        return response.text();
      })
      .then((text) => !cancelled && setSource(text))
      .catch((error) => !cancelled && setSource(`;; ${String(error)}`));
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <section className="flex h-full min-h-0 flex-col bg-ink" data-testid="kernel-source">
      <div className="flex min-h-9 items-center border-b border-edge bg-panel text-xs">
        <div className="flex h-9 items-center gap-2 border-r border-edge border-t-2 border-t-[#8fb0c0] bg-ink px-3 text-paper">
          <span className="text-[#8fb0c0]">λ</span> kernels-ref.lisp
          <span className="text-[10px] text-dim">read only</span>
          <PanelInfoButton panel="kernels" />
        </div>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre p-4 text-xs leading-5 text-paper">
        {source}
      </pre>
      <div className="min-h-6 border-t border-edge bg-panel px-2 py-1 text-[11px] text-dim">
        Pure-Lisp reference implementations for every native tensor kernel
      </div>
    </section>
  );
}
