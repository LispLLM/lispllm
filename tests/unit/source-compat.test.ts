import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sourceFingerprint } from '../../src/store/share';
import {
  COMMENT_ONLY_SOURCE_UPGRADES,
  isSafeCommentOnlyUpgrade,
} from '../../src/store/source-compat';

const source = readFileSync('public/model.lisp', 'utf8');
const upgrade = COMMENT_ONLY_SOURCE_UPGRADES[0];

describe('comment-only bundled source migration', () => {
  it('keeps the entire legacy model as an unchanged executable prefix', () => {
    expect(sourceFingerprint(source)).toBe(upgrade.to);
    expect(sourceFingerprint(source.slice(0, upgrade.legacyLength))).toBe(upgrade.from);
    expect(source.slice(upgrade.legacyLength)).toContain('how to read this file');
  });

  it('restores only non-custom state across the exact known upgrade', () => {
    expect(isSafeCommentOnlyUpgrade(upgrade.from, upgrade.to, false)).toBe(true);
    expect(isSafeCommentOnlyUpgrade(upgrade.from, upgrade.to, true)).toBe(false);
    expect(isSafeCommentOnlyUpgrade(upgrade.from, 'future-model', false)).toBe(false);
    expect(isSafeCommentOnlyUpgrade('unknown-model', upgrade.to, false)).toBe(false);
  });
});
