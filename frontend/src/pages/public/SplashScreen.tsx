import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/utils/api'
import { useAuthStore } from '@/store/authStore'
import { Star, ChevronLeft, ChevronRight, ArrowRight, LogIn, UserPlus, LayoutDashboard, Play } from 'lucide-react'

const FALLBACK_SLIDES = [
  { bg: 'linear-gradient(160deg,#0A0F1E 0%,#1a2744 60%,#0d1929 100%)', label:'Enayi Hotels — Rayfield',    sub:'Where luxury meets Nigerian warmth' },
  { bg: 'linear-gradient(160deg,#1a1000 0%,#3d2800 60%,#1a1000 100%)', label:'Enayi Hotels — Zarmaganda',  sub:'Premier hospitality in the highlands of Jos' },
  { bg: 'linear-gradient(160deg,#0f1a0f 0%,#1a3320 60%,#0f1a0f 100%)', label:'World-Class Dining',         sub:'110+ dishes delivered to your room' },
  { bg: 'linear-gradient(160deg,#1a0a1a 0%,#2d1044 60%,#1a0a1a 100%)', label:'Events & Celebrations',      sub:'From intimate gatherings to grand events' },
]

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

export default function SplashScreen() {
  const { isAuthenticated, user } = useAuthStore()
  const [current, setCurrent]     = useState(0)
  const [fading, setFading]       = useState(false)
  const [paused, setPaused]       = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [videoFailed, setVideoFailed]   = useState(false)
  const [showPlayBtn, setShowPlayBtn]   = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Lock scroll + reset position on mount ────────────────────
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  // ── Auth ─────────────────────────────────────────────────────
  const dashboardLink = (() => {
    if (!isAuthenticated || !user) return null
    const role = user.role ?? ''
    if (['store_keeper','bar_staff','kitchen_staff'].includes(role)) return '/inventory'
    if (role === 'housekeeper') return '/housekeeping'
    if (['manager','admin'].includes(role)) return '/admin'
    return '/dashboard'
  })()
  const ROLE_LABELS: Record<string,string> = { admin:'Owner', manager:'Manager', staff:'Front Desk', store_keeper:'Store Keeper', bar_staff:'Bar Staff', kitchen_staff:'Kitchen Staff', housekeeper:'Housekeeper', guest:'Guest' }
  const roleLabel = ROLE_LABELS[user?.role ?? ''] ?? ''
  const userName = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email : ''

  // ── Gallery ──────────────────────────────────────────────────
  const { data: galleryImages } = useQuery<any[]>({
    queryKey: ['splash-gallery'],
    queryFn: () => api.get('/gallery/?limit=10').then(r => unwrapList(r.data)).catch(() => []),
    staleTime: 5 * 60 * 1000,
  })

  const photoSlides = galleryImages && galleryImages.length >= 2
    ? galleryImages.slice(0,5).map((img:any,i:number) => ({ type:'image' as const, src: img.image_url || img.image, label: img.caption || img.category_name || FALLBACK_SLIDES[i%FALLBACK_SLIDES.length].label, sub: FALLBACK_SLIDES[i%FALLBACK_SLIDES.length].sub }))
    : FALLBACK_SLIDES.map(s => ({ type:'gradient' as const, bg:s.bg, label:s.label, sub:s.sub }))

  const slides = [
    { type:'video' as const, label:'Welcome to Enayi Hotels & Suites', sub:'Experience world-class hospitality in the heart of Jos, Nigeria' },
    ...photoSlides,
  ]
  const total = slides.length
  const slide = slides[current]
  const isVideoSlide = slide.type === 'video'

  // ── Navigation ───────────────────────────────────────────────
  const goTo = useCallback((idx: number) => {
    if (fading) return
    setFading(true)
    setTimeout(() => { setCurrent(idx); setFading(false) }, 350)
  }, [fading])
  const next = useCallback(() => goTo((current+1)%total), [current,total,goTo])
  const prev = useCallback(() => goTo((current-1+total)%total), [current,total,goTo])

  // ── Auto-advance photo slides ─────────────────────────────────
  useEffect(() => {
    if (paused || isVideoSlide) return
    const t = setInterval(next, 5500)
    return () => clearInterval(t)
  }, [paused, isVideoSlide, next])

  // ── Video play logic ──────────────────────────────────────────
  const tryPlayVideo = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = 0
    const p = v.play()
    if (p !== undefined) {
      p.then(() => {
        setVideoPlaying(true)
        setShowPlayBtn(false)
      }).catch(() => {
        // Autoplay blocked (mobile) — show tap-to-play button
        setVideoPlaying(false)
        setShowPlayBtn(true)
      })
    }
  }, [])

  useEffect(() => {
    if (isVideoSlide) {
      setVideoFailed(false)
      setVideoPlaying(false)
      setShowPlayBtn(false)
      // Small delay so the DOM is ready
      const t = setTimeout(tryPlayVideo, 200)
      return () => clearTimeout(t)
    }
  }, [isVideoSlide, tryPlayVideo])

  // ── If video fails to load in 4s, skip to next slide ─────────
  useEffect(() => {
    if (!isVideoSlide) return
    const t = setTimeout(() => {
      if (!videoPlaying) { setVideoFailed(true); next() }
    }, 4000)
    return () => clearTimeout(t)
  }, [isVideoSlide, videoPlaying, next])

  // ── Touch swipe ───────────────────────────────────────────────
  const touchStartX = useRef<number|null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) dx < 0 ? next() : prev()
    touchStartX.current = null
  }

  // Viewport height — use dvh where supported, fall back to 100vh
  const vh = 'calc(var(--vh, 1vh) * 100)'

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden select-none"
      style={{ height: '100svh', minHeight: '100vh', background: '#0A0F1E', touchAction: 'pan-x' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── VIDEO — always in DOM, opacity-toggled ───────────── */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: isVideoSlide && videoPlaying ? 1 : 0, transition:'opacity 0.8s ease', zIndex:1, pointerEvents:'none' }}
        muted playsInline preload="auto"
        onPlay={() => { setVideoPlaying(true); setShowPlayBtn(false) }}
        onEnded={next}
        onError={() => { setVideoFailed(true); if(isVideoSlide) next() }}
      >
        <source src="/videos/enayi-promo.webm" type="video/webm"/>
        <source src="/videos/enayi-promo.mp4"  type="video/mp4"/>
      </video>

      {/* ── PHOTO / GRADIENT SLIDES ──────────────────────────── */}
      {photoSlides.map((s,i) => (
        <div key={i} className="absolute inset-0 w-full h-full"
          style={{ opacity: !isVideoSlide && current===i+1 ? 1 : 0, transition:`opacity ${fading?0.35:0.6}s ease`, zIndex:2 }}>
          {s.type==='image'
            ? <img src={s.src} alt={s.label} className="w-full h-full object-cover" draggable={false}
                loading="eager" decoding="async"/>
            : <div className="w-full h-full" style={{ background:(s as any).bg }}/>
          }
        </div>
      ))}

      {/* Video slide fallback gradient (shown while video loads / fails) */}
      {isVideoSlide && !videoPlaying && (
        <div className="absolute inset-0 w-full h-full" style={{ background:'linear-gradient(160deg,#0A0F1E 0%,#1a2744 55%,#0d1929 100%)', zIndex:2 }}/>
      )}

      {/* ── OVERLAYS ─────────────────────────────────────────── */}
      <div className="absolute inset-0" style={{ background:'linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.4) 45%,rgba(0,0,0,0.15) 100%)', zIndex:4 }}/>
      <div className="absolute inset-0" style={{ background:'linear-gradient(to right,rgba(0,0,0,0.6) 0%,transparent 65%)', zIndex:4 }}/>

      {/* ── TOP BAR ──────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 md:px-12 py-4 md:py-5" style={{ zIndex:10 }}>
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Enayi Hotels" className="h-10 md:h-12 w-auto drop-shadow-lg" onError={e=>(e.currentTarget.style.display='none')}/>
          <div>
            <div className="text-white font-bold text-sm md:text-base leading-tight" style={{textShadow:'0 2px 8px rgba(0,0,0,0.9)'}}>Enayi Hotels</div>
            <div className="text-[10px] tracking-[0.25em] uppercase font-semibold" style={{color:'#C9A227'}}>& Suites · Jos</div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {[...Array(5)].map((_,i)=><Star key={i} size={11} style={{color:'#C9A227'}} fill="#C9A227"/>)}
          <span className="text-[10px] tracking-widest uppercase ml-1.5 font-bold" style={{color:'#C9A227'}}>5 Star</span>
        </div>
      </div>

      {/* ── TAP-TO-PLAY BUTTON (mobile when autoplay blocked) ── */}
      {showPlayBtn && isVideoSlide && (
        <button
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex:8 }}
          onClick={() => {
            const v = videoRef.current
            if (v) v.play().then(()=>{setVideoPlaying(true);setShowPlayBtn(false)}).catch(()=>{})
          }}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background:'rgba(201,162,39,0.2)', border:'2px solid rgba(201,162,39,0.6)', backdropFilter:'blur(8px)' }}>
              <Play size={32} style={{color:'#C9A227'}} fill="#C9A227"/>
            </div>
            <span className="text-white/70 text-sm">Tap to play video</span>
          </div>
        </button>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col justify-end md:justify-center" style={{ zIndex:10 }}>
        <div className="px-5 md:px-12 pb-24 md:pb-0 md:max-w-[58%]">

          {/* Slide label */}
          <div className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold uppercase mb-3"
            style={{ background:'rgba(201,162,39,0.15)', border:'1px solid rgba(201,162,39,0.4)', color:'#C9A227', letterSpacing:'0.2em', opacity:fading?0:1, transition:'opacity 0.35s ease' }}>
            {slide.label}
          </div>

          {/* Headline */}
          <h1 className="font-bold text-white leading-[1.05] mb-3"
            style={{ fontFamily:'Georgia,serif', fontSize:'clamp(2rem,6vw,4.5rem)', textShadow:'0 4px 24px rgba(0,0,0,0.8)', opacity:fading?0:1, transition:'opacity 0.35s ease 0.04s' }}>
            Experience the<br/>
            <span style={{color:'#C9A227'}}>Art of Luxury</span>
          </h1>

          {/* Sub */}
          <p className="text-white/70 mb-6 leading-relaxed"
            style={{ fontSize:'clamp(0.9rem,2.5vw,1.1rem)', maxWidth:'480px', opacity:fading?0:1, transition:'opacity 0.35s ease 0.08s' }}>
            {slide.sub}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-2.5"
            style={{ opacity:fading?0:1, transition:'opacity 0.35s ease 0.12s' }}>
            {isAuthenticated && dashboardLink ? (
              <>
                <Link to={dashboardLink}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm tracking-wide"
                  style={{ background:'#C9A227', color:'#0A0F1E', boxShadow:'0 8px 32px rgba(201,162,39,0.4)' }}>
                  <LayoutDashboard size={16}/> Go to Dashboard
                </Link>
                <Link to="/home"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm border"
                  style={{ border:'1.5px solid rgba(255,255,255,0.4)', color:'white', background:'rgba(255,255,255,0.08)', backdropFilter:'blur(8px)' }}>
                  Explore the Hotel <ArrowRight size={14}/>
                </Link>
              </>
            ) : (
              <>
                <Link to="/login"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm tracking-wide"
                  style={{ background:'#C9A227', color:'#0A0F1E', boxShadow:'0 8px 32px rgba(201,162,39,0.4)' }}>
                  <LogIn size={16}/> Login / Sign In
                </Link>
                <Link to="/register"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm border"
                  style={{ border:'1.5px solid rgba(255,255,255,0.4)', color:'white', background:'rgba(255,255,255,0.08)', backdropFilter:'blur(8px)' }}>
                  <UserPlus size={16}/> Create Account
                </Link>
                <Link to="/home"
                  className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm"
                  style={{ color:'rgba(255,255,255,0.5)' }}>
                  Explore <ArrowRight size={14}/>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT GLASS CARD — desktop only ──────────────────── */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:flex flex-col" style={{ zIndex:10 }}>
        <div style={{ background:'rgba(10,15,30,0.65)', backdropFilter:'blur(20px)', border:'1px solid rgba(201,162,39,0.25)', width:'276px', borderRadius:'18px', padding:'24px 22px' }}>
          <div style={{ color:'#C9A227', fontSize:'10px', letterSpacing:'0.3em' }} className="uppercase font-semibold mb-1">Welcome to</div>
          <div className="text-white text-xl font-bold mb-0.5">Enayi Hotels & Suites</div>
          <div className="text-white/45 text-xs mb-5">Jos, Plateau State · Nigeria</div>
          <div className="flex flex-col gap-2.5">
            {isAuthenticated && dashboardLink ? (
              <>
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl mb-1" style={{ background:'rgba(201,162,39,0.08)', border:'1px solid rgba(201,162,39,0.2)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background:'#C9A227', color:'#0A0F1E' }}>
                    {(user?.first_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white text-xs font-semibold truncate">{userName}</div>
                    <div style={{ color:'#C9A227', fontSize:'10px' }}>{roleLabel}</div>
                  </div>
                </div>
                <Link to={dashboardLink} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold" style={{ background:'#C9A227', color:'#0A0F1E' }}>
                  <LayoutDashboard size={15}/> Go to Dashboard
                </Link>
                <Link to="/home" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold border" style={{ border:'1px solid rgba(255,255,255,0.25)', color:'white' }}>
                  Explore the Hotel
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold" style={{ background:'#C9A227', color:'#0A0F1E' }}>
                  <LogIn size={15}/> Login / Sign In
                </Link>
                <Link to="/register" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold border" style={{ border:'1px solid rgba(255,255,255,0.25)', color:'white' }}>
                  <UserPlus size={15}/> Create Account
                </Link>
                <Link to="/home" className="text-center text-white/45 hover:text-white/70 text-xs py-1" style={{ transition:'color 0.2s' }}>Browse as Guest →</Link>
              </>
            )}
          </div>
          <div className="mt-5 pt-4 space-y-2" style={{ borderTop:'1px solid rgba(255,255,255,0.1)' }}>
            {[['🛏️','37 premium rooms'],['🍽️','110+ menu items'],['🎉','Event halls for 500+'],['🤖','ENAYI AI concierge 24/7']].map(([ic,tx])=>(
              <div key={tx} className="flex items-center gap-2 text-xs text-white/45"><span>{ic}</span>{tx}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── NAVIGATION ───────────────────────────────────────── */}
      <div className="absolute bottom-6 left-5 md:left-12 flex items-center gap-3" style={{ zIndex:10 }}>
        <button onClick={prev} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ border:'1px solid rgba(255,255,255,0.3)', color:'rgba(255,255,255,0.7)', background:'rgba(0,0,0,0.3)' }}>
          <ChevronLeft size={18}/>
        </button>
        <div className="flex gap-1.5 items-center">
          {slides.map((_,i)=>(
            <button key={i} onClick={()=>goTo(i)}
              style={{ width:i===current?'22px':'7px', height:'7px', borderRadius:'9999px', background:i===current?'#C9A227':'rgba(255,255,255,0.4)', transition:'all 0.3s ease', border:'none', cursor:'pointer' }}/>
          ))}
        </div>
        <button onClick={next} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ border:'1px solid rgba(255,255,255,0.3)', color:'rgba(255,255,255,0.7)', background:'rgba(0,0,0,0.3)' }}>
          <ChevronRight size={18}/>
        </button>
        <span className="text-white/35 text-xs">{String(current+1).padStart(2,'0')} / {String(total).padStart(2,'0')}</span>
      </div>

      {/* ── PROGRESS BAR ─────────────────────────────────────── */}
      {!isVideoSlide && !paused && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background:'rgba(255,255,255,0.1)', zIndex:10 }}>
          <div key={current} className="h-full" style={{ background:'#C9A227', animation:'splashProgress 5.5s linear forwards' }}/>
        </div>
      )}

      <style>{`
        @keyframes splashProgress { from{width:0%} to{width:100%} }
        :root { --vh: 1vh; }
      `}</style>
    </div>
  )
}
