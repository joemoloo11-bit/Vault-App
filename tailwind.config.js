/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        background: '#0D1117',
        surface: '#161B22',
        'surface-2': '#1C2333',
        'surface-hover': '#1F2937',
        border: '#21262D',
        'border-subtle': '#30363D',
        accent: {
          DEFAULT: '#14B8A6',
          hover: '#0D9488',
          muted: '#14B8A620',
        },
        success: {
          DEFAULT: '#10B981',
          muted: '#10B98120',
        },
        warning: {
          DEFAULT: '#F59E0B',
          muted: '#F59E0B20',
        },
        danger: {
          DEFAULT: '#EF4444',
          muted: '#EF444420',
        },
        text: {
          primary: '#F0F6FC',
          secondary: '#8B949E',
          muted: '#484F58',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(20,184,166,0.2)',
        glow: '0 0 20px rgba(20,184,166,0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'dialog-in': 'dialogIn 0.15s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        // Uses CSS `scale` (separate from `transform`) so it doesn't fight the
        // -translate-x-1/2 -translate-y-1/2 centering on the dialog element.
        dialogIn: {
          '0%': { opacity: '0', scale: '0.96' },
          '100%': { opacity: '1', scale: '1' },
        },
      },
    },
  },
  plugins: [],
}
