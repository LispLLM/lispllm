/** References data (§14). The panel is the only home for external links. */
export interface Reference {
  n: number;
  title: string;
  authors: string;
  year: string;
  url: string | null;
  why: string;
  citedBy: number[];
}

export const REFERENCES: Reference[] = [
  {
    n: 1,
    title: 'Attention Is All You Need',
    authors: 'Vaswani et al.',
    year: '2017',
    url: 'https://arxiv.org/abs/1706.03762',
    why: 'The paper that introduced the transformer — the exact architecture in §3, minus the encoder.',
    citedBy: [3],
  },
  {
    n: 2,
    title: 'Recursive Functions of Symbolic Expressions and Their Computation by Machine',
    authors: 'McCarthy',
    year: '1960',
    url: 'https://www-formal.stanford.edu/jmc/recursive.html',
    why: 'The original Lisp paper. The eval that runs this page descends from its Figure 1.',
    citedBy: [6],
  },
  {
    n: 3,
    title: 'nanoGPT',
    authors: 'Karpathy',
    year: '2022',
    url: 'https://github.com/karpathy/nanoGPT',
    why: 'The training loop in train.py is a compressed nanoGPT; the architecture matches head-for-head.',
    citedBy: [6, 8],
  },
  {
    n: 4,
    title: "Let's build GPT: from scratch, in code, spelled out",
    authors: 'Karpathy',
    year: '2023',
    url: 'https://www.youtube.com/watch?v=kCc8FmEb1nY',
    why: 'The best next step after this page: build the same model yourself, line by line.',
    citedBy: [8],
  },
  {
    n: 5,
    title: 'The Roots of Lisp',
    authors: 'Graham',
    year: '2002',
    url: 'https://paulgraham.com/rootsoflisp.html',
    why: 'Why seven primitives suffice for a language — the same economy this page aims at for a model.',
    citedBy: [6],
  },
  {
    n: 6,
    title: 'The Little Learner',
    authors: 'Friedman & Mendhekar',
    year: '2023',
    url: 'https://mitpress.mit.edu/9780262546379/the-little-learner/',
    why: 'Deep learning built up in Scheme, question by question. Kin to everything here.',
    citedBy: [6],
  },
  {
    n: 7,
    title: 'The Illustrated Transformer',
    authors: 'Alammar',
    year: '2018',
    url: 'https://jalammar.github.io/illustrated-transformer/',
    why: 'The canonical pictures of q, k, v. §3 is those pictures, computed live.',
    citedBy: [3],
  },
  {
    n: 8,
    title: 'LLM Visualization',
    authors: 'Bycroft',
    year: '2023',
    url: 'https://bbycroft.net/llm',
    why: 'A 3-D walkthrough of the same computation, at nanoGPT scale.',
    citedBy: [4],
  },
  {
    n: 9,
    title: 'A Mathematical Framework for Transformer Circuits',
    authors: 'Elhage et al.',
    year: '2021',
    url: 'https://transformer-circuits.pub/2021/framework/index.html',
    why: 'Where "residual stream" comes from: layers read from and write to a shared channel.',
    citedBy: [4],
  },
  {
    n: 10,
    title: 'In-context Learning and Induction Heads',
    authors: 'Olsson et al.',
    year: '2022',
    url: 'https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html',
    why: 'What attention heads actually do — try to spot an induction head in the §3 grid.',
    citedBy: [3],
  },
  {
    n: 11,
    title: 'The Curious Case of Neural Text Degeneration',
    authors: 'Holtzman et al.',
    year: '2020',
    url: 'https://arxiv.org/abs/1904.09751',
    why: 'Why sampling strategy matters: temperature and top-k, studied carefully.',
    citedBy: [5, 8],
  },
  {
    n: 12,
    title: 'Language Models are Unsupervised Multitask Learners (GPT-2)',
    authors: 'Radford et al.',
    year: '2019',
    url: 'https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf',
    why: 'Next-token prediction at scale turns out to be enough. §1 is the same objective, tiny.',
    citedBy: [1],
  },
  {
    n: 13,
    title: 'Tiny Shakespeare corpus',
    authors: 'Karpathy (char-rnn)',
    year: '2015',
    url: 'https://github.com/karpathy/char-rnn',
    why: 'The 1.1 MB of Shakespeare this model was trained on — all it has ever read.',
    citedBy: [7],
  },
  {
    n: 14,
    title: 'Gaussian Error Linear Units (GELUs)',
    authors: 'Hendrycks & Gimpel',
    year: '2016',
    url: 'https://arxiv.org/abs/1606.08415',
    why: 'The smooth nonlinearity inside mlp — see gelu-ref in the kernels file.',
    citedBy: [],
  },
];

/** Per-section "go deeper" notes (≤ 80 words each). */
export const GO_DEEPER: Record<number, string> = {
  0: 'Everything below is one Lisp environment. The hero calls (generate) — the same function you can call in the REPL.',
  1: 'GPT-2 [12] showed that this one objective, scaled up, covers translation, summarization, and question answering without being told to.',
  3: 'Read [7] for the pictures, then [9] and [10] for what heads become at scale. This model is small enough to watch every one.',
  4: 'The residual-stream framing is from [9]. Ablation is the interpretability researcher\u2019s scalpel: remove a part, measure the damage.',
  5: 'Holtzman et al. [11] is the definitive study of what goes wrong at the extremes you can reach with this knob.',
  6: 'McCarthy [2] fit a language in a page; Graham [5] explains why that was possible. This page tries the same trick on a model.',
  8: "Karpathy's Zero to Hero series [4] takes you from this page to training GPT-2 yourself.",
};
