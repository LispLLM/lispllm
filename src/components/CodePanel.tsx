/**
 * CodePanel (§12.1): renders top-level forms selected by name from the
 * program actually evaluated in the image (code is truth), via the AST with
 * exact source layout. Paren-depth tinting, role-based token colors, hover →
 * traced shape/value preview, click → inspect echo, "?" affordance on
 * primitive names (INV-3), drag affordance on knob-bound literals.
 */
import { useMemo, useState } from 'react';
import type { Ast, Value } from '../lisp/types';
import { isBuiltin, isTensor } from '../lisp/types';
import { printValue } from '../lisp/printer';
import { appendTranscript, getImage, useAppState } from '../store/app-store';

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

const PAREN_COLORS = ['text-[#8a857a]', 'text-[#a89a6a]', 'text-[#7a8a95]'];

export interface EditableLiteral {
  /** matches a literal node in the current program */
  nodeId: number;
  /** convert a drag delta (px) to a new lexeme, given the current one */
  onDrag: (deltaPx: number) => void;
  onDragEnd?: () => void;
}

export interface CodePanelProps {
  /** names of top-level defines to render; '*' renders the whole program */
  forms: string[] | '*';
  highlightIds?: Set<number>;
  onNodeHover?: (node: Ast | null) => void;
  editable?: EditableLiteral[];
  onPrimitiveHelp?: (name: string) => void;
  dense?: boolean;
  testId?: string;
}

function previewValue(v: Value): string {
  if (isTensor(v)) return `tensor [${v.shape.join(' ')}]`;
  const s = printValue(v);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}

