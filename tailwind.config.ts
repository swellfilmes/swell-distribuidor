import type { Config } from 'tailwindcss';

/**
 * Paleta dark do design system Swell Mermaid (PDF Brand Concept).
 * Inspiração: Linear, Vercel, Stripe. Laranja Swell como acento, não fundo.
 *
 * Tokens novos (semânticos, usar daqui pra frente):
 *  - bg-app          fundo da página
 *  - bg-surface      cards, containers de 1ª camada
 *  - bg-surface-2    elevações (modals, dropdowns)
 *  - text-primary    texto principal
 *  - text-secondary  texto auxiliar
 *  - border-soft     bordas leves
 *  - primary         laranja Swell (acento)
 *  - success / error
 *
 * Aliases legacy (`cream`, `ink`, `accent`) ficam mapeados nos NOVOS valores
 * pra UI antiga não quebrar enquanto migramos pra tokens semânticos:
 *  - cream  → surface (era fundo "claro" → vira surface dark)
 *  - ink    → primary laranja (era texto/btn principal → vira o acento)
 *  - accent → primary laranja
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
        // Novos tokens semânticos
        app: '#08131F',
        surface: '#0F1D2D',
        'surface-2': '#17283D',
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
        'border-soft': '#223248',
        primary: '#FF7A00',
        'primary-soft': 'rgba(255, 122, 0, 0.12)',
        success: '#22C55E',
        error: '#EF4444',

        // Aliases legacy pra UI antiga continuar funcionando.
        // bg-cream → vira surface dark. text-cream → vira surface dark
        // (em botões com bg laranja fica meio escuro, OK ish).
        cream: '#0F1D2D',
        // bg-ink (era botão preto) → vira primary laranja.
        // text-ink (era texto principal) → vira laranja, RUIM pra texto longo;
        // por isso a Etapa 2 do design pass substitui text-ink/X por
        // text-text-primary/X.
        ink: '#FF7A00',
        accent: '#FF7A00',
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
