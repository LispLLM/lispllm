/** INV-3: the "?" affordance — show the pure-Lisp reference for a kernel. */
import { useEffect, useState } from 'react';

let refsSource: string | null = null;

async function loadRefs(): Promise<string> {
  if (refsSource === null) refsSource = await (await fetch('/kernels-ref.lisp')).text();
  return refsSource;
}

/** Extract the `(define (name-ref …) …)` form for `name` by paren matching. */
function extractRef(src: string, name: string): string | null {
  const needle = `(define (${name}-ref`;
  const start = src.indexOf(needle);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

export default function KernelRef({ name, onClose }: { name: string; onClose: () => void }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadRefs().then((src) => {
      if (live) setText(extractRef(src, name) ?? `;; no reference found for ${name}`);
    });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      live = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [name, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-label={`reference implementation of ${name}`}
    >
      <div
        data-testid="kernel-ref"
        className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded border border-edge bg-panel p-4 font-mono text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex justify-between text-dim">
          <span>;; {name} is a native kernel; this pure-Lisp version is equivalent (tested)</span>
          <button className="text-dim hover:text-amber" aria-label="close" onClick={onClose}>
            esc ×
          </button>
        </div>
        <pre className="whitespace-pre-wrap text-paper">{text ?? ';; loading…'}</pre>
      </div>
    </div>
  );
}
