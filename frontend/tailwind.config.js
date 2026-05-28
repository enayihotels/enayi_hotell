/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: { 50:'#fdfbef',100:'#faf4d0',200:'#f4e79d',300:'#ecd463',400:'#e3bf36',500:'#C9A84C',600:'#ad8b22',700:'#8a6b1a',800:'#715519',900:'#5f4619',950:'#362408' },
        enayi: { bg:'#09090E',surface:'#111118',panel:'#16161F',border:'#1E1E2E',gold:'#C9A84C',gold2:'#E4C97A',gold3:'#A07832',text:'#EAE6DC',muted:'#787880',subtle:'#2A2A38' }
      },
      fontFamily: { display:['"Playfair Display"','Georgia','serif'], heading:['"Cormorant Garamond"','Georgia','serif'], body:['"DM Sans"','system-ui','sans-serif'] },
      boxShadow: { gold:'0 4px 20px rgba(201,168,76,0.25)', 'gold-lg':'0 8px 40px rgba(201,168,76,0.35)', 'gold-glow':'0 0 60px rgba(201,168,76,0.15)', card:'0 2px 12px rgba(0,0,0,0.6)' },
      animation: { shimmer:'shimmer 2.5s linear infinite', float:'float 7s ease-in-out infinite', 'fade-up':'fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards', 'glow-pulse':'glowPulse 3s ease-in-out infinite' }
    }
  },
  plugins: []
}
