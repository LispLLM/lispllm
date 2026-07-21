import { useEffect, useMemo, useRef, useState } from 'react';
import { Compartment, EditorState, StateEffect, StateField } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import type { StreamParser } from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import type { Diagnostic } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import { isBuiltin } from '../lisp/types';
import KernelRef from './KernelRef';
import {
  applySource,
  getImage,
  getState,
  restoreBundledSourceDraft,
  revertSourceDraft,
  setSourceText,
  setToast,
  subscribe,
  useAppState,
} from '../store/app-store';
import { setBottomTab, setSelectedNodeId, useWorkspaceState } from '../store/workspace-store';
import { shallowEqual } from '../store/selector';
import { recordLearningEvent } from '../store/learning-store';
import { getThemeState, useThemeState } from '../store/theme-store';
import type { ThemeMode } from '../store/theme-store';
import PanelInfoButton from './PanelInfoButton';

interface LispModeState {
  depth: number;
}

const SPECIALS = new Set([
  'define',
  'lambda',
  'let',
  'let*',
  'if',
  'cond',
  'quote',
  'begin',
  'set!',
  'and',
  'or',
  'else',
]);

const lispMode: StreamParser<LispModeState> = {
  startState: () => ({ depth: 0 }),
  token(stream, state) {
    if (stream.eatSpace()) return null;
    if (stream.peek() === ';') {
      stream.skipToEnd();
      return 'lineComment';
    }
    if (stream.peek() === '"') {
      stream.next();
      let escaped = false;
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === '"' && !escaped) break;
        escaped = ch === '\\' && !escaped;
        if (ch !== '\\') escaped = false;
      }
      return 'string';
    }
    if (stream.peek() === '(') {
      stream.next();
      state.depth++;
      return 'paren';
    }
    if (stream.peek() === ')') {
      stream.next();
      state.depth = Math.max(0, state.depth - 1);
      return 'paren';
    }
    if (stream.match(/^'[()]?/)) return 'operator';
    if (stream.match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/)) return 'number';
    if (stream.match(/^#(?:t|f)\b/)) return 'bool';
    if (stream.match(/^[^\s();]+/)) {
      return SPECIALS.has(stream.current()) ? 'keyword' : 'variableName';
    }
    stream.next();
    return null;
  },
  indent(state) {
    return state.depth * 2;
  },
  languageData: {
    commentTokens: { line: ';' },
    closeBrackets: { brackets: ['(', '[', '{', "'", '"'] },
  },
};

const lispLanguage = StreamLanguage.define(lispMode);

const lispHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: 'rgb(var(--dim-rgb))', fontStyle: 'italic' },
  { tag: [tags.keyword, tags.operator], color: 'var(--accent)' },
  { tag: [tags.number, tags.bool, tags.atom], color: 'var(--code-number)' },
  { tag: tags.string, color: 'var(--code-string)' },
  { tag: [tags.variableName, tags.name], color: 'rgb(var(--paper-rgb))' },
  { tag: [tags.paren, tags.bracket], color: 'var(--code-bracket)' },
]);

type HighlightRange = { from: number; to: number; className: string };
const setSourceHighlights = StateEffect.define<HighlightRange[]>();
const sourceHighlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    value = value.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(setSourceHighlights)) {
        value = Decoration.set(
          effect.value
            .filter((range) => range.to > range.from)
            .map((range) =>
              Decoration.mark({ class: range.className }).range(range.from, range.to),
            ),
          true,
        );
      }
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const editorThemeCompartment = new Compartment();

function createEditorTheme(mode: ThemeMode): Extension {
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: 'rgb(var(--ink-rgb))',
        color: 'rgb(var(--paper-rgb))',
        fontSize: '13px',
      },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'inherit', lineHeight: '1.6' },
      '.cm-content': { caretColor: 'var(--accent)', padding: '12px 0 48px' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: 'rgb(var(--accent-rgb) / .22)',
      },
      '.cm-gutters': {
        backgroundColor: 'rgb(var(--panel-rgb))',
        color: 'rgb(var(--dim-rgb))',
        borderRight: '1px solid rgb(var(--edge-rgb))',
      },
      '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: 'rgb(var(--paper-rgb) / .035)',
      },
      '.cm-focused': { outline: 'none' },
      '.cm-lesson-range': { backgroundColor: 'rgb(var(--accent-rgb) / .07)' },
      '.cm-trace-node': {
        backgroundColor: 'rgb(var(--trace-rgb) / .18)',
        outline: '1px solid rgb(var(--trace-rgb))',
      },
      '.cm-lintRange-error': {
        backgroundImage: 'none',
        textDecoration: 'underline wavy rgb(var(--error-rgb))',
      },
      '.cm-tooltip': {
        backgroundColor: 'rgb(var(--panel-rgb))',
        border: '1px solid rgb(var(--edge-rgb))',
        color: 'rgb(var(--paper-rgb))',
      },
      '.cm-panels': {
        backgroundColor: 'rgb(var(--panel-rgb))',
        color: 'rgb(var(--paper-rgb))',
      },
      '.cm-search input': {
        backgroundColor: 'rgb(var(--ink-rgb))',
        color: 'rgb(var(--paper-rgb))',
      },
    },
    { dark: mode === 'dark' },
  );
}

