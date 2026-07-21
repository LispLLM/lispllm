/** Inline citation chip [n] — opens the references panel (§10). */
import { setRefsOpen } from '../store/app-store';
import { setRightTab } from '../store/workspace-store';

export default function Cite({ n }: { n: number }) {
  return (
    <button
      data-testid={`cite-${n}`}
      className="rounded-sm px-0.5 text-amber hover:bg-amber/5"
      aria-label={`open reference ${n}`}
      onClick={() => {
        setRefsOpen(true, n);
        setRightTab('references');
      }}
    >
      [{n}]
    </button>
  );
}
