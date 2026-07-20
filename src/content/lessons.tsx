import type { ReactNode } from 'react';
import Cite from '../components/Cite';
import TryThisCard from '../components/TryThisCard';
import { navigateToLearningTarget } from '../components/learning-actions';
import { GO_DEEPER } from './references';
import { getImage, useAppState } from '../store/app-store';
import { getLearningGuide } from './learning';
import { resetLearningProgress, useLearningState } from '../store/learning-store';
import { isTensor } from '../lisp/types';

export interface Lesson {
  id: number;
  title: string;
  shortTitle: string;
  summary: string;
  forms: string[] | '*';
}

export const LESSONS: Lesson[] = [
  {
    id: 0,
    title: 'A language model in one page of Lisp',
    shortTitle: 'Start here',
    summary:
      'Watch the browser execute a complete language model and generate one character at a time.',
    forms: ['temperature', 'next-token', 'generate'],
  },
  {
    id: 1,
    title: 'It only ever does one thing',
    shortTitle: 'Next character',
    summary:
      'A forward pass turns the current text into one distribution over possible next characters.',
    forms: ['gpt', 'next-token'],
  },
  {
    id: 2,
    title: 'Letters become vectors',
    shortTitle: 'Embeddings',
    summary: 'The model begins by replacing every character with a learned row of numbers.',
    forms: ['embed'],
  },
  {
    id: 3,
    title: 'Attention is three questions',
    shortTitle: 'Attention',
    summary: 'Queries, keys, and values decide which earlier characters each position can use.',
    forms: ['head'],
  },
  {
    id: 4,
    title: 'The residual stream',
    shortTitle: 'Residual stream',
    summary:
      'Layers add corrections to a shared stream; ablation reveals what each attention head contributes.',
    forms: ['ablated', 'attention', 'block'],
  },
  {
    id: 5,
    title: 'Temperature is one number in the code',
    shortTitle: 'Temperature',
    summary:
      'One visible source literal controls whether sampling is conservative or unpredictable.',
    forms: ['temperature', 'next-token'],
  },
  {
    id: 6,
    title: 'The whole model, one file',
    shortTitle: 'Whole model',
    summary: 'The source in the editor is the complete model that every live panel is evaluating.',
    forms: '*',
  },
  {
    id: 7,
    title: 'The playground',
    shortTitle: 'Playground',
    summary:
      'Inspect every binding and traced expression, then redefine the running model from the REPL.',
    forms: ['gelu', 'generate'],
  },
  {
    id: 8,
    title: "What ChatGPT has that this doesn't",
    shortTitle: 'Scale and limits',
    summary:
      'The architecture is recognizable; tokenization, caching, alignment, and scale are not.',
    forms: ['gpt'],
  },
];

function LessonBody({ id }: { id: number }): ReactNode {
  const imageVersion = useAppState((current) => current.imageVersion);
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
  const guide = getLearningGuide(lesson.id);
  const completed = useLearningState((current) => current.completed);
  const currentTask = guide.tasks.find((task) => !completed.includes(task.id));
  const completedCount = guide.tasks.filter((task) => completed.includes(task.id)).length;
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
      <section className="rounded border border-edge bg-ink/40 p-3" data-testid="lesson-checklist">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-paper">
            Lesson checklist
          </div>
          <span className="text-[10px] text-dim">
            {completedCount}/{guide.tasks.length}
          </span>
        </div>
        <div className="space-y-1">
          {guide.tasks.map((task) => {
            const done = completed.includes(task.id);
            const current = currentTask?.id === task.id;
            return (
              <button
                key={task.id}
                className={`flex w-full gap-2 rounded px-2 py-2 text-left text-xs ${
                  current
                    ? 'bg-amber/10 text-paper'
                    : done
                      ? 'text-dim'
                      : 'text-paper hover:bg-paper/5'
                }`}
                data-testid={`learning-task-${task.id}`}
                data-state={done ? 'complete' : current ? 'current' : 'pending'}
                onClick={() => navigateToLearningTarget(task.target)}
              >
                <span className="sr-only">
                  {done ? 'Completed: ' : current ? 'Next: ' : 'Pending: '}
                </span>
                <span className={done ? 'text-amber' : current ? 'text-amber' : 'text-dim'}>
                  {done ? '✓' : current ? '→' : '○'}
                </span>
                <span>
                  <span className={done ? 'line-through decoration-edge' : ''}>{task.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-paper/70">
                    {task.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <button
          className="mt-2 text-[10px] text-dim underline hover:text-paper"
          onClick={resetLearningProgress}
        >
          reset learning progress
        </button>
      </section>
      {goDeeper && (
        <details className="rounded border border-edge bg-ink/50 px-3 py-2">
          <summary className="cursor-pointer text-xs text-paper">go deeper</summary>
          <p className="mt-2 text-xs leading-5 text-dim">{goDeeper}</p>
        </details>
      )}
      <details className="rounded border border-edge bg-ink/50 px-3 py-2">
        <summary className="cursor-pointer text-xs text-paper">New to Lisp?</summary>
        <div className="mt-2 space-y-2 text-xs leading-5 text-dim">
          <p>
            Parentheses mean “call this”: <code className="text-paper">(+ 1 2)</code> calls{' '}
            <code className="text-paper">+</code> with two values. Lisp uses the same shape for
            model operations such as <code className="text-paper">(gpt tokens)</code>.
          </p>
          <p>
            <code className="text-paper">define</code> creates a value or function;{' '}
            <code className="text-paper">let</code> and <code className="text-paper">let*</code>{' '}
            name intermediate values. A leading quote makes data instead of a call:{' '}
            <code className="text-paper">'(1 2 3)</code>.
          </p>
          <p>
            Semicolons begin comments. Every expression returns a value, so the REPL can inspect
            almost any piece of the model directly.
          </p>
        </div>
      </details>
      <TryThisCard lessonId={lesson.id} example={guide.tryIt} />
    </article>
  );
}
