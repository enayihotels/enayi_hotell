/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── ENAYI 5-STAR LUXURY PALETTE ─────────────────────────────
        // Deep Navy · Champagne Gold · Ivory · Rich Charcoal
        // Inspired by: Ritz-Carlton, Four Seasons, Burj Al Arab
        gold: {
          50:'#FDFAF0',  100:'#FAF3D3',  200:'#F5E49A',
          300:'#EDD060',  400:'#E4BB35',  500:'#C9A227',
          600:'#A67C1A',  700:'#7D5A10',  800:'#553C08',
          900:'#2E1F02',  950:'#160E00'
        },
        enayi: {
          bg:      '#0B1120',   // Deep midnight navy — premium dark background
          surface: '#111827',   // Rich charcoal surface
          panel:   '#162035',   // Slightly lighter panel
          border:  '#1E2D47',   // Navy border
          gold:    '#C9A227',   // Champagne gold — primary accent
          gold2:   '#E4BB35',   // Bright gold highlight
          gold3:   '#A67C1A',   // Deep gold shadow
          text:    '#F5F0E8',   // Warm ivory — primary text
          muted:   '#8A9AB5',   // Cool blue-grey muted
          subtle:  '#1A2540',   // Subtle navy tint
          navy:    '#0B1120',   // Deep navy
          cream:   '#F9F5EC',   // Warm cream (for light elements)
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        heading: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body:    ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold:      '0 4px 20px rgba(201,162,39,0.30)',
        'gold-lg': '0 8px 40px rgba(201,162,39,0.40)',
        'gold-glow':'0 0 60px rgba(201,162,39,0.20)',
        card:      '0 2px 16px rgba(0,0,0,0.40)',
        'card-lg': '0 8px 40px rgba(0,0,0,0.60)',
      },
      animation: {
        shimmer:     'shimmer 2.5s linear infinite',
        float:       'float 7s ease-in-out infinite',
        'fade-up':   'fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
        'glow-pulse':'glowPulse 3s ease-in-out infinite',
      }
    }
  },
  plugins: []
}
