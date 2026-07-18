import { useEffect } from 'react';
import Workbench from './components/Workbench';
import { Image } from './model/image';
import { dequantize } from './model/load';
import type { Manifest } from './model/load';
import {
  resetImage,
  getState,
  restoreState,
  restoreSourceState,
  setImage,
  setLoadError,
  setLoading,
  setRefsOpen,
  setToast,
  useAppState,
} from './store/app-store';
import { decodeShare } from './store/share';
import { setActiveLesson, setRightTab } from './store/workspace-store';
import PersistenceBridge, { restoreLocalSourceState } from './store/persistence';

const CKPT = '/checkpoints/shakespeare-quick';

async function boot(): Promise<void> {
  const [mRes, bRes, sourceRes] = await Promise.all([
    fetch(`${CKPT}/manifest.json`),
    fetch(`${CKPT}/model.bin`),
    fetch('/model.lisp'),
  ]);
  if (!mRes.ok) throw new Error(`manifest fetch failed: ${mRes.status}`);
  if (!bRes.ok || !bRes.body) throw new Error(`weights fetch failed: ${bRes.status}`);
  if (!sourceRes.ok) throw new Error(`model source fetch failed: ${sourceRes.status}`);
  const manifestPromise = mRes.json() as Promise<Manifest>;
  const sourcePromise = sourceRes.text();
  const total = Number(bRes.headers.get('content-length') ?? 0);
  const reader = bRes.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    setLoading(loaded, total || loaded);
  }
  const bin = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) {
    bin.set(c, off);
    off += c.length;
  }

  const [manifest, source] = await Promise.all([manifestPromise, sourcePromise]);
  const ckpt = dequantize(manifest, bin.buffer);
  const img = new Image(ckpt, source, 1337);
  setImage(img);
  handleHash();
}

/** #s= (share state, §12.4) > #ref-n > #sec-n */
function handleHash(): void {
  const h = location.hash;
  const shared = decodeShare(h, getState().bundledSource);
  if (shared) {
    let restored = true;
    if (shared.source !== undefined) {
      restored = restoreSourceState(shared.seed, shared.source, shared.replHistory);
    } else {
      restoreState(shared.seed, shared.knobEdits, shared.replHistory);
    }
    if (!restored) {
      setToast('shared source failed validation — the bundled model is still running');
      return;
    }
    if (shared.lesson !== undefined) setActiveLesson(shared.lesson, false);
    if (shared.rightTab) setRightTab(shared.rightTab);
    setToast('restored shared state');
    return;
  }
  restoreLocalSourceState();
  const ref = /^#ref-(\d+)$/.exec(h);
  if (ref) {
    setRefsOpen(true, Number(ref[1]));
    setRightTab('references');
    return;
  }
  const section = /^#sec-(\d+)$/.exec(h);
  if (section) {
    setActiveLesson(Number(section[1]), false);
  }
}

let booted = false;

export default function App() {
  const { status, loadedBytes, totalBytes, error, toast } = useAppState();

  useEffect(() => {
    if (booted) return;
    booted = true;
    boot().catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (status === 'error') {
    return (
      <main className="flex h-dvh items-center justify-center bg-ink p-8 font-mono">
        <div className="max-w-measure rounded border border-red-400/40 bg-panel p-6">
          <h1 className="text-paper">model failed to load</h1>
          <p className="mt-3 text-sm text-red-400">;; {error}</p>
        </div>
      </main>
    );
  }

  if (status === 'loading') {
    const mb = (loadedBytes / 1e6).toFixed(1);
    const totalMb = totalBytes ? (totalBytes / 1e6).toFixed(1) : '?';
    return (
      <main className="flex h-dvh flex-col bg-ink font-mono" data-testid="loading">
        <div className="flex h-9 items-center border-b border-edge bg-[#141311] px-3 text-xs text-paper">
          <img src="/logo-48.png" alt="" className="mr-2 h-[18px] w-[18px] rounded-sm" />
          (lispllm)<span className="cursor-blink text-amber">▍</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="mb-3 text-sm text-paper">opening model.lisp</div>
            <div className="h-1 overflow-hidden rounded bg-edge">
              <div
                className="h-full bg-amber transition-[width]"
                style={{
                  width: `${totalBytes ? Math.min(100, (loadedBytes / totalBytes) * 100) : 10}%`,
                }}
              />
            </div>
            <p className="mt-3 text-xs text-dim">
              loading {mb} of {totalMb} MB of weights — that's the whole mind
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <PersistenceBridge />
      <Workbench />
      {toast && (
        <div
          data-testid="toast"
          className="fixed bottom-10 left-1/2 z-[80] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded border border-amber bg-panel px-4 py-2 text-xs text-paper shadow-lg"
          role="alert"
        >
          <span>{toast}</span>
          <button
            className="text-amber underline"
            onClick={() => {
              resetImage();
              setToast(null);
            }}
          >
            (reset!)
          </button>
          <button className="text-dim" aria-label="dismiss" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
