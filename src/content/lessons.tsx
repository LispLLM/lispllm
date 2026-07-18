import type { ReactNode } from 'react';
import Cite from '../components/Cite';
import { GO_DEEPER } from './references';
import { getImage, setReplDraft, useAppState } from '../store/app-store';
import { setBottomTab } from '../store/workspace-store';
import { isTensor } from '../lisp/types';

export interface Lesson {
  id: number;
  title: string;
  shortTitle: string;
  summary: string;
  forms: string[] | '*';
  tryCommand: string;
}

export const LESSONS: Lesson[] = [
  {
    id: 0,
    title: 'A language model in one page of Lisp',
    shortTitle: 'Start here',
    summary:
      'Watch the browser execute a complete language model and generate one character at a time.',
    forms: ['temperature', 'next-token', 'generate'],
    tryCommand: '(generate prompt 40)',
  },
  {
    id: 1,
    title: 'It only ever does one thing',
    shortTitle: 'Next character',
    summary:
      'A forward pass turns the current text into one distribution over possible next characters.',
    forms: ['gpt', 'next-token'],
    tryCommand: "(probs '(20 8 5))",
  },
  {
    id: 2,
    title: 'Letters become vectors',
    shortTitle: 'Embeddings',
    summary: 'The model begins by replacing every character with a learned row of numbers.',
    forms: ['embed'],
    tryCommand: '(shape tok-emb)',
  },
  {
    id: 3,
    title: 'Attention is three questions',
    shortTitle: 'Attention',
    summary: 'Queries, keys, and values decide which earlier characters each position can use.',
    forms: ['head'],
    tryCommand: '(shape (wq (nth 0 (heads (nth 0 layers)))))',
  },
  {
    id: 4,
    title: 'The residual stream',
    shortTitle: 'Residual stream',
    summary:
      'Layers add corrections to a shared stream; ablation reveals what each attention head contributes.',
    forms: ['ablated', 'attention', 'block'],
    tryCommand: "(set! ablated '((0 . 0) (0 . 1)))",
  },
  {
    id: 5,
    title: 'Temperature is one number in the code',
    shortTitle: 'Temperature',
    summary:
      'One visible source literal controls whether sampling is conservative or unpredictable.',
    forms: ['temperature', 'next-token'],
    tryCommand: '(set! temperature 2.0)',
  },
  {
    id: 6,
    title: 'The whole model, one file',
    shortTitle: 'Whole model',
    summary: 'The source in the editor is the complete model that every live panel is evaluating.',
    forms: '*',
    tryCommand: "(generate '(20) 40)",
  },
  {
    id: 7,
    title: 'The playground',
    shortTitle: 'Playground',
    summary:
      'Inspect every binding and traced expression, then redefine the running model from the REPL.',
    forms: ['gelu', 'generate'],
    tryCommand: '(help)',
  },
  {
    id: 8,
    title: "What ChatGPT has that this doesn't",
    shortTitle: 'Scale and limits',
    summary:
      'The architecture is recognizable; tokenization, caching, alignment, and scale are not.',
    forms: ['gpt'],
    tryCommand: '(length layers)',
  },
];

