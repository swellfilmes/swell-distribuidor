import type { Config } from 'tailwindcss';

/**
 * Paleta dark do Swell Mermaid (PDF Brand Concept).
 * Tokens compactos pra evitar colisão com classes Tailwind nativas
 * (text-primary/text-secondary do default já conflitavam).
 *
 *  bg-app         #08131F    fundo da página
 *  bg-surface     #0F1D2D    cards / containers
 *  bg-surface-2   #17283D    elevações
 *  text-fg        #F8FAFC    texto principal
 *  text-fg-muted  #94A3B8    texto auxiliar
 *  border-bd      #223248    borda leve
 *  primary        #FF7A00    acento laranja Swell
 *  success / error
 *
 * Aliases legacy (`cream`, `ink`, `accent`) apontam pros novos tokens
 * pra UI antiga não quebrar durante migração.
 */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: '#08131F',
        surface: {
          DEFAULT: '#0F1D2D',
          2: '#17283D',
        },
        fg: {
          DEFAULT: '#F8FAFC',
          muted: '#94A3B8',
        },
        bd: '#223248',
        primary: {
          DEFAULT: '#FF7A00',
          soft: 'rgba(255, 122, 0, 0.12)',
        },
        success: '#22C55E',
        error: '#EF4444',

        // Aliases legacy (mantém UI antiga funcionando)
        cream: '#0F1D2D',
        ink: '#FF7A00',
        accent: '#FF7A00',
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
        'border-soft': '#223248',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['var(--font-dm-serif)', 'DM Serif Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        DEFAULT: '12px',
        sm: '8px',
        md: '12px',
        lg: '14px',
        xl: '16px',
        '2xl': '20px',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
    },
  },
  plugins: [],
} satisfies Config;
