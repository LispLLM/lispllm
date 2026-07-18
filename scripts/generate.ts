/**
 * Node CLI: load the checkpoint + model.lisp through the interpreter and
 * generate 300 characters. M3 exit evidence.
 */
import { readFileSync } from 'node:fs';
import { Env, installCoreBuiltins } from '../src/lisp/env';
import { evaluate } from '../src/lisp/eval';
import { readProgram } from '../src/lisp/reader';
import { listToArray } from '../src/lisp/types';
import type { Value } from '../src/lisp/types';
import { installTensorBuiltins } from '../src/tensor/bindings';
import { Rng } from '../src/tensor/rng';
import { bindCheckpoint, dequantize, makeTokenizer } from '../src/model/load';
import type { Manifest } from '../src/model/load';

const CKPT = 'public/checkpoints/shakespeare-quick';

const manifest = JSON.parse(readFileSync(`${CKPT}/manifest.json`, 'utf8')) as Manifest;
const bin = readFileSync(`${CKPT}/model.bin`);
const ckpt = dequantize(
  manifest,
  bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
);

const rng = new Rng(1337);
const env = new Env();
installCoreBuiltins(env, { display: (t) => console.log(t), seed: (n) => rng.reseed(n) });
installTensorBuiltins(env, rng);
bindCheckpoint(env, ckpt);
for (const f of readProgram(readFileSync('public/model.lisp', 'utf8')).forms) evaluate(f, env);

const { encode, decode } = makeTokenizer(manifest.charset);
const prompt = process.argv[2] ?? 'ROMEO: ';
const n = Number(process.argv[3] ?? 300);

const src = readProgram(`(generate '(${encode(prompt).join(' ')}) ${n})`);
const t0 = performance.now();
const out = evaluate(src.forms[0], env);
const dt = (performance.now() - t0) / 1000;

const tokens = listToArray(out).map((v: Value) => v as number);
console.log(decode(tokens));
console.error(`\n${n} chars in ${dt.toFixed(1)}s (${(n / dt).toFixed(1)} chars/s)`);
