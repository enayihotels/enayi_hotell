import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import api from '@/utils/api'
import { useAuthStore } from '@/store/authStore'
import { Star, ChevronLeft, ChevronRight, ArrowRight, LogIn, UserPlus } from 'lucide-react'

// Fallback cinematic gradient slides when gallery images aren't available
const FALLBACK_SLIDES = [
  {
    bg: 'linear-gradient(135deg, #0A0F1E 0%, #1a2744 40%, #0d1929 100%)',
    label: 'Enayi Hotels — Rayfield',
    sub: 'Where luxury meets Nigerian warmth',
    isVideo: false,
  },
  {
    bg: 'linear-gradient(135deg, #1a1000 0%, #3d2800 40%, #1a1000 100%)',
    label: 'Enayi Hotels — Zarmaganda',
    sub: 'Premier hospitality in the highlands of Jos',
    isVideo: false,
  },
  {
    bg: 'linear-gradient(135deg, #0f1a0f 0%, #1a3320 40%, #0f1a0f 100%)',
    label: 'World-Class Dining',
    sub: '110+ dishes from kitchen to your door',
    isVideo: false,
  },
  {
    bg: 'linear-gradient(135deg, #1a0a1a 0%, #2d1044 40%, #1a0a1a 100%)',
    label: 'Events & Celebrations',
    sub: 'From intimate gatherings to grand events',
    isVideo: false,
  },
]

// The promotional hotel video — always the FIRST slide
const VIDEO_SLIDE = {
  isVideo: true,
  videoMp4: '/videos/enayi-promo.mp4',
  videoWebm: '/videos/enayi-promo.webm',
  label: 'Welcome to Enayi Hotels & Suites',
  sub: 'Experience world-class hospitality in the heart of Jos',
  bg: 'linear-gradient(135deg, #0A0F1E 0%, #1a2744 100%)',
}

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

// Ken Burns keyframe — subtle slow zoom gives images life
const kenBurnsVariants = {
  initial: { scale: 1.08, opacity: 0 },
  animate: { scale: 1.0,  opacity: 1,  transition: { duration: 1.2, ease: 'easeOut' } },
  exit:    { scale: 0.96, opacity: 0,  transition: { duration: 0.8, ease: 'easeIn'  } },
}

// Text stagger
const textVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.18, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

