import { Outlet, Link, NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Phone, MapPin, Bot, Star } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/helpers'

const NAV = [
  { label: 'Rooms & Suites', href: '/rooms'   },
  { label: 'Events',         href: '/events'  },
  { label: 'Gallery',        href: '/gallery' },
  { label: 'About Us',       href: '/about'   },
  { label: 'Contact',        href: '/contact' },
]

export default function PublicLayout() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen]         = useState(false)
  const { isAuthenticated }     = useAuthStore()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-enayi-bg">

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="hidden md:flex items-center justify-between px-12 py-2.5 bg-enayi-surface border-b border-enayi-border text-[11px] text-enayi-muted tracking-widest uppercase">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-2"><MapPin size={11} className="text-enayi-gold" /> Rayfield Zarmaganda Road, Off Railway Crossing, Jos</span>
          <span className="flex items-center gap-2"><Phone size={11} className="text-enayi-gold" /> +234(0)9138943008</span>
        </div>
        <span className="flex items-center gap-2 text-enayi-gold">
          <Star size={9} fill="currentColor" /> Check-in 2pm &nbsp;&middot;&nbsp; Check-out 12pm &nbsp;&middot;&nbsp; 24hr Front Desk <Star size={9} fill="currentColor" />
        </span>
      </div>

      {/* ── Navbar ──────────────────────────────────────────────── */}
      <header className={cn(
        'sticky top-0 z-50 transition-all duration-500',
        scrolled
          ? 'bg-enayi-bg/98 backdrop-blur-xl border-b border-enayi-gold/20 shadow-card-lg'
          : 'bg-enayi-bg/90 backdrop-blur-md border-b border-enayi-border'
      )}>
        <nav className="container-site flex items-center justify-between h-28">

          {/* ── LOGO ── */}
          <Link to="/" className="flex items-center gap-4 group">
            <div className="relative">
              <img
                src="/logo.png"
                alt="Enayi Hotels & Suites"
                className="h-24 w-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-lg"
                style={{filter:'drop-shadow(0 0 12px rgba(201,162,39,0.5))'}}
              />
            </div>
            <div className="border-l-2 border-enayi-gold/60 pl-5">
              {/* Hotel name — same visual weight as hero heading */}
              <div
                className="font-display font-black text-white leading-none tracking-wide"
                style={{
                  fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
                  textShadow: '0 2px 20px rgba(201,162,39,0.4), 0 0 60px rgba(201,162,39,0.15)',
                  letterSpacing: '0.02em',
                }}
              >
                Enayi Hotels
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-px w-10 bg-gradient-to-r from-enayi-gold to-transparent" />
                <div className="text-enayi-gold text-[11px] tracking-[0.3em] uppercase font-bold">
                  &amp; Suites &nbsp;·&nbsp; Jos
                </div>
                <div className="h-px w-10 bg-gradient-to-l from-enayi-gold to-transparent" />
              </div>
              {/* 5-star rating */}
              <div className="flex items-center gap-1 mt-1.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={12} className="text-enayi-gold" fill="currentColor" />
                ))}
                <span className="text-enayi-gold text-[10px] tracking-widest uppercase ml-1.5 font-bold">5 Star</span>
              </div>
            </div>
          </Link>

          {/* ── Desktop nav ── */}
          <div className="hidden lg:flex items-center gap-10">
            {NAV.map(n => (
              <NavLink key={n.href} to={n.href}
                className={({ isActive }) => cn('nav-link', isActive && 'active')}>
                {n.label}
              </NavLink>
            ))}
          </div>

          {/* ── CTA buttons ── */}
          <div className="hidden lg:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link to="/concierge"
                  className="flex items-center gap-1.5 text-enayi-muted hover:text-enayi-gold transition-colors text-xs tracking-widest uppercase">
                  <Bot size={14} /> ARIA
                </Link>
                <Link to="/dashboard" className="btn-surface text-xs px-5 py-3">Dashboard</Link>
              </>
            ) : (
              <Link to="/login" className="btn-ghost text-xs">Sign In</Link>
            )}
            <Link to="/book" className="btn-gold">Book Now</Link>
          </div>

          {/* ── Mobile menu toggle ── */}
          <button onClick={() => setOpen(!open)}
            className="lg:hidden p-2 text-enayi-muted hover:text-enayi-gold transition-colors">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>

        {/* ── Mobile menu ── */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden overflow-hidden bg-enayi-surface border-t border-enayi-gold/20">
              <div className="container-site py-8 flex flex-col gap-5">
                {NAV.map(n => (
                  <NavLink key={n.href} to={n.href} onClick={() => setOpen(false)}
                    className={({ isActive }) => cn(
                      'text-sm py-3 border-b border-enayi-border tracking-widest uppercase',
                      isActive ? 'text-enayi-gold font-medium' : 'text-enayi-muted'
                    )}>
                    {n.label}
                  </NavLink>
                ))}
                <div className="flex flex-col gap-3 pt-2">
                  {isAuthenticated
                    ? <Link to="/dashboard" onClick={() => setOpen(false)} className="btn-surface">Dashboard</Link>
                    : <Link to="/login" onClick={() => setOpen(false)} className="btn-ghost">Sign In</Link>
                  }
                  <Link to="/book" onClick={() => setOpen(false)} className="btn-gold">Book Now</Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1"><Outlet /></main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="bg-enayi-surface border-t border-enayi-gold/20">
        {/* Gold top accent line */}
        <div className="h-px w-full" style={{background:'linear-gradient(90deg,transparent,#C9A227,#E4BB35,#C9A227,transparent)'}} />

        <div className="container-site py-20 grid grid-cols-1 md:grid-cols-4 gap-14">
          {/* Brand */}
          <div>
            <div className="font-display text-3xl font-bold text-enayi-text mb-1">Enayi Hotels</div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px w-8 bg-enayi-gold" />
              <span className="text-enayi-gold text-[10px] tracking-[0.2em] uppercase">& Suites · Jos, Nigeria</span>
              <div className="h-px w-8 bg-enayi-gold" />
            </div>
            <div className="flex items-center gap-0.5 mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} size={11} className="text-enayi-gold" fill="currentColor" />)}
            </div>
            <p className="text-enayi-muted text-sm leading-relaxed">
              Exceptional Nigerian hospitality in the cool highlands of Jos, Plateau State.
            </p>
            <div className="flex items-center gap-2 mt-5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs tracking-widest uppercase">Open 24/7 — All year round</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-enayi-gold text-xs font-semibold tracking-[0.2em] uppercase mb-6">Quick Links</h4>
            <div className="flex flex-col gap-3">
              {[...NAV, {label:'Book a Room',href:'/book'},{label:'Book an Event',href:'/events/book'}].map(l => (
                <Link key={l.href} to={l.href}
                  className="text-enayi-muted hover:text-enayi-gold text-sm transition-colors tracking-wide">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-enayi-gold text-xs font-semibold tracking-[0.2em] uppercase mb-6">Services</h4>
            <div className="flex flex-col gap-2.5 text-sm text-enayi-muted">
              {['24hr Room Service','Restaurant & Bar','Event Hall Rentals','Airport Pickup','Laundry','AI Concierge (ARIA)','Conference Rooms','Swimming Pool'].map(s => (
                <span key={s} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-enayi-gold/50" />{s}
                </span>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-enayi-gold text-xs font-semibold tracking-[0.2em] uppercase mb-6">Contact Us</h4>
            <div className="flex flex-col gap-5 text-sm text-enayi-muted">
              <div>
                <div className="text-enayi-gold text-[10px] font-semibold uppercase tracking-[0.2em] mb-2">Address</div>
                <p>Rayfield Zarmaganda Road, Off Railway Crossing, Jos<br />Plateau State, Nigeria</p>
              </div>
              <div>
                <div className="text-enayi-gold text-[10px] font-semibold uppercase tracking-[0.2em] mb-2">Phone</div>
                <a href="tel:+2349138943008" className="hover:text-enayi-gold transition-colors">+234(0)9138943008</a>
              </div>
              <div>
                <div className="text-enayi-gold text-[10px] font-semibold uppercase tracking-[0.2em] mb-2">Email</div>
                <a href="mailto:info@enayihotels.com" className="hover:text-enayi-gold transition-colors">info@enayihotels.com</a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-enayi-border">
          <div className="container-site py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-enayi-muted tracking-widest uppercase">
            <span>© {new Date().getFullYear()} Enayi Hotels & Suites. All rights reserved.</span>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="hover:text-enayi-gold transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-enayi-gold transition-colors">Terms</Link>
              <span className="flex items-center gap-2">
                <Star size={8} className="text-enayi-gold" fill="currentColor" /> Enayi Tech
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
