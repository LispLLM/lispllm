/**
 * Golden parity (keystone test, §9): the TS/Lisp forward on the shipped
 * checkpoint must reproduce all 16 greedy argmaxes of golden.json and match
 * the stored top-5 logits within |Δ| ≤ 1e-3.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Env, installCoreBuiltins } from '../../src/lisp/env';
import { applyValue, evaluate } from '../../src/lisp/eval';
import { readProgram } from '../../src/lisp/reader';
import { isTensor, list } from '../../src/lisp/types';
import { installTensorBuiltins } from '../../src/tensor/bindings';
import { argmax, lastRow } from '../../src/tensor/kernels';
import { Rng } from '../../src/tensor/rng';
import { bindCheckpoint, dequantize, makeTokenizer, paramCount } from '../../src/model/load';
import type { Manifest } from '../../src/model/load';

const CKPT = 'public/checkpoints/shakespeare-quick';

interface GoldenStep {
  argmax: number;
  top5: Array<{ token: number; logit: number }>;
}
interface Golden {
  prompt: string;
  steps: GoldenStep[];
  text: string;
}

const manifest = JSON.parse(readFileSync(`${CKPT}/manifest.json`, 'utf8')) as Manifest;
const golden = JSON.parse(readFileSync(`${CKPT}/golden.json`, 'utf8')) as Golden;
const bin = readFileSync(`${CKPT}/model.bin`);

function makeImage(): Env {
  const ckpt = dequantize(
    manifest,
    bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
  );
  const rng = new Rng(1337);
  const env = new Env();
  installCoreBuiltins(env, { display: () => {}, seed: (n) => rng.reseed(n) });
  installTensorBuiltins(env, rng);
  bindCheckpoint(env, ckpt);
  for (const f of readProgram(readFileSync('public/model.lisp', 'utf8')).forms) evaluate(f, env);
  return env;
}

describe('golden parity (§9 keystone)', () => {
  const env = makeImage();
  const { encode, decode } = makeTokenizer(manifest.charset);

  it('reproduces all 16 greedy argmaxes and top-5 logits within 1e-3', () => {
    const gpt = env.lookup('gpt');
    const tokens = encode(golden.prompt);
    for (const step of golden.steps) {
      const win = tokens.slice(-manifest.ctx);
      const out = applyValue(gpt, [list(...win)]);
      if (!isTensor(out)) throw new Error('gpt did not return a tensor');
      const logits = lastRow(out);
      expect(argmax(logits)).toBe(step.argmax);
      for (const { token, logit } of step.top5) {
        expect(Math.abs(logits.data[token] - logit)).toBeLessThanOrEqual(1e-3);
      }
      tokens.push(step.argmax);
    }
    expect(decode(tokens)).toBe(golden.text);
  });

  it('live param count equals the manifest count', () => {
    expect(paramCount(manifest)).toBe(manifest.params);
  });

  it('charset is \\n + printable ASCII (96 chars)', () => {
    expect(manifest.charset.length).toBe(96);
    expect(manifest.charset[0]).toBe('\n');
    expect(manifest.charset[1]).toBe(' ');
    expect(manifest.charset[95]).toBe('~');
  });
});
