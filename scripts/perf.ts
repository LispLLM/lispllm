/** Measure untraced forward, traced forward, and rebuild times (pnpm tsx scripts/perf.ts). */
import { readFileSync } from 'node:fs';
import { Image } from '../src/model/image';
import { dequantize } from '../src/model/load';
import type { Manifest } from '../src/model/load';

const CKPT = 'public/checkpoints/shakespeare-quick';
const manifest = JSON.parse(readFileSync(`${CKPT}/manifest.json`, 'utf8')) as Manifest;
const bin = readFileSync(`${CKPT}/model.bin`);
const ckpt = dequantize(
  manifest,
  bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
);
const img = new Image(ckpt, readFileSync('public/model.lisp', 'utf8'), 1337);

const full = 'ROMEO: I will the stall and the wall of the world, and the more'.padEnd(96, ' ');

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// untraced forward at full context
{
  const times: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    img.logits(full);
    times.push(performance.now() - t0);
  }
  console.log(`untraced forward (ctx ${manifest.ctx}): median ${median(times).toFixed(1)} ms`);
}

// traced forward
{
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    img.traceForward(full.slice(-64));
    times.push(performance.now() - t0);
  }
  console.log(`traced forward (64-char focus): median ${median(times).toFixed(1)} ms`);
}

// rebuild
{
  const times: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    img.rebuild([], ['(set! temperature 1.1)', '(shape tok-emb)']);
    times.push(performance.now() - t0);
  }
  console.log(`image rebuild (+2 history entries): median ${median(times).toFixed(1)} ms`);
}

// sustained generation
{
  const tokens = img.tokenizer.encode('ROMEO: ');
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) tokens.push(img.sampleNextUi(tokens));
  const dt = (performance.now() - t0) / 1000;
  console.log(`generation: ${(200 / dt).toFixed(1)} chars/s over 200 chars`);
}
