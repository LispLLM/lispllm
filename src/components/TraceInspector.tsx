import { memo, useEffect, useMemo } from 'react';
import type { Ast } from '../lisp/types';
import { isTensor } from '../lisp/types';
import { printValue } from '../lisp/printer';
import { nodeSource } from '../model/queries';
import type { Trace } from '../model/trace';
import {
  getImage,
  getState,
  scheduleRetrace,
  setFocusString,
  useAppState,
} from '../store/app-store';
import { shallowEqual } from '../store/selector';
import { setSelectedNodeId, useWorkspaceState } from '../store/workspace-store';
import { recordLearningEvent } from '../store/learning-store';
import TensorView from './TensorView';

const TraceTreeNode = memo(function TraceTreeNodeComponent({
  node,
  depth,
  image,
  trace,
}: {
  node: Ast;
  depth: number;
  image: ReturnType<typeof getImage>;
  trace: Trace | null;
}) {
  const selected = useWorkspaceState((current) => current.selectedNodeId === node.id);
  const source = nodeSource(image.program, node).replace(/\n\s*/g, ' ');
  const label = source.length > 48 ? `${source.slice(0, 45)}…` : source;
  const traced = trace?.entries.has(node.id);
  const children =
    node.kind === 'list' && depth < 5 ? node.items.filter((child) => child.kind === 'list') : [];
  return (
    <div role="treeitem" aria-selected={selected}>
      <button
        className={`flex min-h-6 w-full items-center truncate text-left text-xs ${
          selected
            ? 'bg-amber/10 text-amber'
            : traced
              ? 'text-paper hover:bg-paper/5'
              : 'text-dim hover:bg-paper/5 hover:text-paper'
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => {
          setSelectedNodeId(node.id);
          recordLearningEvent('trace:node-selected');
        }}
        title={source}
      >
        <span className="mr-1 text-dim">{children.length > 0 ? '⌄' : '·'}</span>
        <span className="truncate">{label}</span>
      </button>
      {children.length > 0 && (
        <div role="group">
          {children.map((child) => (
            <TraceTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              image={image}
              trace={trace}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default function TraceInspector() {
  const { trace, imageVersion } = useAppState(
    (current) => ({ trace: current.trace, imageVersion: current.imageVersion }),
    shallowEqual,
  );
  const selectedNodeId = useWorkspaceState((current) => current.selectedNodeId);
  const img = getImage();
  void imageVersion;
  const selected = selectedNodeId == null ? null : img.nodeById(selectedNodeId);
  const tracedValue = useMemo(
    () => (selectedNodeId == null || !trace ? null : (trace.entries.get(selectedNodeId) ?? null)),
    [selectedNodeId, trace],
  );

  useEffect(() => {
    if (trace) return;
    if (getState().focusString) scheduleRetrace();
    else setFocusString('ROMEO: ');
  }, [trace]);

  return (
    <section className="flex h-full min-h-0 flex-col" data-testid="s7-inspector">
      <div className="border-b border-edge px-3 py-2 text-[11px] uppercase tracking-wider text-dim">
        trace · {trace?.entries.size ?? 0} recorded nodes
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1" role="tree" aria-label="model trace">
        {img.program.forms.map((form) => (
          <TraceTreeNode key={form.id} node={form} depth={0} image={img} trace={trace} />
        ))}
      </div>
      <div className="max-h-[42%] overflow-auto border-t border-edge p-3">
        {tracedValue && isTensor(tracedValue.value) ? (
          <TensorView
            tensor={tracedValue.value}
            maxWidth={360}
            ariaLabel="traced value of the selected source node"
          />
        ) : tracedValue ? (
          <pre className="whitespace-pre-wrap text-xs text-paper">
            {printValue(tracedValue.value)}
          </pre>
        ) : (
          <span className="text-xs text-dim">
            {selected
              ? 'no traced value for this node in the latest forward pass'
              : 'select a source node to inspect its traced value'}
          </span>
        )}
      </div>
    </section>
  );
}
