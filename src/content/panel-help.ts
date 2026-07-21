export type PanelHelpId =
  | 'learn'
  | 'files'
  | 'editor'
  | 'kernels'
  | 'lesson'
  | 'trace'
  | 'environment'
  | 'references'
  | 'model'
  | 'repl'
  | 'problems';

export const PANEL_HELP: Record<PanelHelpId, { title: string; description: string }> = {
  learn: {
    title: 'Learn',
    description:
      'Follow the lessons in order or jump directly to a topic. The checklist records real interactions, while the Next bar always points to the first unfinished action.',
  },
  files: {
    title: 'Files',
    description:
      'Open the complete editable model or the read-only reference kernels. The checkpoint files provide the trained dimensions and weights used by the live Lisp environment.',
  },
  editor: {
    title: 'model.lisp editor',
    description:
      'This is the complete running model source. Edits remain a draft until Run or Cmd/Ctrl+Enter builds and validates a candidate; a failed draft never replaces the last good model.',
  },
  kernels: {
    title: 'Kernel reference',
    description:
      'These pure-Lisp definitions explain the native tensor primitives used for speed. This file is read-only and educational—the runtime still executes the equivalent browser kernels.',
  },
  lesson: {
    title: 'Lesson output',
    description:
      'This panel is the live experiment for the selected lesson. The labeled model.lisp excerpt mirrors running source but is not a text editor: hover or click expressions to inspect them, drag an underlined value when offered, or choose Edit source to type normally.',
  },
  trace: {
    title: 'Trace',
    description:
      'Browse the evaluated Lisp syntax tree from the latest traced forward pass. Select a node to inspect its runtime value and reveal the matching source span in the editor.',
  },
  environment: {
    title: 'Environment',
    description:
      'Search every live binding: functions, values, tensors, and model records. Selecting a binding puts its name in the REPL so it can be inspected without retyping it.',
  },
  references: {
    title: 'References',
    description:
      'Read the papers, historical sources, implementation notes, and training material cited throughout the lessons. Citation links open the relevant entry here.',
  },
  model: {
    title: 'Model Info',
    description:
      'Inspect dimensions and counts derived from the active checkpoint manifest and Lisp AST, including layers, heads, context, vocabulary, source lines, and current seed.',
  },
  repl: {
    title: 'REPL',
    description:
      'Evaluate Lisp directly against the one live model environment. Enter runs a complete form, Shift+Enter adds a line, ↑/↓ browse history, and `(help)` lists available primitives.',
  },
  problems: {
    title: 'Problems',
    description:
      'Review syntax, runtime, and model-contract diagnostics for the editor draft. The last good model remains active while these errors are fixed or the draft is reverted.',
  },
};
