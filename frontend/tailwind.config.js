/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── ENAYI BRAND PALETTE — VELVET PLUM ──────────────────
        // Deep Lilac · Warm Coral · Cream · Soft Lilac
        // Note: "gold" key kept for code compatibility — values are coral shades now.
        gold: {
          50:'#FDF2EC', 100:'#FADFCF', 200:'#F5C4A9', 300:'#F0A883',
          400:'#EC9F7F', 500:'#E89B7B', 600:'#C77559', 700:'#A05A42',
          800:'#7A422F', 900:'#532A1D', 950:'#2E1810'
        },
        enayi: {
          bg:'#3D2A5C',          // Deep lilac plum background
          surface:'#4D3A6C',     // Lighter plum for cards
          panel:'#5A4878',       // Plum panel
          border:'#6B5A88',      // Soft lilac border
          gold:'#E89B7B',        // PRIMARY ACCENT — Warm Coral
          gold2:'#F5B79B',       // Lighter coral
          gold3:'#C77559',       // Deeper terracotta
          text:'#FAF5EF',        // Warm cream text
          muted:'#B8A8C9',       // Soft lilac-gray muted
          subtle:'#2E1F47'       // Subtle darker plum
        }
      },
      fontFamily: {
        display:['"Playfair Display"','Georgia','serif'],
        heading:['"Cormorant Garamond"','Georgia','serif'],
        body:['"DM Sans"','system-ui','sans-serif']
      },
      boxShadow: {
        gold:'0 4px 20px rgba(232,155,123,0.30)',
        'gold-lg':'0 8px 40px rgba(232,155,123,0.40)',
        'gold-glow':'0 0 60px rgba(232,155,123,0.20)',
        card:'0 2px 12px rgba(0,0,0,0.4)'
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
