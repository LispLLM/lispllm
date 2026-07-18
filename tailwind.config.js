/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f0e0c', // near-black warm gray
        paper: '#e8e4dc', // off-white
        dim: '#8a857a',
        amber: '#e6a23c', // the one accent
        panel: '#181613',
        edge: '#2a2723',
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
