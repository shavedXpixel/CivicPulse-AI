import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Light-first civic infrastructure palette (docs/04_DESIGN.md)
        canvas: {
          DEFAULT: '#F8FAFC', // Slate 50 near-white base
          subtle: '#F1F5F9',  // Slate 100
          card: '#FFFFFF',    // Pure white for panels
          muted: '#E2E8F0',   // Slate 200
        },
        ink: {
          primary: '#0F172A',   // Deep graphite (Slate 900)
          secondary: '#475569', // Muted charcoal (Slate 600)
          tertiary: '#94A3B8',  // Subtle slate (Slate 400)
          border: '#E2E8F0',    // Subtle line separator (Slate 200)
        },
        civic: {
          blue: '#0284C7',     // Restrained Civic Sky/Blue
          blueDark: '#0369A1', // Deep Civic Blue
          blueLight: '#E0F2FE',// Soft Blue Tint
          teal: '#0D9488',     // Muted Teal
          amber: '#D97706',    // Muted Amber for medium priority
          amberLight: '#FEF3C7',
          emerald: '#16A34A',  // Muted Emerald for resolved/active
          emeraldLight: '#DCFCE7',
          rose: '#DC2626',     // Muted Rose for high severity
          roseLight: '#FEE2E2',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
        'elevated': '0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
      },
      borderRadius: {
        'sm': '6px',
        'md': '8px',
        'lg': '10px',
        'xl': '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};

export default config;
