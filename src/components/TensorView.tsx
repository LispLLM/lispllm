/**
 * TensorView (§12.2): canvas heatmap. Diverging blue-white-amber for signed
 * data, sequential for [0,1] data (auto by range). Hover crosshair + tooltip
 * (4 sig figs). Click selects a cell. Arrow-key navigation, roving tabindex.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Tensor } from '../lisp/types';
import { printNumber } from '../lisp/printer';
import { useThemeState } from '../store/theme-store';

export interface TensorViewProps {
  tensor: Tensor;
  cellSize?: number;
  maxWidth?: number;
  onSelect?: (i: number, j: number, value: number) => void;
  onHover?: (i: number, j: number) => void;
  /** externally highlighted cell (bidirectional linking) */
  highlight?: [number, number] | null;
  rowLabels?: string[];
  colLabels?: string[];
  ariaLabel?: string;
}

// colorblind-safe-ish diverging: blue → near-white → amber
function divergingColor(t: number): [number, number, number] {
  // t in [-1, 1]
  if (t < 0) {
    const u = Math.min(1, -t);
    return [Math.round(232 - 173 * u), Math.round(228 - 96 * u), Math.round(220 + 15 * u)];
  }
  const u = Math.min(1, t);
  return [Math.round(232 - 2 * u), Math.round(228 - 66 * u), Math.round(220 - 160 * u)];
}

function sequentialColor(t: number): [number, number, number] {
  const u = Math.max(0, Math.min(1, t));
  return [Math.round(24 + 206 * u), Math.round(22 + 140 * u), Math.round(19 + 41 * u)];
}

export default function TensorView({
  tensor,
  cellSize,
  maxWidth = 560,
  onSelect,
  onHover,
  highlight,
  rowLabels,
  colLabels,
  ariaLabel,
}: TensorViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const accent = useThemeState((current) => current.accent);

  const r = tensor.shape.length === 2 ? tensor.shape[0] : 1;
  const c = tensor.shape.length === 2 ? tensor.shape[1] : tensor.shape[0];
  const cs = cellSize ?? Math.max(3, Math.min(18, Math.floor(maxWidth / c)));

  const { min, max, sequential } = useMemo(() => {
    let mn = Infinity;
    let mx = -Infinity;
    for (const v of tensor.data) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    return { min: mn, max: mx, sequential: mn >= 0 && mx <= 1.0001 };
  }, [tensor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = c * cs * dpr;
    canvas.height = r * cs * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const absMax = Math.max(Math.abs(min), Math.abs(max)) || 1;
    for (let i = 0; i < r; i++) {
      for (let j = 0; j < c; j++) {
        const v = tensor.data[i * c + j];
        const [red, g, b] = sequential
          ? sequentialColor((v - min) / (max - min || 1))
          : divergingColor(v / absMax);
        ctx.fillStyle = `rgb(${red},${g},${b})`;
        ctx.fillRect(j * cs, i * cs, cs, cs);
      }
    }
    const mark = (cell: [number, number], color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cell[1] * cs + 0.75, cell[0] * cs + 0.75, cs - 1.5, cs - 1.5);
    };
    if (highlight) mark(highlight, accent);
    if (selected) mark(selected, accent);
    if (hover) {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, hover[0] * cs + 0.5, c * cs - 1, cs - 1);
      ctx.strokeRect(hover[1] * cs + 0.5, 0.5, cs - 1, r * cs - 1);
      ctx.globalAlpha = 1;
    }
  }, [tensor, r, c, cs, min, max, sequential, hover, selected, highlight, accent]);

  const cellFromEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
      const rect = e.currentTarget.getBoundingClientRect();
      const j = Math.max(0, Math.min(c - 1, Math.floor((e.clientX - rect.left) / cs)));
      const i = Math.max(0, Math.min(r - 1, Math.floor((e.clientY - rect.top) / cs)));
      return [i, j];
    },
    [c, r, cs],
  );

  const activate = (cell: [number, number]) => {
    setSelected(cell);
    onSelect?.(cell[0], cell[1], tensor.data[cell[0] * c + cell[1]]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const cur = selected ?? hover ?? [0, 0];
    const move: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (move[e.key]) {
      e.preventDefault();
      const ni = Math.max(0, Math.min(r - 1, cur[0] + move[e.key][0]));
      const nj = Math.max(0, Math.min(c - 1, cur[1] + move[e.key][1]));
      activate([ni, nj]);
    } else if (e.key === 'Enter' && selected) {
      onSelect?.(selected[0], selected[1], tensor.data[selected[0] * c + selected[1]]);
    }
  };

  const tip = hover
    ? {
        v: tensor.data[hover[0] * c + hover[1]],
        label: `${rowLabels?.[hover[0]] ?? hover[0]}, ${colLabels?.[hover[1]] ?? hover[1]}`,
      }
    : null;

  return (
    <div className="inline-block">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel ?? `heatmap ${r}×${c}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        style={{ width: c * cs, height: r * cs, imageRendering: 'pixelated' }}
        className="cursor-crosshair rounded-sm outline-none focus:ring-1 focus:ring-amber"
        onMouseMove={(e) => {
          const cell = cellFromEvent(e);
          setHover(cell);
          onHover?.(cell[0], cell[1]);
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => activate(cellFromEvent(e))}
      />
      <div className="mt-1 flex justify-between text-xs text-dim">
        <span>min {printNumber(min)}</span>
        {tip && (
          <span className="text-paper" data-testid="tensor-tooltip">
            [{tip.label}] = {printNumber(tip.v)}
          </span>
        )}
        <span>max {printNumber(max)}</span>
      </div>
    </div>
  );
}