export default function CodePanel({
  forms,
  highlightIds,
  onNodeHover,
  editable,
  onPrimitiveHelp,
  dense,
  testId,
}: CodePanelProps) {
  const { imageVersion, trace } = useAppState();
  const [status, setStatus] = useState<string | null>(null);

  const img = getImage();
  const program = img.program;

  const selected = useMemo(() => {
    void imageVersion;
    if (forms === '*') return program.forms;
    const byName = new Map<string, Ast>();
    for (const f of program.forms) {
      if (f.kind === 'list' && f.items[0]?.kind === 'sym' && f.items[0].name === 'define') {
        const t = f.items[1];
        if (t?.kind === 'sym') byName.set(t.name, f);
        else if (t?.kind === 'list' && t.items[0]?.kind === 'sym') byName.set(t.items[0].name, f);
      }
    }
    return forms.map((n) => byName.get(n)).filter((f): f is Ast => !!f);
  }, [forms, program, imageVersion]);

  const inspect = (node: Ast) => {
    const src = program.source.slice(node.span.start, node.span.end);
    const entry = trace?.entries.get(node.id);
    let text: string;
    if (entry) {
      text = `;; inspect: ${src.length > 40 ? src.slice(0, 37) + '…' : src} ⇒ ${previewValue(entry.value)}`;
    } else {
      try {
        text = `;; inspect: ${src.length > 40 ? src.slice(0, 37) + '…' : src} ⇒ ${previewValue(img.evalExpr(src))}`;
      } catch {
        text = `;; inspect: ${src.slice(0, 40)} — no traced value (hover after a forward pass)`;
      }
    }
    appendTranscript([{ kind: 'inspect', text }]);
  };

  const hoverNode = (node: Ast | null) => {
    onNodeHover?.(node);
    if (!node) {
      setStatus(null);
      return;
    }
    const entry = trace?.entries.get(node.id);
    if (entry) {
      setStatus(
        `${program.source.slice(node.span.start, Math.min(node.span.end, node.span.start + 30))} ⇒ ${previewValue(entry.value)}${
          entry.layerId !== undefined
            ? `  (layer ${entry.layerId}${entry.headId !== undefined ? ` head ${entry.headId}` : ''})`
            : ''
        }`,
      );
    } else if (node.kind === 'sym') {
      try {
        const v = img.lookup(node.name);
        setStatus(`${node.name} ⇒ ${previewValue(v)}`);
      } catch {
        setStatus(node.name);
      }
    } else {
      setStatus(null);
    }
  };

  const renderGap = (text: string, key: string) => {
    if (!text) return null;
    // comments live in the gaps; color them
    const parts = text.split(/(;[^\n]*)/g);
    return (
      <span key={key}>
        {parts.map((p, i) =>
          p.startsWith(';') ? (
            <span key={i} className="text-dim italic">
              {p}
            </span>
          ) : (
            p
          ),
        )}
      </span>
    );
  };

  const renderNode = (node: Ast, depth: number, headPos: boolean): React.ReactNode => {
    const hl = highlightIds?.has(node.id);
    const common = {
      onMouseEnter: (e: React.MouseEvent) => {
        e.stopPropagation();
        hoverNode(node);
      },
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        inspect(node);
      },
    };
    const hlCls = hl ? 'bg-amber/20 rounded-sm' : '';

    if (node.kind === 'list') {
      const color = PAREN_COLORS[depth % 3];
      const children: React.ReactNode[] = [];
      let pos = node.span.start + 1;
      const items = node.tail ? [...node.items, node.tail] : node.items;
      items.forEach((child, i) => {
        children.push(renderGap(program.source.slice(pos, child.span.start), `g${i}`));
        children.push(
          <span key={`c${i}`}>{renderNode(child, depth + 1, i === 0 && !node.tail)}</span>,
        );
        pos = child.span.end;
      });
      children.push(renderGap(program.source.slice(pos, node.span.end - 1), 'gend'));
      return (
        <span {...common} data-node-id={node.id} className={`hover:bg-paper/5 rounded-sm ${hlCls}`}>
          <span className={color}>(</span>
          {children}
          <span className={color}>)</span>
        </span>
      );
    }

    const text = program.source.slice(node.span.start, node.span.end);
    let cls = 'text-paper';
    let helpBtn: React.ReactNode = null;
    if (node.kind === 'num') {
      cls = 'text-[#d0a45c]';
      const edit = editable?.find((e) => e.nodeId === node.id);
      if (edit) {
        return (
          <DraggableLiteral
            key={node.id}
            nodeId={node.id}
            text={text}
            onDrag={edit.onDrag}
            onDragEnd={edit.onDragEnd}
          />
        );
      }
    } else if (node.kind === 'str') {
      cls = 'text-[#9aa87a]';
    } else if (node.kind === 'sym') {
      if (SPECIALS.has(node.name)) cls = 'text-[#c8b287]';
      else if (headPos) {
        try {
          const v = img.lookup(node.name);
          if (isBuiltin(v)) {
            cls = 'text-[#8fb0c0]';
            if (onPrimitiveHelp) {
              helpBtn = (
                <button
                  className="ml-0.5 align-super text-[9px] text-dim hover:text-amber"
                  aria-label={`reference implementation of ${node.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrimitiveHelp(node.name);
                  }}
                >
                  ?
                </button>
              );
            }
          } else cls = 'text-[#c99a9a]';
        } catch {
          /* locally-bound */
        }
      }
    }
    return (
      <span
        {...common}
        data-node-id={node.id}
        className={`${cls} hover:bg-paper/10 rounded-sm ${hlCls}`}
      >
        {text}
        {helpBtn}
      </span>
    );
  };

  return (
    <div
      data-testid={testId}
      className="min-w-0 max-w-full rounded border border-edge bg-panel p-4"
    >
      <pre
        className={`overflow-x-auto whitespace-pre font-mono ${dense ? 'text-xs leading-5' : 'text-sm leading-6'}`}
        onMouseLeave={() => hoverNode(null)}
      >
        {selected.map((f, i) => (
          <div key={f.id}>
            {i > 0 && '\n'}
            {renderNode(f, 0, false)}
          </div>
        ))}
      </pre>
      <div
        className="mt-2 h-5 truncate border-t border-edge pt-1 text-xs text-dim"
        aria-live="polite"
      >
        {status ?? 'hover a node to see its traced value; click to inspect in the repl'}
      </div>
    </div>
  );
}

function DraggableLiteral({
  nodeId,
  text,
  onDrag,
  onDragEnd,
}: {
  nodeId: number;
  text: string;
  onDrag: (deltaPx: number) => void;
  onDragEnd?: () => void;
}) {
  return (
    <span
      data-node-id={nodeId}
      data-testid="knob-literal"
      className="cursor-ew-resize rounded-sm bg-amber/15 px-0.5 text-amber underline decoration-dotted"
      title="drag to change"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const x0 = e.clientX;
        const move = (ev: MouseEvent) => onDrag(ev.clientX - x0);
        const up = () => {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
          onDragEnd?.();
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      }}
    >
      {text}
    </span>
  );
}
