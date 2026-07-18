import { useEffect } from 'react';
import Header from './components/Header';
import Repl from './components/Repl';
import S0Hero from './sections/S0Hero';
import S1NextChar from './sections/S1NextChar';
import { Image } from './model/image';
import { dequantize } from './model/load';
import type { Manifest } from './model/load';
import {
  resetImage,
  setImage,
  setLoadError,
  setLoading,
  setToast,
  useAppState,
} from './store/app-store';

const CKPT = '/checkpoints/shakespeare-quick';

async function boot(): Promise<void> {
  const mRes = await fetch(`${CKPT}/manifest.json`);
  if (!mRes.ok) throw new Error(`manifest fetch failed: ${mRes.status}`);
  const manifest = (await mRes.json()) as Manifest;

  const bRes = await fetch(`${CKPT}/model.bin`);
  if (!bRes.ok || !bRes.body) throw new Error(`weights fetch failed: ${bRes.status}`);
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

  const ckpt = dequantize(manifest, bin.buffer);
  const img = new Image(ckpt, await (await fetch('/model.lisp')).text(), 1337);
  setImage(img);
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
      <main className="mx-auto max-w-measure px-4 py-24 font-mono">
        <p className="text-red-400">;; failed to load the model: {error}</p>
      </main>
    );
  }

  if (status === 'loading') {
    const mb = (loadedBytes / 1e6).toFixed(1);
    const totalMb = totalBytes ? (totalBytes / 1e6).toFixed(1) : '?';
    return (
      <main className="mx-auto max-w-measure px-4 py-24 font-mono" data-testid="loading">
        <h1 className="text-2xl text-paper">
          (lispllm)
          <span className="cursor-blink text-amber">▍</span>
        </h1>
        <p className="mt-6 text-dim">
          loading {mb} of {totalMb} MB of weights — that's the whole mind
        </p>
      </main>
    );
  }

  return (
    <div id="top" className="pb-24">
      <Header />
      <S0Hero />
      <S1NextChar />
      {toast && (
        <div
          data-testid="toast"
          className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded border border-amber bg-panel px-4 py-2 text-sm text-paper shadow-lg"
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
      <Repl />
    </div>
  );
}
