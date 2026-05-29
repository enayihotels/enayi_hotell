import { Outlet, Link, NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Phone, MapPin, Bot } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/helpers'

const NAV = [
  { label: 'Rooms & Suites', href: '/rooms' },
  { label: 'Events',         href: '/events' },
  { label: 'Gallery',        href: '/gallery' },
  { label: 'About Us',       href: '/about' },
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
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="hidden md:flex items-center justify-between px-12 py-2 bg-enayi-surface border-b border-enayi-border text-xs text-enayi-muted">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5"><MapPin size={11} className="text-enayi-gold" /> Rayfield Road, Jos, Plateau State</span>
          <span className="flex items-center gap-1.5"><Phone size={11} className="text-enayi-gold" /> +234-800-000-0000</span>
        </div>
        <span className="text-enayi-gold font-medium">✦ Check-in 2pm · Check-out 12pm · 24hr Front Desk ✦</span>
      </div>

      {/* Navbar */}
      <header className={cn('sticky top-0 z-50 transition-all duration-500',
        scrolled ? 'bg-enayi-bg/95 backdrop-blur-xl border-b border-enayi-border shadow-card' : 'bg-enayi-bg/80 backdrop-blur-md'
      )}>
        <nav className="container-site flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/logo.png" alt="Enayi Hotels & Suites" className="h-12 w-auto object-contain" />
            <div>
              <div className="font-display font-semibold text-enayi-text text-lg leading-none">Enayi Hotels</div>
              <div className="text-enayi-muted text-[10px] tracking-widest uppercase mt-0.5">& Suites · Jos</div>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            {NAV.map(n => (
              <NavLink key={n.href} to={n.href} className={({isActive}) => cn('nav-link', isActive && 'active')}>
                {n.label}
              </NavLink>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link to="/concierge" className="flex items-center gap-1.5 text-enayi-muted hover:text-enayi-gold transition-colors text-sm"><Bot size={15} /> ARIA</Link>
                <Link to="/dashboard" className="btn-surface text-sm px-4 py-2">Dashboard</Link>
              </>
            ) : (
              <Link to="/login" className="btn-ghost text-sm">Sign In</Link>
            )}
            <Link to="/book" className="btn-gold text-sm px-5 py-2.5">Book Now</Link>
          </div>

          <button onClick={() => setOpen(!open)} className="lg:hidden p-2 text-enayi-muted hover:text-enayi-text transition-colors">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>

        <AnimatePresence>
          {open && (
            <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}
              className="lg:hidden overflow-hidden bg-enayi-surface border-t border-enayi-border">
              <div className="container-site py-6 flex flex-col gap-4">
                {NAV.map(n => (
                  <NavLink key={n.href} to={n.href} onClick={() => setOpen(false)}
                    className={({isActive}) => cn('text-sm py-2 border-b border-enayi-border', isActive ? 'text-enayi-gold font-medium' : 'text-enayi-muted')}>
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

      <main className="flex-1"><Outlet /></main>

      {/* Footer */}
      <footer className="bg-enayi-surface border-t border-enayi-border">
        <div className="container-site py-16 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div>
            <div className="font-display text-2xl font-semibold text-enayi-text mb-1">Enayi Hotels</div>
            <div className="text-enayi-gold text-sm mb-4">& Suites · Jos, Nigeria</div>
            <p className="text-enayi-muted text-sm leading-relaxed">Exceptional Nigerian hospitality in the cool highlands of Jos, Plateau State.</p>
            <div className="flex items-center gap-1.5 mt-4"><div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /><span className="text-green-400 text-xs">Open 24/7 — All year round</span></div>
          </div>
          <div>
            <h4 className="text-enayi-text font-semibold text-sm mb-5">Quick Links</h4>
            <div className="flex flex-col gap-3">
              {[...NAV, {label:'Book a Room',href:'/book'},{label:'Book an Event',href:'/events/book'}].map(l => (
                <Link key={l.href} to={l.href} className="text-enayi-muted hover:text-enayi-gold text-sm transition-colors">{l.label}</Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-enayi-text font-semibold text-sm mb-5">Services</h4>
            <div className="flex flex-col gap-2.5 text-sm text-enayi-muted">
              {['24hr Room Service','Restaurant & Bar','Event Hall Rentals','Airport Pickup','Laundry','AI Concierge (ARIA)','Conference Rooms','Swimming Pool'].map(s => <span key={s}>{s}</span>)}
            </div>
          </div>
          <div>
            <h4 className="text-enayi-text font-semibold text-sm mb-5">Contact Us</h4>
            <div className="flex flex-col gap-4 text-sm text-enayi-muted">
              <div><div className="text-enayi-gold text-xs font-semibold uppercase tracking-wider mb-1">Address</div><p>Rayfield Road, Jos<br />Plateau State, Nigeria</p></div>
              <div><div className="text-enayi-gold text-xs font-semibold uppercase tracking-wider mb-1">Phone</div><a href="tel:+2348000000000" className="hover:text-enayi-gold">+234-800-000-0000</a></div>
              <div><div className="text-enayi-gold text-xs font-semibold uppercase tracking-wider mb-1">Email</div><a href="mailto:info@enayihotels.com" className="hover:text-enayi-gold">info@enayihotels.com</a></div>
            </div>
          </div>
        </div>
        <div className="border-t border-enayi-border">
          <div className="container-site py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-enayi-muted">
            <span>© {new Date().getFullYear()} Enayi Hotels & Suites. All rights reserved.</span>
            <div className="flex items-center gap-5">
              <Link to="/privacy" className="hover:text-enayi-gold transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-enayi-gold transition-colors">Terms of Service</Link>
              <span className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-enayi-gold" />Enayi Tech</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
