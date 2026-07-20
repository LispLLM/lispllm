import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

export default function ResizableHandle({
  label,
  orientation,
  value,
  min,
  max,
  direction = 1,
  onChange,
  onReset,
  className = '',
}: {
  label: string;
  orientation: 'vertical' | 'horizontal';
  value: number;
  min: number;
  max: number;
  direction?: 1 | -1;
  onChange: (value: number) => void;
  onReset?: () => void;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    setDragging(true);
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    const start = orientation === 'vertical' ? event.clientX : event.clientY;
    const initial = value;
    const move = (moveEvent: globalThis.PointerEvent) => {
      const point = orientation === 'vertical' ? moveEvent.clientX : moveEvent.clientY;
      onChange(clamp(initial + (point - start) * direction));
    };
    const up = () => {
      cleanupRef.current = null;
      setDragging(false);
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', up);
    };
    cleanupRef.current = up;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', up);
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
      aria-valuetext={`${Math.round(value)} pixels`}
      title="Drag to resize · arrow keys adjust · double-click resets"
      className={`group relative z-10 shrink-0 bg-transparent outline-none ${
        orientation === 'vertical'
          ? 'w-2 self-stretch cursor-col-resize'
          : 'h-2 w-full cursor-row-resize'
      } ${className}`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
    >
      <span
        className={`absolute transition-colors ${
          dragging ? 'bg-amber' : 'bg-edge group-hover:bg-amber/70 group-focus:bg-amber'
        } ${
          orientation === 'vertical'
            ? 'bottom-0 left-1/2 top-0 w-px -translate-x-1/2'
            : 'left-0 right-0 top-1/2 h-px -translate-y-1/2'
        }`}
      />
      <span
        aria-hidden="true"
        className={`absolute rounded-full border border-edge bg-panel opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 ${
          dragging ? '!border-amber !opacity-100' : ''
        } ${orientation === 'vertical' ? 'left-1/2 top-1/2 h-8 w-2 -translate-x-1/2 -translate-y-1/2' : 'left-1/2 top-1/2 h-2 w-8 -translate-x-1/2 -translate-y-1/2'}`}
      />
    </div>
  );
}
