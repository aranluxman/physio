import type { Config } from 'tailwindcss';

/** Map a CSS variable holding "R G B" channels into a Tailwind colour. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        panel: token('panel'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        faint: token('faint'),

        accent: {
          DEFAULT: token('accent'),
          fg: token('accent-fg'),
          soft: token('accent-soft'),
          'soft-fg': token('accent-soft-fg'),
        },
        ok: {
          DEFAULT: token('ok'),
          soft: token('ok-soft'),
          'soft-fg': token('ok-soft-fg'),
        },
        warn: {
          DEFAULT: token('warn'),
          soft: token('warn-soft'),
          'soft-fg': token('warn-soft-fg'),
        },
        danger: {
          DEFAULT: token('danger'),
          soft: token('danger-soft'),
          'soft-fg': token('danger-soft-fg'),
        },
        info: {
          DEFAULT: token('info'),
          soft: token('info-soft'),
          'soft-fg': token('info-soft-fg'),
        },
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        pop: 'var(--shadow-pop)',
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
