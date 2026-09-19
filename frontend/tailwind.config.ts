import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Editorial Civic Infrastructure Palette (Warm paper, dark ink, terracotta accent)
        canvas: {
          DEFAULT: '#F4F0EA', // Warm paper / cream base
          subtle: '#ECE7DF',  // Editorial section tint
          card: '#FCFAF7',    // Crisp warm paper surface
          muted: '#E4DFD5',   // Subtle rule tone
        },
        ink: {
          primary: '#1A1816',   // Deep printer ink / carbon
          secondary: '#5C5852', // Warm graphite
          tertiary: '#948F86',  // Technical stone / pencil gray
          border: '#DDD7CD',    // Thin architectural grid line
        },
        civic: {
          blue: '#C85A32',     // Restrained Terracotta primary accent
          blueDark: '#A84320', // Deep Terracotta rust
          blueLight: '#F7EBE4',// Soft Terracotta cream tint
          terracotta: '#C85A32',
          terracottaDark: '#A84320',
          terracottaLight: '#F7EBE4',
          teal: '#2E6F40',     // Subtle Olive
          amber: '#B26A00',    // Muted Ochre
          amberLight: '#F9EED9',
          emerald: '#2E6F40',  // Muted Olive Emerald
          emeraldLight: '#E6EFE8',
          rose: '#B83232',     // Muted Brick Red
          roseLight: '#F9E8E8',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'none': 'none',
        'subtle': '0 1px 2px 0 rgba(26, 24, 22, 0.04)',
        'card': 'none',
        'elevated': '0 2px 8px 0 rgba(26, 24, 22, 0.06)',
      },
      borderRadius: {
        'none': '0px',
        'sm': '2px',
        'md': '4px',
        'lg': '6px',
        'xl': '8px',
        '2xl': '12px',
      },
    },
  },
  plugins: [],
};

export default config;