function topLevelName(
  node: ReturnType<typeof getImage>['program']['forms'][number],
): string | null {
  if (node.kind !== 'list' || node.items[0]?.kind !== 'sym' || node.items[0].name !== 'define') {
    return null;
  }
  const target = node.items[1];
  if (target?.kind === 'sym') return target.name;
  if (target?.kind === 'list' && target.items[0]?.kind === 'sym') return target.items[0].name;
  return null;
}

function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SourceEditor({ forms }: { forms: string[] | '*' }) {
  const { sourceDirty, sourceApplying, sourceDiagnostics, imageVersion } = useAppState(
    (current) => ({
      sourceDirty: current.sourceDirty,
      sourceApplying: current.sourceApplying,
      sourceDiagnostics: current.sourceDiagnostics,
      imageVersion: current.imageVersion,
    }),
    shallowEqual,
  );
  const selectedNodeId = useWorkspaceState((current) => current.selectedNodeId);
  const themeMode = useThemeState((current) => current.mode);
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const editorTextRef = useRef(getState().sourceText);
  const selectionFrameRef = useRef<number | null>(null);
  const [helpFor, setHelpFor] = useState<string | null>(null);
  const [cursorBuiltin, setCursorBuiltin] = useState<string | null>(null);
  const [lineCount, setLineCount] = useState(() => getState().sourceText.split('\n').length);

  const extensions = useMemo<Extension[]>(
    () => [
      lineNumbers(),
      highlightActiveLineGutter(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      lintGutter(),
      lispLanguage,
      syntaxHighlighting(lispHighlightStyle),
      sourceHighlightField,
      editorThemeCompartment.of(createEditorTheme(getThemeState().mode)),
      EditorView.contentAttributes.of({ 'aria-label': 'model.lisp source editor' }),
      EditorView.lineWrapping,
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            if (!applySource()) setBottomTab('problems');
            return true;
          },
        },
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const sourceText = update.state.doc.toString();
          editorTextRef.current = sourceText;
          setSourceText(sourceText);
          setLineCount((current) =>
            current === update.state.doc.lines ? current : update.state.doc.lines,
          );
        }
        if (update.selectionSet && !update.docChanged && !getState().sourceDirty) {
          if (selectionFrameRef.current !== null) {
            cancelAnimationFrame(selectionFrameRef.current);
          }
          const offset = update.state.selection.main.head;
          const image = getImage();
          selectionFrameRef.current = requestAnimationFrame(() => {
            selectionFrameRef.current = null;
            if (!viewRef.current || getState().sourceDirty || getImage() !== image) return;
            const node = image.nodeAtOffset(offset);
            setSelectedNodeId(node?.id ?? null);
            if (node?.kind === 'sym') {
              try {
                setCursorBuiltin(isBuiltin(image.lookup(node.name)) ? node.name : null);
              } catch {
                setCursorBuiltin(null);
              }
            } else {
              setCursorBuiltin(null);
            }
          });
        }
      }),
    ],
    [],
  );

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return;
    const view = new EditorView({
      state: EditorState.create({ doc: getState().sourceText, extensions }),
      parent: hostRef.current,
    });
    editorTextRef.current = view.state.doc.toString();
    viewRef.current = view;
    return () => {
      if (selectionFrameRef.current !== null) cancelAnimationFrame(selectionFrameRef.current);
      view.destroy();
      viewRef.current = null;
    };
    // The editor is intentionally constructed once; external text is synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editorThemeCompartment.reconfigure(createEditorTheme(themeMode)),
    });
  }, [themeMode]);

  useEffect(
    () =>
      subscribe(() => {
        const view = viewRef.current;
        const sourceText = getState().sourceText;
        if (!view) {
          editorTextRef.current = sourceText;
          return;
        }
        if (editorTextRef.current === sourceText) return;
        editorTextRef.current = sourceText;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: sourceText } });
        setLineCount(view.state.doc.lines);
      }),
    [],
  );

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const diagnostics: Diagnostic[] = sourceDiagnostics.map((diagnostic) => ({
      from: Math.min(diagnostic.from, view.state.doc.length),
      to: Math.min(Math.max(diagnostic.to, diagnostic.from + 1), view.state.doc.length),
      severity: 'error',
      message: diagnostic.message,
      source: diagnostic.kind,
    }));
    view.dispatch(setDiagnostics(view.state, diagnostics));
  }, [sourceDiagnostics]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || sourceDirty) {
      view?.dispatch({ effects: setSourceHighlights.of([]) });
      return;
    }
    const img = getImage();
    const highlights: HighlightRange[] = [];
    if (forms === '*') {
      highlights.push({ from: 0, to: img.program.source.length, className: 'cm-lesson-range' });
    } else {
      for (const form of img.program.forms) {
        const name = topLevelName(form);
        if (name && forms.includes(name)) {
          highlights.push({
            from: form.span.start,
            to: form.span.end,
            className: 'cm-lesson-range',
          });
        }
      }
    }
    const selected = selectedNodeId == null ? null : img.nodeById(selectedNodeId);
    if (selected) {
      highlights.push({
        from: selected.span.start,
        to: selected.span.end,
        className: 'cm-trace-node',
      });
    }
    view.dispatch({ effects: setSourceHighlights.of(highlights) });
    if (selected) {
      view.dispatch({ effects: EditorView.scrollIntoView(selected.span.start, { y: 'center' }) });
    }
  }, [forms, imageVersion, selectedNodeId, sourceDirty]);

  const run = () => {
    if (!applySource()) setBottomTab('problems');
  };

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-ink"
      data-testid="source-editor"
      onFocusCapture={() => recordLearningEvent('whole-model:opened')}
    >
      <div className="flex min-h-9 items-center border-b border-edge bg-panel text-xs">
        <div className="flex h-9 items-center gap-2 border-r border-edge border-t-2 border-t-amber bg-ink px-3 text-paper">
          <span className="text-amber">λ</span>
          <span>model.lisp</span>
          {sourceDirty && (
            <span data-testid="editor-dirty" aria-label="unsaved draft">
              ●
            </span>
          )}
          <PanelInfoButton panel="editor" />
        </div>
        <div className="ml-auto flex items-center gap-1 px-2">
          <button
            data-testid="btn-run-source"
            className="rounded bg-amber px-2 py-1 font-semibold text-accent-foreground hover:bg-amber/90 disabled:opacity-50"
            disabled={!sourceDirty || sourceApplying || sourceDiagnostics.length > 0}
            onClick={run}
            title="Run model.lisp (Cmd/Ctrl+Enter)"
          >
            {sourceApplying ? 'running…' : '▶ run'}
          </button>
          <button
            className="rounded px-2 py-1 text-dim hover:bg-paper/5 hover:text-paper disabled:opacity-40"
            disabled={!sourceDirty}
            title="Discard the unrun draft and return to the running source"
            onClick={revertSourceDraft}
          >
            revert
          </button>
          <button
            className="rounded px-2 py-1 text-dim hover:bg-paper/5 hover:text-paper max-sm:hidden"
            title="Replace the draft with the original bundled model"
            onClick={restoreBundledSourceDraft}
          >
            original
          </button>
          <button
            className="rounded px-2 py-1 text-dim hover:bg-paper/5 hover:text-paper max-sm:hidden"
            title="Copy the current model.lisp draft"
            onClick={async () => {
              await navigator.clipboard.writeText(getState().sourceText);
              setToast('model.lisp copied to clipboard');
            }}
          >
            copy
          </button>
          <button
            className="rounded px-2 py-1 text-dim hover:bg-paper/5 hover:text-paper max-sm:hidden"
            title="Download the current model.lisp draft"
            onClick={() => downloadText('model.lisp', getState().sourceText)}
          >
            download
          </button>
          <button
            className="rounded px-2 py-1 text-dim hover:bg-paper/5 hover:text-paper disabled:opacity-30 max-sm:hidden"
            disabled={!cursorBuiltin}
            onClick={() => cursorBuiltin && setHelpFor(cursorBuiltin)}
            title="Pure-Lisp reference for the builtin under the cursor"
          >
            kernel ?
          </button>
        </div>
      </div>
      {sourceDirty && (
        <div
          className="border-b border-amber/30 bg-amber/5 px-3 py-1 text-xs text-amber"
          role="status"
        >
          draft not running — live panels still show the last good model
        </div>
      )}
      <div ref={hostRef} className="min-h-0 flex-1" />
      <div className="flex min-h-6 items-center gap-3 border-t border-edge bg-panel px-2 text-[11px] text-dim">
        <span>{sourceDirty ? 'draft' : 'running source'}</span>
        <span>{lineCount} lines</span>
        {sourceDiagnostics.length > 0 && (
          <button
            data-testid="editor-diagnostics"
            className="text-error"
            title="Open source problems"
            onClick={() => setBottomTab('problems')}
          >
            × {sourceDiagnostics.length} problem{sourceDiagnostics.length === 1 ? '' : 's'}
          </button>
        )}
        <span className="ml-auto">Lisp · UTF-8</span>
      </div>
      {helpFor && <KernelRef name={helpFor} onClose={() => setHelpFor(null)} />}
    </section>
  );
}