function LessonBody({ id }: { id: number }): ReactNode {
  const { imageVersion } = useAppState();
  const img = getImage();
  void imageVersion;
  const charset = img.checkpoint.manifest.charset;
  let tokWidth: number | string = '…';
  try {
    const tokEmb = img.lookup('tok-emb');
    if (isTensor(tokEmb)) tokWidth = tokEmb.shape[1];
  } catch {
    /* custom source may omit the optional view */
  }
  const lineCount = img.program.source.trimEnd().split('\n').length;
  const defineCount = img.program.forms.filter(
    (f) => f.kind === 'list' && f.items[0]?.kind === 'sym' && f.items[0].name === 'define',
  ).length;
  const params = img.checkpoint.manifest.params;

  switch (id) {
    case 0:
      return (
        <p>
          The model is running in this browser. The output panel calls the same Lisp definitions
          visible in the editor, one character at a time. Pause it, inspect the probabilities, then
          change the code and run it again.
        </p>
      );
    case 1:
      return (
        <p>
          Type in the output panel. After each keystroke the model reads the current text and
          produces one distribution: the probability of every possible next character. A larger
          conversational model repeats this same objective at scale <Cite n={12} />.
        </p>
      );
    case 2:
      return (
        <p>
          The model knows {charset.length} characters. Each becomes a row of {tokWidth} learned
          numbers in <span className="text-paper">tok-emb</span>. Characters used in similar places
          become nearby vectors; uppercase and lowercase pairs often find each other. Lookup is the
          Lisp primitive <span className="text-paper">rows</span>.
        </p>
      );
    case 3:
      return (
        <p>
          Every position asks what it seeks (q), what earlier positions contain (k), and what they
          can pass along (v) <Cite n={1} /> <Cite n={7} />. The heatmap shows the resulting weights.
          Its dark upper triangle is the causal mask: future characters remain unavailable
          <Cite n={10} />.
        </p>
      );
    case 4:
      return (
        <p>
          Transformer layers add corrections instead of replacing their input. The bars measure
          attention and MLP contributions to that shared residual stream <Cite n={9} />. Silence a
          head to compare continuations and perplexity; the exact mutation is echoed in the REPL
          <Cite n={8} />.
        </p>
      );
    case 5:
      return (
        <p>
          Sampling divides logits by <span className="text-paper">temperature</span>. Lower values
          sharpen the distribution; higher values flatten it toward noise <Cite n={11} />. The knob
          edits the running source, and a REPL mutation moves the knob back. The editor remains the
          visible source of truth.
        </p>
      );
    case 6:
      return (
        <p>
          The editor contains the entire applied model: {lineCount} lines, {defineCount} defines,
          and {(params / 1000).toFixed(0)}k parameters. McCarthy fit a language on a page
          <Cite n={2} /> <Cite n={5} />; the transformer fits too <Cite n={3} /> <Cite n={6} />.
          Edit a definition, then Run to atomically replace the live image.
        </p>
      );
    case 7:
      return (
        <p>
          This is one Lisp environment containing every definition, weight, and intermediate tensor.
          Use the Environment and Trace tabs to inspect it from any lesson. Example chips send real
          forms to the REPL. The model has read only the Tiny Shakespeare corpus
          <Cite n={13} />.
        </p>
      );
    case 8:
      return (
        <p>
          This model lacks BPE tokenization, a KV cache, instruction tuning, RLHF,
          mixture-of-experts, and scale <Cite n={11} />. It recomputes its context for every
          character. The architecture, however, is the same kind of transformer used by larger
          systems <Cite n={3} />. The repo includes training code and a path onward <Cite n={4} />.
        </p>
      );
    default:
      return null;
  }
}

export function LessonDocument({ lesson }: { lesson: Lesson }) {
  const goDeeper = GO_DEEPER[lesson.id];
  return (
    <article className="space-y-4 px-4 py-5 text-sm leading-6 text-dim" data-testid="lesson-doc">
      <header>
        <div className="mb-2 text-[11px] uppercase tracking-widest text-amber">
          lesson {lesson.id} of {LESSONS.length - 1}
        </div>
        <h1 className="text-xl leading-7 text-paper">{lesson.title}</h1>
        <p className="mt-2 text-xs leading-5 text-dim">{lesson.summary}</p>
      </header>
      <div className="border-l-2 border-edge pl-3">
        <LessonBody id={lesson.id} />
      </div>
      {goDeeper && (
        <details className="rounded border border-edge bg-ink/50 px-3 py-2">
          <summary className="cursor-pointer text-xs text-paper">go deeper</summary>
          <p className="mt-2 text-xs leading-5 text-dim">{goDeeper}</p>
        </details>
      )}
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">try in the REPL</div>
        <button
          className="w-full overflow-hidden text-ellipsis rounded border border-edge bg-panel px-3 py-2 text-left text-xs text-amber hover:border-amber"
          onClick={() => {
            setReplDraft(lesson.tryCommand);
            setBottomTab('repl');
          }}
        >
          {lesson.tryCommand}
        </button>
      </div>
    </article>
  );
}
