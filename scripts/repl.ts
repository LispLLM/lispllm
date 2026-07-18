/**
 * Terminal REPL for the Lisp core: pnpm repl
 */
import { createInterface } from 'node:readline';
import { Env, installCoreBuiltins } from '../src/lisp/env';
import { evaluate } from '../src/lisp/eval';
import { printValue } from '../src/lisp/printer';
import { readProgram } from '../src/lisp/reader';
import { LispError } from '../src/lisp/types';

const env = new Env();
installCoreBuiltins(env, {
  display: (t) => console.log(t),
  seed: (n) => console.log(`; seeded ${n}`),
});

const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'λ> ' });
let buffer = '';

function balance(s: string): number {
  let depth = 0;
  let inStr = false;
  let inComment = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inComment) {
      if (c === '\n') inComment = false;
    } else if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === ';') inComment = true;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
  }
  return depth;
}

console.log('lispllm repl — (help) lists primitives, Ctrl+D exits');
rl.prompt();
rl.on('line', (line) => {
  buffer += (buffer ? '\n' : '') + line;
  if (balance(buffer) > 0) {
    rl.setPrompt('.. ');
    rl.prompt();
    return;
  }
  try {
    const prog = readProgram(buffer);
    for (const form of prog.forms) {
      const v = evaluate(form, env);
      const s = printValue(v);
      if (s) console.log(s);
    }
  } catch (err) {
    console.error(err instanceof LispError ? `error: ${err.message}` : err);
  }
  buffer = '';
  rl.setPrompt('λ> ');
  rl.prompt();
});
rl.on('close', () => process.exit(0));
