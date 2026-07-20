export type LearningPane =
  'lesson' | 'editor' | 'repl' | 'trace' | 'environment' | 'model' | 'playground';

export interface LearningTarget {
  pane: LearningPane;
  testId?: string;
  draft?: string;
}

export interface LearningTask {
  id: string;
  title: string;
  description: string;
  event: string;
  target: LearningTarget;
  actionLabel?: string;
}

export interface TryIt {
  command: string;
  explanation: string;
  expected: string;
}

export interface LearningGuide {
  lessonId: number;
  tasks: LearningTask[];
  tryIt: TryIt;
}

export type NextActionKind = 'applying' | 'diagnostics' | 'draft' | 'task' | 'complete';

export function resolveNextActionKind({
  sourceApplying,
  diagnostics,
  sourceDirty,
  hasCurrentTask,
}: {
  sourceApplying: boolean;
  diagnostics: number;
  sourceDirty: boolean;
  hasCurrentTask: boolean;
}): NextActionKind {
  if (sourceApplying) return 'applying';
  if (diagnostics > 0) return 'diagnostics';
  if (sourceDirty) return 'draft';
  return hasCurrentTask ? 'task' : 'complete';
}

export function normalizeReplCommand(command: string): string {
  return command.trim().replace(/\s+/g, ' ');
}

export function replEvent(command: string): string {
  return `repl:${normalizeReplCommand(command)}`;
}

export const PLAYGROUND_EXAMPLES: Array<{
  label: string;
  code: string;
  explanation: string;
}> = [
  {
    label: 'gelu → relu',
    code: '(define (gelu x) (lists->tensor (map (lambda (r) (map (lambda (v) (max v 0)) r)) (tensor->lists x))))',
    explanation: 'Redefine the activation function for this live Lisp environment.',
  },
  {
    label: 'ablate layer 2',
    code: "(set! ablated '((2 . 0) (2 . 1) (2 . 2) (2 . 3)))",
    explanation: 'Silence every attention head in layer 2 and keep the exact mutation visible.',
  },
  {
    label: 'T = 3',
    code: '(set! temperature 3.0)',
    explanation: 'Raise sampling temperature so less likely characters receive more probability.',
  },
  {
    label: 'shape of tok-emb',
    code: '(shape tok-emb)',
    explanation: 'Ask for the dimensions of the character embedding table without changing it.',
  },
  {
    label: 'generate',
    code: "(generate '(20 15 25) 40)",
    explanation: 'Continue three starting character IDs by sampling 40 more characters.',
  },
];

