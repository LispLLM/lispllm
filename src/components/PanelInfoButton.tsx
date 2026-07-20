import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PANEL_HELP } from '../content/panel-help';
import type { PanelHelpId } from '../content/panel-help';

export default function PanelInfoButton({ panel }: { panel: PanelHelpId }) {
  const help = PANEL_HELP[panel];
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const popoverId = `panel-info-${panel}-content`;

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);
  const show = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!pinned) setOpen(false);
    }, 140);
  }, [cancelClose, pinned]);
  const close = useCallback(
    (restoreFocus = false) => {
      cancelClose();
      setOpen(false);
      setPinned(false);
      if (restoreFocus) triggerRef.current?.focus();
    },
    [cancelClose],
  );

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    const height = popover.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
    const below = rect.bottom + 8;
    const top =
      below + height <= window.innerHeight - 8 ? below : Math.max(8, rect.top - height - 8);
    setPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, help.description, place]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) close();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close, place]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-dim hover:bg-paper/5 hover:text-paper"
        aria-label={`About ${help.title}`}
        aria-expanded={open}
        aria-controls={popoverId}
        data-testid={`panel-info-${panel}`}
        onPointerEnter={show}
        onPointerLeave={scheduleClose}
        onFocus={show}
        onBlur={scheduleClose}
        onClick={(event) => {
          event.stopPropagation();
          if (pinned) close();
          else {
            show();
            setPinned(true);
          }
        }}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
          <path d="M10 1.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5Zm0 3.1a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1Zm1.15 10.3h-2.3v-1.3h.45V9.3h-.45V8h1.75v5.85h.55v1.3Z" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            id={popoverId}
            role="tooltip"
            className="fixed z-[100] w-[min(20rem,calc(100vw-1rem))] rounded border border-edge bg-panel p-3 text-left normal-case shadow-2xl"
            style={position}
            data-testid={`panel-info-${panel}-content`}
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
          >
            <div className="text-xs font-semibold text-paper">{help.title}</div>
            <p className="mt-1 text-xs leading-5 text-dim">{help.description}</p>
          </div>,
          document.body,
        )}
    </>
  );
}