export default function SplashScreen() {
  const { isAuthenticated, user } = useAuthStore()
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)

  // Redirect already-authenticated users to their correct landing
  useEffect(() => {
    if (!isAuthenticated || !user) return
    const role = user.role
    if (['store_keeper','bar_staff','kitchen_staff'].includes(role)) navigate('/inventory', { replace: true })
    else if (role === 'housekeeper') navigate('/housekeeping', { replace: true })
    else if (['manager','admin'].includes(role)) navigate('/admin', { replace: true })
    else navigate('/dashboard', { replace: true })
  }, [isAuthenticated, user, navigate])

  // Fetch real gallery images from the hotel
  const { data: galleryImages } = useQuery<any[]>({
    queryKey: ['splash-gallery'],
    queryFn: () => api.get('/gallery/?limit=12').then(r => unwrapList(r.data)).catch(() => []),
    staleTime: 5 * 60 * 1000,
  })

  // Build slides: video first, then real gallery images, then fallback gradients
  const slides = [
    VIDEO_SLIDE,
    ...(galleryImages && galleryImages.length >= 2
      ? galleryImages.slice(0, 5).map((img: any, i: number) => ({
          isVideo: false,
          imageUrl: img.image_url || img.image,
          label: img.caption || img.category_name || FALLBACK_SLIDES[i % FALLBACK_SLIDES.length].label,
          sub: FALLBACK_SLIDES[i % FALLBACK_SLIDES.length].sub,
          bg: FALLBACK_SLIDES[i % FALLBACK_SLIDES.length].bg,
        }))
      : FALLBACK_SLIDES.map(s => ({ isVideo: false, imageUrl: undefined, ...s }))
    ),
  ]

  const total = slides.length

  const next = useCallback(() => setCurrent(c => (c + 1) % total), [total])
  const prev = useCallback(() => setCurrent(c => (c - 1 + total) % total), [total])

  // Auto-advance every 5 seconds unless paused OR on the video slide
  // (video advances itself via onEnded)
  useEffect(() => {
    if (paused || slide.isVideo) return
    const t = setInterval(next, 5000)
    return () => clearInterval(t)
  }, [next, paused, slide.isVideo])

  const slide = slides[current]

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0A0F1E]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}>

      {/* ── Cinematic background slides ──────────────────────────────── */}
      <AnimatePresence mode="sync">
        <motion.div
          key={current}
          variants={kenBurnsVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="absolute inset-0 w-full h-full"
        >
          {slide.isVideo ? (
            // Video slide — muted+autoplay required for browser autoplay policy
            <video
              key="hotel-promo-video"
              className="w-full h-full object-cover"
              autoPlay muted playsInline preload="auto"
              onEnded={next}
            >
              <source src={(slide as any).videoWebm} type="video/webm" />
              <source src={(slide as any).videoMp4}  type="video/mp4"  />
            </video>
          ) : (slide as any).imageUrl ? (
            <img
              src={(slide as any).imageUrl}
              alt={slide.label}
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full" style={{ background: (slide as any).bg }} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Multi-layer overlay for depth and readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

      {/* ── Top bar — hotel branding ──────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 md:px-12 py-6 z-20">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Enayi Hotels" className="h-14 w-auto drop-shadow-lg" onError={e => (e.currentTarget.style.display='none')} />
          <div>
            <div className="text-white font-bold text-lg leading-tight tracking-wide" style={{textShadow:'0 2px 12px rgba(0,0,0,0.8)'}}>
              Enayi Hotels
            </div>
            <div className="text-[#C9A227] text-[10px] tracking-[0.3em] uppercase font-semibold">& Suites · Jos</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_,i) => <Star key={i} size={12} className="text-[#C9A227]" fill="#C9A227" />)}
          <span className="text-[#C9A227] text-[10px] tracking-widest uppercase ml-1.5 font-bold">5 Star</span>
        </div>
      </div>

      {/* ── Main content — left-anchored ──────────────────────────────── */}
      <div className="absolute inset-0 flex items-end md:items-center z-20">
        <div className="w-full px-6 md:px-12 pb-32 md:pb-0 md:max-w-[60%]">
          <AnimatePresence mode="wait">
            <motion.div key={`text-${current}`} initial="hidden" animate="visible">
              {/* Slide label */}
              <motion.div custom={0} variants={textVariants}
                className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
                style={{ background: 'rgba(201,162,39,0.18)', border: '1px solid rgba(201,162,39,0.4)', color: '#C9A227' }}>
                {slide.label}
              </motion.div>

              {/* Hero headline */}
              <motion.h1 custom={1} variants={textVariants}
                className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] mb-4"
                style={{ fontFamily: 'Georgia, serif', textShadow: '0 4px 24px rgba(0,0,0,0.6)' }}>
                Experience the<br />
                <span style={{ color: '#C9A227' }}>Art of Luxury</span>
              </motion.h1>

              {/* Subtitle */}
              <motion.p custom={2} variants={textVariants}
                className="text-white/70 text-base md:text-lg mb-8 leading-relaxed max-w-lg">
                {slide.sub}
              </motion.p>

              {/* CTA buttons */}
              <motion.div custom={3} variants={textVariants} className="flex flex-col sm:flex-row gap-3">
                <Link to="/login"
                  className="flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ background: '#C9A227', color: '#0A0F1E', boxShadow: '0 8px 32px rgba(201,162,39,0.4)' }}>
                  <LogIn size={16} /> Login / Sign In
                </Link>
                <Link to="/register"
                  className="flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-sm tracking-wide border transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ border: '1.5px solid rgba(255,255,255,0.4)', color: 'white', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
                  <UserPlus size={16} /> Create Account
                </Link>
                <Link to="/home"
                  className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-sm text-white/60 hover:text-white transition-colors">
                  Explore the hotel <ArrowRight size={14} />
                </Link>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Right panel — glass card on desktop ──────────────────────── */}
      <div className="absolute right-6 md:right-12 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-4 z-20">
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(10,15,30,0.65)', backdropFilter: 'blur(20px)', border: '1px solid rgba(201,162,39,0.25)', width: '280px', padding: '28px 24px' }}>
          <div className="text-[#C9A227] text-[10px] font-semibold tracking-[0.3em] uppercase mb-1">Welcome to</div>
          <div className="text-white text-xl font-bold mb-1">Enayi Hotels & Suites</div>
          <div className="text-white/50 text-xs mb-5">Jos, Plateau State · Nigeria</div>

          <div className="flex flex-col gap-2.5">
            <Link to="/login"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all hover:opacity-90 active:scale-95"
              style={{ background: '#C9A227', color: '#0A0F1E' }}>
              <LogIn size={15} /> Login / Sign In
            </Link>
            <Link to="/register"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold tracking-wide border transition-all hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}>
              <UserPlus size={15} /> Create Account
            </Link>
            <Link to="/home"
              className="text-center text-white/50 hover:text-white/80 text-xs py-1 transition-colors">
              Browse as Guest →
            </Link>
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
            {[
              ['🛏️', '37 premium rooms'],
              ['🍽️', '110+ menu items'],
              ['🎉', 'Event halls for 500+'],
              ['🤖', 'ENAYI AI concierge 24/7'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-2 text-xs text-white/50">
                <span>{icon}</span> {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Slide navigation — arrows + dots ─────────────────────────── */}
      <div className="absolute bottom-8 left-6 md:left-12 flex items-center gap-4 z-20">
        {/* Arrows */}
        <button onClick={prev}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-white/30 text-white/70 hover:text-white hover:border-white/70 hover:bg-white/10 transition-all">
          <ChevronLeft size={16} />
        </button>
        {/* Dots */}
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className="transition-all duration-300 rounded-full"
              style={{
                width: i === current ? '24px' : '6px',
                height: '6px',
                background: i === current ? '#C9A227' : 'rgba(255,255,255,0.4)',
              }} />
          ))}
        </div>
        <button onClick={next}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-white/30 text-white/70 hover:text-white hover:border-white/70 hover:bg-white/10 transition-all">
          <ChevronRight size={16} />
        </button>
        {/* Slide counter */}
        <span className="text-white/40 text-xs ml-1">
          {String(current + 1).padStart(2,'0')} / {String(total).padStart(2,'0')}
        </span>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────── */}
      {!paused && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 z-20">
          <motion.div
            key={`progress-${current}`}
            className="h-full"
            style={{ background: '#C9A227' }}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 5, ease: 'linear' }}
          />
        </div>
      )}
    </div>
  )
}
