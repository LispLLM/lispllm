/**
 * REPL drawer (§10): docked bottom, persistent. Collapsed = one input line;
 * expanded = 40vh history + input (85vh sheet on mobile). Multi-line via
 * Shift+Enter, history via ↑/↓, paren-balance indicator, (help), (reset!).
 */
import { memo, useEffect, useRef, useState } from 'react';
import type { ReplLine } from '../model/image';
import { replSubmit, resetImage, setReplDraft, setReplOpen, useAppState } from '../store/app-store';
import { shallowEqual } from '../store/selector';
import { recordReplCommand } from '../store/learning-store';
import { setBottomOpen, setBottomTab } from '../store/workspace-store';
import PanelInfoButton from './PanelInfoButton';

function parenBalance(s: string): number {
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

const LINE_STYLES: Record<string, string> = {
  input: 'text-paper',
  value: 'text-amber',
  output: 'text-paper/80',
  error: 'text-red-400',
  ui: 'text-dim',
  inspect: 'text-[#8fb0c0]',
};

const LINE_PREFIX: Record<string, string> = {
  input: 'λ> ',
  value: '',
  output: '',
  error: ';; error: ',
  ui: ';; ui: ',
  inspect: '',
};

const ReplTranscript = memo(function ReplTranscript({ transcript }: { transcript: ReplLine[] }) {
  return transcript.map((line, index) => (
    <div key={index} className={`whitespace-pre-wrap ${LINE_STYLES[line.kind]}`}>
      {LINE_PREFIX[line.kind]}
      {line.text}
    </div>
  ));
});

export default function Repl({ embedded = false }: { embedded?: boolean }) {
  const {
    replOpen,
    transcript,
    replDraft: input,
  } = useAppState(
    (current) => ({
      replOpen: current.replOpen,
      transcript: current.transcript,
      replDraft: current.replDraft,
    }),
    shallowEqual,
  );
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputHistory = useRef<string[]>([]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [transcript, replOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === '`' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setReplOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setBottomTab('repl');
        setBottomOpen(true);
        setReplOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === 'j' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setBottomTab('repl');
        setBottomOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const balance = parenBalance(input);

  const submit = () => {
    const src = input.trim();
    if (!src) return;
    inputHistory.current.push(src);
    setHistIdx(null);
    setReplDraft('');
    if (src === '(reset!)') {
      resetImage();
      return;
    }
    replSubmit(src);
    recordReplCommand(src);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (balance > 0) return; // let newline happen for unbalanced input
      e.preventDefault();
      submit();
    } else if (e.key === 'ArrowUp' && !input.includes('\n')) {
      const h = inputHistory.current;
      if (h.length === 0) return;
      e.preventDefault();
      const idx = histIdx === null ? h.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setReplDraft(h[idx]);
    } else if (e.key === 'ArrowDown' && histIdx !== null) {
      e.preventDefault();
      const h = inputHistory.current;
      const idx = histIdx + 1;
      if (idx >= h.length) {
        setHistIdx(null);
        setReplDraft('');
      } else {
        setHistIdx(idx);
        setReplDraft(h[idx]);
      }
    }
  };

  return (
    <div
      data-testid="repl-drawer"
      className={
        embedded
          ? 'flex h-full min-h-0 flex-col bg-panel'
          : `fixed inset-x-0 bottom-0 z-50 border-t border-edge bg-panel ${replOpen ? 'h-[40vh] max-sm:h-[85vh]' : ''}`
      }
    >
      {!embedded && replOpen && (
        <div className="flex min-h-8 items-center border-b border-edge px-3 text-[11px] uppercase tracking-wider text-dim">
          REPL
          <span className="ml-auto">
            <PanelInfoButton panel="repl" />
          </span>
        </div>
      )}
      {(embedded || replOpen) && (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-2 font-mono text-sm"
          data-testid="repl-history"
        >
          {transcript.length === 0 && (
            <div className="mb-2 rounded border border-edge bg-ink/40 p-2 text-xs leading-5 text-dim">
              Start with <span className="text-paper">(help)</span>. Press Enter to evaluate,
              Shift+Enter for another line, and ↑/↓ to revisit commands.
            </div>
          )}
          <ReplTranscript transcript={transcript} />
        </div>
      )}
      <div className="flex items-start gap-2 px-4 py-2">
        {!embedded && (
          <button
            className="text-dim hover:text-amber"
            aria-label={replOpen ? 'collapse repl' : 'expand repl'}
            onClick={() => setReplOpen(!replOpen)}
          >
            {replOpen ? '▾' : '▴'}
          </button>
        )}
        <span className="pt-0.5 font-mono text-sm text-amber">λ&gt;</span>
        <textarea
          ref={inputRef}
          data-testid="repl-input"
          value={input}
          rows={Math.min(6, input.split('\n').length)}
          spellCheck={false}
          placeholder="(help) lists primitives — everything on this page is in scope"
          className="min-w-0 flex-1 resize-none bg-transparent font-mono text-sm text-paper outline-none placeholder:text-dim/60"
          onChange={(e) => setReplDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => !embedded && !replOpen && setReplOpen(true)}
        />
        <span
          data-testid="paren-balance"
          className={`pt-0.5 font-mono text-xs ${balance === 0 ? 'text-dim' : 'text-amber'}`}
          title="unclosed parens"
        >
          {balance > 0 ? `(${balance}` : balance < 0 ? ')?' : '()'}
        </span>
      </div>
    </div>
  );
}
