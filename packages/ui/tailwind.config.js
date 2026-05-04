/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        order1: '#22c55e',
        order2: '#eab308',
        order3: '#f97316',
        forbidden: '#ef4444',
      },
    },
  },
  plugins: [],
};
