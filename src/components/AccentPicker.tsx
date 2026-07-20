import { useEffect, useRef, useState } from 'react';
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  resetAccentColor,
  setAccentColor,
  useThemeState,
} from '../store/theme-store';

export default function AccentPicker() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rawAccent = useThemeState((current) => current.rawAccent);
  const accent = useThemeState((current) => current.accent);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`flex h-7 w-7 items-center justify-center rounded hover:bg-paper/5 ${
          open ? 'text-amber' : 'text-paper'
        }`}
        aria-label="Choose accent color"
        aria-expanded={open}
        aria-controls="accent-picker-popover"
        data-testid="btn-accent"
        onClick={() => setOpen((current) => !current)}
        title="choose feature color"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M10 1.5a8.5 8.5 0 0 0 0 17h1.35a2.15 2.15 0 0 0 1.06-4.02l-.26-.15c-.46-.26-.27-.96.26-.96h1.18A4.91 4.91 0 0 0 18.5 8.5c0-3.87-3.8-7-8.5-7ZM5.2 10.15a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm1.55-4.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm3.8-1.1a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm3.65 1.5a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z" />
        </svg>
      </button>
      {open && (
        <div
          id="accent-picker-popover"
          role="dialog"
          aria-label="Accent color"
          className="absolute right-0 top-8 z-[100] max-h-[calc(100dvh-4rem)] w-72 overflow-y-auto rounded border border-edge bg-panel p-3 text-xs shadow-2xl max-sm:fixed max-sm:left-2 max-sm:right-2 max-sm:top-12 max-sm:w-auto"
          data-testid="accent-picker"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-paper">Feature color</div>
              <div className="mt-0.5 text-[11px] text-dim">Saved on this device</div>
            </div>
            <span
              className="h-7 w-7 rounded-full border border-paper/20"
              style={{ backgroundColor: accent }}
              aria-label={`Current accent ${rawAccent}`}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Presets">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                role="radio"
                aria-checked={rawAccent === preset.value}
                className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-left ${
                  rawAccent === preset.value ? 'border-amber text-paper' : 'border-edge text-dim'
                }`}
                data-testid={`accent-${preset.name.toLowerCase()}`}
                onClick={() => setAccentColor(preset.value)}
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: preset.value }} />
                {preset.name}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center justify-between rounded border border-edge px-2 py-2 text-dim">
            Custom color
            <input
              type="color"
              value={rawAccent}
              aria-label="Custom accent color"
              data-testid="accent-custom"
              className="h-7 w-10 cursor-pointer bg-transparent"
              onChange={(event) => setAccentColor(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="mt-3 text-[11px] text-dim underline hover:text-paper disabled:opacity-40"
            disabled={rawAccent === DEFAULT_ACCENT}
            onClick={resetAccentColor}
          >
            Reset to Amber
          </button>
        </div>
      )}
    </div>
  );
}
