/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    transparent: 'transparent',
    current: 'currentColor',
    extend: {
      colors: {
        // Tremor light-mode tokens (required for Card, Button, Badge, etc.)
        tremor: {
          brand: {
            faint:    '#eff6ff', // blue-50
            muted:    '#bfdbfe', // blue-200
            subtle:   '#60a5fa', // blue-400
            DEFAULT:  '#3b82f6', // blue-500
            emphasis: '#1d4ed8', // blue-700
            inverted: '#ffffff',
          },
          background: {
            muted:    '#f9fafb', // gray-50
            subtle:   '#f3f4f6', // gray-100
            DEFAULT:  '#ffffff',
            emphasis: '#374151', // gray-700
          },
          border:  { DEFAULT: '#e5e7eb' }, // gray-200
          ring:    { DEFAULT: '#e5e7eb' },
          content: {
            subtle:   '#9ca3af', // gray-400
            DEFAULT:  '#6b7280', // gray-500
            emphasis: '#374151', // gray-700
            strong:   '#111827', // gray-900
            inverted: '#ffffff',
          },
        },
        // Tremor dark-mode tokens
        'dark-tremor': {
          brand: {
            faint:    '#0B1229',
            muted:    '#172554', // blue-950
            subtle:   '#1e40af', // blue-800
            DEFAULT:  '#3b82f6', // blue-500
            emphasis: '#60a5fa', // blue-400
            inverted: '#030712', // gray-950
          },
          background: {
            muted:    '#131A2B',
            subtle:   '#1f2937', // gray-800
            DEFAULT:  '#111827', // gray-900
            emphasis: '#d1d5db', // gray-300
          },
          border:  { DEFAULT: '#1f2937' }, // gray-800
          ring:    { DEFAULT: '#1f2937' },
          content: {
            subtle:   '#4b5563', // gray-600
            DEFAULT:  '#6b7280', // gray-500
            emphasis: '#e5e7eb', // gray-200
            strong:   '#f9fafb', // gray-50
            inverted: '#000000',
          },
        },
      },
      boxShadow: {
        'tremor-input':    '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'tremor-card':     '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'dark-tremor-input':    '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'dark-tremor-card':     '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'dark-tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      borderRadius: {
        'tremor-small':   '0.375rem',
        'tremor-default': '0.5rem',
        'tremor-full':    '9999px',
      },
      fontSize: {
        'tremor-label':   ['0.75rem'],
        'tremor-default': ['0.875rem', { lineHeight: '1.25rem' }],
        'tremor-title':   ['1.125rem', { lineHeight: '1.75rem' }],
        'tremor-metric':  ['1.875rem', { lineHeight: '2.25rem' }],
      },
    },
  },
  // Tremor generates class names via JS template literals at runtime, so
  // Tailwind JIT cannot extract them statically. Safelist ensures all
  // color × shade × property combinations Tremor uses are always emitted.
  safelist: [
    {
      pattern:
        /^(bg|text|ring|border|stroke|fill)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)$/,
      variants: ['dark', 'hover', 'focus', 'data-\\[selected\\]'],
    },
    'bg-opacity-10', 'bg-opacity-20', 'bg-opacity-5',
    'ring-opacity-20', 'ring-opacity-60',
    'dark:bg-opacity-5', 'dark:ring-opacity-60',
  ],
  plugins: [],
};
