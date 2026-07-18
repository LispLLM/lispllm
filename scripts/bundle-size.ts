/**
 * Bundle-size gate: gzipped size of all JS in dist/assets must be <= 350 KB.
 * Weights (public/checkpoints) are excluded — they are static assets, not bundle.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dir = 'dist/assets';
let total = 0;
for (const f of readdirSync(dir)) {
  if (f.endsWith('.js')) {
    const gz = gzipSync(readFileSync(join(dir, f))).length;
    console.log(`${f}: ${(gz / 1024).toFixed(1)} KB gz`);
    total += gz;
  }
}
console.log(`total JS: ${(total / 1024).toFixed(1)} KB gz`);
const LIMIT = 350 * 1024;
if (total > LIMIT) {
  console.error(`FAIL: bundle ${total} bytes gz exceeds ${LIMIT}`);
  process.exit(1);
}
console.log('bundle-size gate: PASS');
