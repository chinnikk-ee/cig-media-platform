export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          900: '#064e3b',
        },
        // Neutral "surface" scale. Names are kept (dark-900 … dark-500) so the
        // existing markup needn't change, but the values are now a light,
        // faintly jade-tinted ramp: 900 = page bg, 800 = cards, 700 = inputs/
        // hover, 600 = borders, 500 = strong borders / scrollbar.
        dark: {
          900: '#f3f7f5',
          800: '#ffffff',
          700: '#eef3f0',
          600: '#dde6e1',
          500: '#c2cec8',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'Inter', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
