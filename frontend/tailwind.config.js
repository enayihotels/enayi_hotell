/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── ENAYI BRAND PALETTE — LAVENDER CORAL (Light Theme) ─────
        // Light Lilac · Royal Purple · Warm Coral · Deep Plum
        // Note: "gold" key kept for code compatibility — values are coral shades.
        gold: {
          50:'#FDF2EC', 100:'#FADFCF', 200:'#F5C4A9', 300:'#F0A883',
          400:'#EC9F7F', 500:'#E89B7B', 600:'#C77559', 700:'#A05A42',
          800:'#7A422F', 900:'#532A1D', 950:'#2E1810'
        },
        enayi: {
          bg:'#F3EDF9',          // Light lilac background
          surface:'#FFFFFF',     // White cards/surfaces
          panel:'#FAF6FC',       // Off-white panels
          border:'#E2D4F0',      // Soft lilac border
          gold:'#E89B7B',        // PRIMARY ACCENT — Warm Coral
          gold2:'#F5B79B',       // Lighter coral
          gold3:'#C77559',       // Deeper coral
          text:'#2D1B47',        // Very dark plum for readability
          muted:'#7A6B96',       // Medium purple muted
          subtle:'#ECDFEF',      // Subtle lilac tint
          purple:'#6B3DA8',      // Royal purple secondary
          plum:'#4A2D6B'         // Deep plum headers/logo
        }
      },
      fontFamily: {
        display:['"Playfair Display"','Georgia','serif'],
        heading:['"Cormorant Garamond"','Georgia','serif'],
        body:['"DM Sans"','system-ui','sans-serif']
      },
      boxShadow: {
        gold:'0 4px 20px rgba(232,155,123,0.35)',
        'gold-lg':'0 8px 40px rgba(232,155,123,0.45)',
        'gold-glow':'0 0 60px rgba(232,155,123,0.25)',
        card:'0 2px 12px rgba(74,45,107,0.08)'
      },
      animation: {
        shimmer:'shimmer 2.5s linear infinite',
        float:'float 7s ease-in-out infinite',
        'fade-up':'fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
        'glow-pulse':'glowPulse 3s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
