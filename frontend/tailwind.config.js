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
        dark: {
          900: '#0c0c0e',
          800: '#141417',
          700: '#1e1e23',
          600: '#28282f',
          500: '#36363f',
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
