import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/utils/api'
import { useAuthStore } from '@/store/authStore'
import { Star, ChevronLeft, ChevronRight, ArrowRight, LogIn, UserPlus } from 'lucide-react'

const FALLBACK_SLIDES = [
  { bg: 'linear-gradient(135deg, #0A0F1E 0%, #1a2744 60%, #0d1929 100%)', label: 'Enayi Hotels — Rayfield', sub: 'Where luxury meets Nigerian warmth' },
  { bg: 'linear-gradient(135deg, #1a1000 0%, #3d2800 60%, #1a1000 100%)', label: 'Enayi Hotels — Zarmaganda', sub: 'Premier hospitality in the highlands of Jos' },
  { bg: 'linear-gradient(135deg, #0f1a0f 0%, #1a3320 60%, #0f1a0f 100%)', label: 'World-Class Dining', sub: '110+ dishes delivered to your room' },
  { bg: 'linear-gradient(135deg, #1a0a1a 0%, #2d1044 60%, #1a0a1a 100%)', label: 'Events & Celebrations', sub: 'From intimate gatherings to grand events' },
]

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

export default function SplashScreen() {
  const { isAuthenticated, user } = useAuthStore()
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const [fading, setFading] = useState(false)
  const [paused, setPaused] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Redirect authenticated users to correct dashboard
  useEffect(() => {
    if (!isAuthenticated || !user) return
    const role = user.role
    if (['store_keeper','bar_staff','kitchen_staff'].includes(role)) navigate('/inventory', { replace: true })
    else if (role === 'housekeeper') navigate('/housekeeping', { replace: true })
    else if (['manager','admin'].includes(role)) navigate('/admin', { replace: true })
    else navigate('/dashboard', { replace: true })
  }, [isAuthenticated, user, navigate])

  const { data: galleryImages } = useQuery<any[]>({
    queryKey: ['splash-gallery'],
    queryFn: () => api.get('/gallery/?limit=10').then(r => unwrapList(r.data)).catch(() => []),
    staleTime: 5 * 60 * 1000,
  })

  // Build slides: video always first, then gallery photos or fallback
  const photoSlides = galleryImages && galleryImages.length >= 2
    ? galleryImages.slice(0, 5).map((img: any, i: number) => ({ type: 'image' as const, src: img.image_url || img.image, label: img.caption || img.category_name || FALLBACK_SLIDES[i % FALLBACK_SLIDES.length].label, sub: FALLBACK_SLIDES[i % FALLBACK_SLIDES.length].sub }))
    : FALLBACK_SLIDES.map(s => ({ type: 'gradient' as const, bg: s.bg, label: s.label, sub: s.sub }))

  const slides = [
    { type: 'video' as const, label: 'Welcome to Enayi Hotels & Suites', sub: 'Experience world-class hospitality in the heart of Jos, Nigeria' },
    ...photoSlides,
  ]

  const total = slides.length
  const slide = slides[current]
  const isVideoSlide = slide.type === 'video'

  const goTo = useCallback((idx: number) => {
    if (fading) return
    setFading(true)
    setTimeout(() => { setCurrent(idx); setFading(false) }, 400)
  }, [fading])

  const next = useCallback(() => goTo((current + 1) % total), [current, total, goTo])
  const prev = useCallback(() => goTo((current - 1 + total) % total), [current, total, goTo])

  // Auto-advance (skip when video slide — video advances on end)
  useEffect(() => {
    if (paused || isVideoSlide) return
    const t = setInterval(next, 5500)
    return () => clearInterval(t)
  }, [paused, isVideoSlide, next])

  // Play video when on video slide
  useEffect(() => {
    if (isVideoSlide && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }, [isVideoSlide])

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{ background: '#0A0F1E' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Background layers ─────────────────────────────────────── */}

      {/* Video — always mounted, shown/hidden with opacity */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: isVideoSlide ? 1 : 0, transition: 'opacity 0.6s ease', zIndex: 1 }}
        muted playsInline preload="auto"
        onEnded={next}
      >
        <source src="/videos/enayi-promo.webm" type="video/webm" />
        <source src="/videos/enayi-promo.mp4"  type="video/mp4"  />
      </video>

      {/* Photo / gradient slides */}
      {photoSlides.map((s, i) => (
        <div
          key={i}
          className="absolute inset-0 w-full h-full"
          style={{
            opacity: !isVideoSlide && current === i + 1 ? 1 : 0,
            transition: `opacity ${fading ? 0.4 : 0.6}s ease`,
            zIndex: 2,
          }}
        >
          {s.type === 'image'
            ? <img src={s.src} alt={s.label} className="w-full h-full object-cover" draggable={false} />
            : <div className="w-full h-full" style={{ background: (s as any).bg }} />
          }
        </div>
      ))}

      {/* Overlays for readability */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.18) 100%)', zIndex: 3 }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.55) 0%, transparent 60%)', zIndex: 3 }} />

      {/* ── Top bar ────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 md:px-12 py-5" style={{ zIndex: 10 }}>
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Enayi Hotels" className="h-12 w-auto drop-shadow-lg" onError={e => (e.currentTarget.style.display = 'none')} />
          <div>
            <div className="text-white font-bold text-base leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>Enayi Hotels</div>
            <div style={{ color: '#C9A227', fontSize: '10px', letterSpacing: '0.25em' }} className="uppercase font-semibold">& Suites · Jos</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => <Star key={i} size={11} style={{ color: '#C9A227' }} fill="#C9A227" />)}
          <span style={{ color: '#C9A227', fontSize: '10px', letterSpacing: '0.2em' }} className="ml-1.5 font-bold uppercase">5 Star</span>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────── */}
      <div className="absolute inset-0 flex items-end md:items-center" style={{ zIndex: 10 }}>
        <div className="w-full px-6 md:px-12 pb-28 md:pb-0 md:max-w-[60%]">
          {/* Slide label pill */}
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase mb-4"
            style={{ background: 'rgba(201,162,39,0.15)', border: '1px solid rgba(201,162,39,0.4)', color: '#C9A227', letterSpacing: '0.2em', opacity: fading ? 0 : 1, transition: 'opacity 0.4s ease' }}>
            {slide.label}
          </div>

          {/* Headline */}
          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-4"
            style={{ fontFamily: 'Georgia, serif', textShadow: '0 4px 24px rgba(0,0,0,0.7)', opacity: fading ? 0 : 1, transition: 'opacity 0.4s ease', transitionDelay: '0.05s' }}>
            Experience the<br />
            <span style={{ color: '#C9A227' }}>Art of Luxury</span>
          </h1>

          {/* Sub */}
          <p
            className="text-white/70 text-base md:text-lg mb-8 leading-relaxed max-w-lg"
            style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.4s ease', transitionDelay: '0.1s' }}>
            {slide.sub}
          </p>

          {/* CTA buttons */}
          <div
            className="flex flex-col sm:flex-row gap-3"
            style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.4s ease', transitionDelay: '0.15s' }}>
            <Link to="/login"
              className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm tracking-wide"
              style={{ background: '#C9A227', color: '#0A0F1E', boxShadow: '0 8px 32px rgba(201,162,39,0.4)' }}>
              <LogIn size={16} /> Login / Sign In
            </Link>
            <Link to="/register"
              className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm tracking-wide border"
              style={{ border: '1.5px solid rgba(255,255,255,0.35)', color: 'white', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
              <UserPlus size={16} /> Create Account
            </Link>
            <Link to="/home"
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm"
              style={{ color: 'rgba(255,255,255,0.55)' }}>
              Explore <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Right glass card — desktop only ────────────────────────── */}
      <div className="absolute right-6 md:right-12 top-1/2 -translate-y-1/2 hidden lg:flex flex-col" style={{ zIndex: 10 }}>
        <div style={{ background: 'rgba(10,15,30,0.65)', backdropFilter: 'blur(20px)', border: '1px solid rgba(201,162,39,0.25)', width: '280px', borderRadius: '18px', padding: '28px 24px' }}>
          <div style={{ color: '#C9A227', fontSize: '10px', letterSpacing: '0.3em' }} className="uppercase font-semibold mb-1">Welcome to</div>
          <div className="text-white text-xl font-bold mb-1">Enayi Hotels & Suites</div>
          <div className="text-white/50 text-xs mb-5">Jos, Plateau State · Nigeria</div>
          <div className="flex flex-col gap-2.5">
            <Link to="/login" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold" style={{ background: '#C9A227', color: '#0A0F1E' }}>
              <LogIn size={15} /> Login / Sign In
            </Link>
            <Link to="/register" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold border" style={{ border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}>
              <UserPlus size={15} /> Create Account
            </Link>
            <Link to="/home" className="text-center text-white/45 hover:text-white/75 text-xs py-1" style={{ transition: 'color 0.2s' }}>Browse as Guest →</Link>
          </div>
          <div className="mt-5 pt-4 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {[['🛏️','37 premium rooms'],['🍽️','110+ menu items'],['🎉','Event halls for 500+'],['🤖','ENAYI AI concierge 24/7']].map(([ic, tx]) => (
              <div key={tx} className="flex items-center gap-2 text-xs text-white/45"><span>{ic}</span>{tx}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────── */}
      <div className="absolute bottom-7 left-6 md:left-12 flex items-center gap-3" style={{ zIndex: 10 }}>
        <button onClick={prev} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)' }}>
          <ChevronLeft size={16} />
        </button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              style={{ width: i === current ? '22px' : '6px', height: '6px', borderRadius: '9999px', background: i === current ? '#C9A227' : 'rgba(255,255,255,0.35)', transition: 'all 0.3s ease', border: 'none', cursor: 'pointer' }} />
          ))}
        </div>
        <button onClick={next} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)' }}>
          <ChevronRight size={16} />
        </button>
        <span className="text-white/35 text-xs ml-1">{String(current + 1).padStart(2,'0')} / {String(total).padStart(2,'0')}</span>
      </div>

      {/* ── Progress bar (photo slides only) ──────────────────────── */}
      {!isVideoSlide && !paused && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'rgba(255,255,255,0.1)', zIndex: 10 }}>
          <div
            key={current}
            className="h-full"
            style={{ background: '#C9A227', animation: 'progress 5.5s linear forwards' }}
          />
        </div>
      )}

      <style>{`
        @keyframes progress { from { width: 0% } to { width: 100% } }
      `}</style>
    </div>
  )
}
