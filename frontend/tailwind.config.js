/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0A0E1A',
          card: '#111827',
          elevated: '#1C2333',
          surface: '#111827',
        },
        border: {
          DEFAULT: '#2D3748',
          default: '#2D3748',
        },
        accent: {
          gold: '#F59E0B',
          green: '#10B981',
          red: '#EF4444',
          blue: '#3B82F6',
        },
        text: {
          primary: '#F9FAFB',
          secondary: '#9CA3AF',
          muted: '#4B5563',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontFeatureSettings: {
        tnum: '"tnum"',
      },
      keyframes: {
        // Linha dourada que varre o card (elemento assinatura).
        scanner: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        scanner: 'scanner 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'pulse-soft': 'pulse-soft 1.8s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
