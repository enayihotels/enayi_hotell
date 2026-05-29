/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── ENAYI BRAND PALETTE ──────────────────────────────────────────────
        // Navy Blue · White · Dodger Blue
        // Note: the key "gold" is kept for code compatibility — values are now blue shades.
        gold: {
          50:'#EFF6FF', 100:'#DBEAFE', 200:'#BFDBFE', 300:'#93C5FD',
          400:'#60A5FA', 500:'#1E90FF', 600:'#1565C0', 700:'#0D47A1',
          800:'#0A3680', 900:'#082A5E', 950:'#051936'
        },
        enayi: {
          bg:'#0A1628',          // Deep navy background
          surface:'#0F1F38',     // Lighter navy for cards / surfaces
          panel:'#152848',       // Navy panel
          border:'#1F3252',      // Navy border lines
          gold:'#1E90FF',        // PRIMARY ACCENT — Dodger Blue (replaces gold)
          gold2:'#5BA8FF',       // Lighter dodger blue (highlights)
          gold3:'#1565C0',       // Deeper blue (gradients)
          text:'#FFFFFF',        // Pure white text
          muted:'#8FA3BD',       // Soft blue-gray for secondary text
          subtle:'#1A2C46'       // Subtle navy tint
        }
      },
      fontFamily: {
        display:['"Playfair Display"','Georgia','serif'],
        heading:['"Cormorant Garamond"','Georgia','serif'],
        body:['"DM Sans"','system-ui','sans-serif']
      },
      boxShadow: {
        gold:'0 4px 20px rgba(30,144,255,0.30)',
        'gold-lg':'0 8px 40px rgba(30,144,255,0.40)',
        'gold-glow':'0 0 60px rgba(30,144,255,0.20)',
        card:'0 2px 12px rgba(0,0,0,0.6)'
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
