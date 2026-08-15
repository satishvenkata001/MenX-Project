/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f6f6f7',
          100: '#e1e3e7',
          500: '#111827',
          600: '#0b0f19',
          900: '#030712',
          accent: '#d97706', // Warm Amber/Gold accent for premium men's styling
          accentHover: '#b45309',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      screens: {
        'xs': '475px',
      }
    },
  },
  plugins: [],
}