export const LEARNING_GUIDES: LearningGuide[] = [
  {
    lessonId: 0,
    tasks: [
      {
        id: '0.watch',
        title: 'Watch ten characters appear',
        description: 'The model repeats one forward pass for every new character.',
        event: 'hero:generated-10',
        target: { pane: 'lesson', testId: 'hero-output' },
      },
      {
        id: '0.pause',
        title: 'Pause and inspect probabilities',
        description: 'Pausing reveals the distribution used to choose the next character.',
        event: 'hero:paused',
        target: { pane: 'lesson', testId: 'hero-toggle' },
      },
      {
        id: '0.step',
        title: 'Generate exactly one step',
        description: 'Use Step to connect one model call with one output character.',
        event: 'hero:step',
        target: { pane: 'lesson', testId: 'hero-step' },
      },
      {
        id: '0.repl',
        title: 'Generate directly from Lisp',
        description: 'Stage the generation command, then press Enter in the REPL.',
        event: replEvent('(generate prompt 40)'),
        target: { pane: 'repl', draft: '(generate prompt 40)' },
      },
    ],
    tryIt: {
      command: '(generate prompt 40)',
      explanation: 'Call the Lisp generator directly with the bundled prompt and request 40 steps.',
      expected: 'A list containing the starting prompt tokens plus 40 sampled token IDs.',
    },
  },
  {
    lessonId: 1,
    tasks: [
      {
        id: '1.prompt',
        title: 'Change the prompt',
        description: 'Type a partial phrase so the model must predict what follows.',
        event: 'next-char:prompt-edited',
        target: { pane: 'lesson', testId: 's1-input' },
      },
      {
        id: '1.probs',
        title: 'Observe the updated distribution',
        description: 'The bars should change after the new prompt reaches the model.',
        event: 'next-char:probabilities-updated',
        target: { pane: 'lesson', testId: 's1-probs' },
      },
      {
        id: '1.repl',
        title: 'Ask for probabilities in Lisp',
        description: 'Stage the lesson command, then press Enter in the REPL.',
        event: replEvent("(probs '(20 8 5))"),
        target: { pane: 'repl', draft: "(probs '(20 8 5))" },
      },
    ],
    tryIt: {
      command: "(probs '(20 8 5))",
      explanation:
        'Pass three character IDs to the model and ask for the next-character probabilities.',
      expected: 'A probability tensor whose values sum to approximately one.',
    },
  },
  {
    lessonId: 2,
    tasks: [
      {
        id: '2.character',
        title: 'Select a different character',
        description: 'Choose a character to highlight its learned embedding row.',
        event: 'embeddings:character-selected',
        target: { pane: 'lesson', testId: 's2-chars' },
      },
      {
        id: '2.neighbor',
        title: 'Follow a nearest neighbor',
        description:
          'Select one of the nearby characters and compare how the neighborhood changes.',
        event: 'embeddings:neighbor-selected',
        target: { pane: 'lesson', testId: 's2-neighbors' },
      },
      {
        id: '2.repl',
        title: 'Inspect the table shape',
        description: 'Stage the shape command, then press Enter.',
        event: replEvent('(shape tok-emb)'),
        target: { pane: 'repl', draft: '(shape tok-emb)' },
      },
    ],
    tryIt: {
      command: '(shape tok-emb)',
      explanation: 'Inspect the embedding table as rows of characters by learned features.',
      expected: 'A two-number shape: vocabulary size followed by embedding width.',
    },
  },
  {
    lessonId: 3,
    tasks: [
      {
        id: '3.focus',
        title: 'Change the focus text',
        description: 'The trace and heatmap will be recomputed for the new characters.',
        event: 'attention:focus-edited',
        target: { pane: 'lesson', testId: 's3-focus' },
      },
      {
        id: '3.head',
        title: 'Choose another layer and head',
        description: 'Each head learns a different pattern of information routing.',
        event: 'attention:head-selected',
        target: { pane: 'lesson', testId: 's3-picker' },
      },
      {
        id: '3.position',
        title: 'Select a heatmap position',
        description: 'Click a cell to reveal which earlier characters feed that query.',
        event: 'attention:position-selected',
        target: { pane: 'lesson', testId: 's3-weights' },
      },
      {
        id: '3.repl',
        title: 'Inspect a query matrix',
        description: 'Stage the weight-shape command, then press Enter.',
        event: replEvent('(shape (wq (nth 0 (heads (nth 0 layers)))))'),
        target: {
          pane: 'repl',
          draft: '(shape (wq (nth 0 (heads (nth 0 layers)))))',
        },
      },
    ],
    tryIt: {
      command: '(shape (wq (nth 0 (heads (nth 0 layers)))))',
      explanation:
        'Navigate to layer 0, head 0, retrieve its query matrix, and inspect its dimensions.',
      expected: 'The query projection matrix shape for one attention head.',
    },
  },
  {
    lessonId: 4,
    tasks: [
      {
        id: '4.ablate',
        title: 'Silence one attention head',
        description:
          'Ablation changes the live `ablated` value and echoes the mutation in the REPL.',
        event: 'residual:head-ablated',
        target: { pane: 'lesson', testId: 's4-ablation-grid' },
      },
      {
        id: '4.compare',
        title: 'Compare before and after',
        description:
          'Read the changed continuation and perplexity delta produced by the damaged model.',
        event: 'residual:comparison-ready',
        target: { pane: 'lesson', testId: 's4-diff' },
      },
    ],
    tryIt: {
      command: "(set! ablated '((0 . 0) (0 . 1)))",
      explanation:
        'Store two layer/head pairs in `ablated`, causing those attention heads to output zeros.',
      expected: 'The mutation is echoed, and the continuation/perplexity comparison updates.',
    },
  },
  {
    lessonId: 5,
    tasks: [
      {
        id: '5.temperature',
        title: 'Change temperature',
        description: 'Move the control and watch the literal in the running source change with it.',
        event: 'temperature:changed',
        target: { pane: 'lesson', testId: 's5-knob' },
      },
      {
        id: '5.topk',
        title: 'Turn top-k filtering on',
        description: 'Wrap the logits so sampling considers only the 40 strongest candidates.',
        event: 'temperature:topk-toggled',
        target: { pane: 'lesson', testId: 's5-topk' },
      },
      {
        id: '5.repl',
        title: 'Set temperature from Lisp',
        description: 'Stage the mutation, press Enter, and watch the control move.',
        event: replEvent('(set! temperature 2.0)'),
        target: { pane: 'repl', draft: '(set! temperature 2.0)' },
      },
    ],
    tryIt: {
      command: '(set! temperature 2.0)',
      explanation: 'Mutate the same live `temperature` binding used by the source control.',
      expected: 'The temperature control moves to 2.00 and future sampling becomes flatter.',
    },
  },
  {
    lessonId: 6,
    tasks: [
      {
        id: '6.open',
        title: 'Open the complete model source',
        description: 'The center editor is the exact Lisp program backing every lesson.',
        event: 'whole-model:opened',
        target: { pane: 'editor', testId: 'source-editor' },
      },
      {
        id: '6.apply',
        title: 'Edit and Run the source',
        description: 'Apply a valid change to atomically replace the running model.',
        event: 'source:applied',
        target: { pane: 'editor', testId: 'btn-run-source' },
      },
      {
        id: '6.copy',
        title: 'Copy the whole model',
        description: 'Copy the complete applied source as ordinary text.',
        event: 'whole-model:copied',
        target: { pane: 'lesson', testId: 's6-copy' },
      },
    ],
    tryIt: {
      command: "(generate '(20) 40)",
      explanation: 'Start with token ID 20 and recursively append 40 sampled tokens.',
      expected: 'A list of 41 token IDs—the original token plus 40 generated ones.',
    },
  },
  {
    lessonId: 7,
    tasks: [
      {
        id: '7.example',
        title: 'Stage and run an example',
        description: 'Choose an example, inspect it in the REPL, then press Enter.',
        event: 'playground:example-run',
        target: { pane: 'lesson', testId: 's7-examples' },
      },
      {
        id: '7.environment',
        title: 'Choose an environment binding',
        description: 'Selecting a symbol stages its name in the REPL for inspection.',
        event: 'environment:binding-selected',
        target: { pane: 'environment', testId: 's7-env' },
      },
      {
        id: '7.trace',
        title: 'Select a traced expression',
        description: 'Choose an AST node to inspect its runtime value and source span.',
        event: 'trace:node-selected',
        target: { pane: 'trace', testId: 's7-inspector' },
      },
    ],
    tryIt: {
      command: '(help)',
      explanation:
        'Ask the live Lisp environment to list the forms and primitives available to you.',
      expected: 'A categorized help listing in the REPL transcript.',
    },
  },
  {
    lessonId: 8,
    tasks: [
      {
        id: '8.model',
        title: 'Open the running model facts',
        description: 'Compare source-derived and manifest-derived dimensions in Model Info.',
        event: 'model-info:opened',
        target: { pane: 'model', testId: 'model-info' },
      },
      {
        id: '8.repl',
        title: 'Ask how many layers are live',
        description: 'Stage the command, press Enter, and compare the result with Model Info.',
        event: replEvent('(length layers)'),
        target: { pane: 'repl', draft: '(length layers)' },
      },
      {
        id: '8.explore',
        title: 'Continue in the playground',
        description: 'Return to the editable examples and choose what to investigate next.',
        event: 'exploration:continued',
        target: { pane: 'playground', testId: 's7-examples' },
        actionLabel: 'Open playground',
      },
    ],
    tryIt: {
      command: '(length layers)',
      explanation: 'Count the layer records bound in this browser’s live model environment.',
      expected: 'The same layer count shown in Model Info and the checkpoint manifest.',
    },
  },
];

export function getLearningGuide(lessonId: number): LearningGuide {
  return LEARNING_GUIDES[lessonId] ?? LEARNING_GUIDES[0];
}
