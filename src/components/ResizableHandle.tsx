import type { KeyboardEvent, PointerEvent } from 'react';

export default function ResizableHandle({
  label,
  orientation,
  value,
  min,
  max,
  direction = 1,
  onChange,
}: {
  label: string;
  orientation: 'vertical' | 'horizontal';
  value: number;
  min: number;
  max: number;
  direction?: 1 | -1;
  onChange: (value: number) => void;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const start = orientation === 'vertical' ? event.clientX : event.clientY;
    const initial = value;
    const move = (moveEvent: globalThis.PointerEvent) => {
      const point = orientation === 'vertical' ? moveEvent.clientX : moveEvent.clientY;
      onChange(clamp(initial + (point - start) * direction));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const decrement = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp';
    const increment = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown';
    if (event.key === decrement) onChange(clamp(value - 10 * direction));
    else if (event.key === increment) onChange(clamp(value + 10 * direction));
    else if (event.key === 'Home') onChange(min);
    else if (event.key === 'End') onChange(max);
    else return;
    event.preventDefault();
  };
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={`group relative z-10 shrink-0 bg-edge outline-none focus:bg-amber ${
        orientation === 'vertical' ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize'
      }`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span
        className={`absolute bg-transparent group-hover:bg-amber/50 ${
          orientation === 'vertical' ? '-left-1 top-0 h-full w-2' : '-top-1 left-0 h-2 w-full'
        }`}
      />
    </div>
  );
}
