import { describe, expect, it } from 'vitest';
import { fitPanelWidths } from '../../src/store/workspace-store';

describe('workspace panel fitting', () => {
  it('preserves requested widths when the editor has enough room', () => {
    expect(fitPanelWidths(1280, true, true, 340, 420)).toMatchObject({
      left: 340,
      right: 420,
      editorFloor: 320,
    });
  });

  it('shrinks both side panels within their safety bounds on narrow desktops', () => {
    const fitted = fitPanelWidths(900, true, true, 520, 720);
    expect(fitted.left).toBe(240);
    expect(fitted.right).toBe(300);
    expect(fitted.editorFloor).toBe(296);
    expect(48 + 8 + 8 + fitted.left + fitted.right + fitted.editorFloor).toBeLessThanOrEqual(900);
  });

  it('gives a closed panel no budget and leaves more room for the open side', () => {
    const fitted = fitPanelWidths(900, false, true, 520, 600);
    expect(fitted.left).toBe(0);
    expect(fitted.right).toBeLessThanOrEqual(fitted.rightMax);
    expect(fitted.rightMax).toBeGreaterThan(300);
  });
});
