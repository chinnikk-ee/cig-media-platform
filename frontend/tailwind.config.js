export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          900: 'var(--color-primary-900)',
        },
        dark: {
          900: 'var(--color-dark-900)',
          800: 'var(--color-dark-800)',
          700: 'var(--color-dark-700)',
          600: 'var(--color-dark-600)',
          500: 'var(--color-dark-500)',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
