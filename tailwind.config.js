/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nyghto: {
          orange: '#FF6B00',
          yellow: '#FFC107',
          dark: '#0A0A0A',
          card: '#161616',
          border: '#2A2A2A',
        },
        theme: {
          bg: 'var(--bg-main)',
          card: 'var(--bg-card)',
          text: 'var(--text-main)',
          muted: 'var(--text-muted)',
          border: 'var(--border-glass)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
