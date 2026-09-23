/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        menx: {
          bg: 'rgb(var(--menx-bg-rgb) / <alpha-value>)',
          surface: {
            DEFAULT: 'rgb(var(--menx-surface-rgb) / <alpha-value>)',
            elevated: 'rgb(var(--menx-surface-elevated-rgb) / <alpha-value>)',
          },
          primary: {
            DEFAULT: 'rgb(var(--menx-primary-rgb) / <alpha-value>)',
            hover: 'rgb(var(--menx-primary-hover-rgb) / <alpha-value>)',
          },
          text: {
            DEFAULT: 'rgb(var(--menx-text-rgb) / <alpha-value>)',
            secondary: 'rgb(var(--menx-text-secondary-rgb) / <alpha-value>)',
            muted: 'rgb(var(--menx-text-muted-rgb) / <alpha-value>)',
          },
          border: 'rgb(var(--menx-border-rgb) / <alpha-value>)',
          success: 'rgb(var(--menx-success-rgb) / <alpha-value>)',
          warning: 'rgb(var(--menx-warning-rgb) / <alpha-value>)',
          error: 'rgb(var(--menx-error-rgb) / <alpha-value>)',
          info: 'rgb(var(--menx-info-rgb) / <alpha-value>)',
        },
        brand: {
          50: '#f6f6f7',
          100: '#e1e3e7',
          500: '#111827',
          600: '#0b0f19',
          900: '#030712',
          accent: '#F5A524',
          accentHover: '#FFB52E',
        },
        gray: {
          705: '#6b7280',
          850: '#161f30',
          855: '#1e293b',
          955: '#0b0f19',
        }
      },
      backgroundImage: {
        'menx-card-gradient': 'linear-gradient(135deg, rgba(245, 165, 36, 0.05) 0%, rgba(24, 33, 44, 0.65) 35%, rgb(var(--menx-surface-rgb)) 100%)',
        'menx-card-elevated-gradient': 'linear-gradient(135deg, rgba(245, 165, 36, 0.07) 0%, rgba(24, 33, 44, 0.85) 35%, rgb(var(--menx-surface-elevated-rgb)) 100%)',
        'menx-card-glow-interactive': 'linear-gradient(135deg, rgba(245, 165, 36, 0.085) 0%, rgba(24, 33, 44, 0.85) 40%, rgb(var(--menx-surface-elevated-rgb)) 100%)',
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
