import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7f6',
          100: '#d3ebe8',
          200: '#a8d7d2',
          300: '#74bcb5',
          400: '#489e97',
          500: '#2f827c',
          600: '#246865',
          700: '#1f5352',
          800: '#1b4342',
          900: '#183938',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
