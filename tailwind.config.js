/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        paper: 'rgb(var(--paper-rgb) / <alpha-value>)',
        dim: 'rgb(var(--dim-rgb) / <alpha-value>)',
        amber: 'rgb(var(--accent-rgb) / <alpha-value>)', // runtime-selected accent
        'accent-foreground': 'rgb(var(--accent-foreground-rgb) / <alpha-value>)',
        panel: 'rgb(var(--panel-rgb) / <alpha-value>)',
        edge: 'rgb(var(--edge-rgb) / <alpha-value>)',
        chrome: 'rgb(var(--chrome-rgb) / <alpha-value>)',
        trace: 'rgb(var(--trace-rgb) / <alpha-value>)',
        error: 'rgb(var(--error-rgb) / <alpha-value>)',
        'code-number': 'var(--code-number)',
        'code-string': 'var(--code-string)',
        'code-bracket': 'var(--code-bracket)',
        'code-number-alt': 'var(--code-number-alt)',
        'code-string-alt': 'var(--code-string-alt)',
        'code-keyword': 'var(--code-keyword)',
        'code-function': 'var(--code-function)',
        'code-paren-1': 'var(--code-paren-1)',
        'code-paren-2': 'var(--code-paren-2)',
        'code-paren-3': 'var(--code-paren-3)',
      },
      fontFamily: {
        mono: ['ui-monospace', 'JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      maxWidth: {
        measure: '70ch',
      },
    },
  },
  plugins: [],
};
