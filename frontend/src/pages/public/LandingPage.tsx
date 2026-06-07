import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, Star, Wifi, Coffee, UtensilsCrossed, Car, Calendar, Bot, MapPin,
  X, ChevronLeft, ChevronRight, ImageIcon, Phone,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/utils/api'
import { formatCurrency } from '@/utils/helpers'
import type { RoomCategory } from '@/types'

// ── Branch types (kept local so this page is fully self-contained) ──────────
interface HotelImage {
  id: string
  image_url: string | null
  caption: string
  is_cover: boolean
  sort_order: number
}
interface Hotel {
  id: string
  name: string
  branch: 'zaramaganda' | 'fwawei' | string
  slug: string
  tagline: string
  description: string
  city: string
  state: string
  phone: string
  cover_image_url: string | null
  images: HotelImage[]
  is_primary: boolean
  sort_order: number
}

export default function LandingPage() {
  const { data: rooms } = useQuery<RoomCategory[]>({
    queryKey: ['rooms'],
    queryFn: () => api.get('/rooms/categories/').then(r => {
      const data = r.data
      return Array.isArray(data) ? data : (data?.results ?? [])
    }),
  })

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center bg-enayi-bg overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20"/>
        <div className="glow-orb w-[500px] h-[500px] -top-40 left-1/2 -translate-x-1/2 opacity-20"/>
        <div className="container-site text-center pt-20 pb-24 relative z-10">
          <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.6}}>
            <div className="badge-gold inline-flex mb-6">✦ Two Branches in Jos — Zaramaganda & Fwawei</div>
          </motion.div>
          <motion.h1 initial={{opacity:0,y:32}} animate={{opacity:1,y:0}} transition={{duration:0.9,delay:0.1}} className="font-display text-5xl md:text-7xl text-enayi-text leading-none mb-6">
            Experience the<br/>
            <span style={{
              background: 'linear-gradient(90deg,#C9A227 0%,#E4BB35 30%,#C9A227 60%,#E4BB35 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              display: 'inline-block',
              animation: 'shimmer 4s linear infinite',
            }}>Art of Luxury</span>
          </motion.h1>
          <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.3}} className="text-enayi-muted text-xl max-w-lg mx-auto mb-10">
            Where world-class hospitality meets the warmth of Nigerian culture in the cool highlands of Jos.
          </motion.p>
          <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.4}} className="flex gap-4 justify-center flex-wrap">
            <Link to="/book" className="btn-gold-lg gap-2">Book Your Stay <ArrowRight size={18}/></Link>
            <Link to="/rooms" className="btn-outline">Explore Rooms</Link>
          </motion.div>
        </div>
      </section>

      {/* Branches — both Zaramaganda & Fwawei, with photo lightbox */}
      <BranchShowcase />

      {/* Stats */}
      <div className="bg-enayi-surface border-y border-enayi-border"><div className="container-site grid grid-cols-2 md:grid-cols-4">{[{v:'200+',l:'Luxury Rooms'},{v:'50k+',l:'Happy Guests'},{v:'12+',l:'Years'},{v:'4.9★',l:'Rating'}].map((s,i)=><div key={s.l} className={`py-10 px-6 text-center ${i<3?'border-r border-enayi-border':''}`}><div className="font-display text-3xl text-gold mb-1">{s.v}</div><div className="text-enayi-muted text-sm">{s.l}</div></div>)}</div></div>

      {/* Rooms */}
      <section className="section container-site">
        <div className="text-center mb-12"><div className="badge-gold inline-flex mb-4">🛏️ Rooms & Suites</div><h2 className="font-display text-4xl text-enayi-text mb-4">Choose Your Perfect Room</h2><div className="gold-line-center"/></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(rooms||[{id:'1',name:'Standard Room',base_price:35000,slug:'standard',images:[],current_price:'35000',description:'Comfortable with essential amenities.',available_rooms:5,avg_rating:4.8,tagline:'Comfort & Value',bed_type:'queen',room_size_sqm:28,max_adults:2} as any]).slice(0,3).map((r:RoomCategory,i:number)=>(
            <motion.div key={r.id} initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.1}}>
              <Link to={`/rooms/${r.slug}`} className="card-hover block overflow-hidden group">
                <div className="aspect-[4/3] bg-enayi-panel flex items-center justify-center overflow-hidden">
                  {r.images?.[0]?.image_url?<img src={r.images[0].image_url} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>:<div className="text-5xl">🛏️</div>}
                </div>
                <div className="p-5">
                  <div className="flex justify-between mb-2"><h3 className="font-heading text-lg text-enayi-text">{r.name}</h3>{r.avg_rating&&<span className="text-xs text-enayi-gold flex items-center gap-1"><Star size={11} fill="currentColor"/>{r.avg_rating}</span>}</div>
                  <p className="text-enayi-muted text-sm mb-4 line-clamp-2">{r.description}</p>
                  <div className="flex items-center justify-between"><span className="text-enayi-gold font-display text-2xl">{formatCurrency(Number(r.current_price||r.base_price))}<span className="text-enayi-muted text-xs font-normal ml-1">/night</span></span><span className="btn-outline text-xs px-3 py-1.5">Book Now</span></div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
        <div className="text-center mt-8"><Link to="/rooms" className="btn-outline gap-2">All Rooms <ArrowRight size={14}/></Link></div>
      </section>

      {/* Features */}
      <section className="section bg-enayi-surface border-y border-enayi-border">
        <div className="container-site"><div className="text-center mb-12"><h2 className="font-display text-4xl text-enayi-text mb-4">Everything You Need</h2><div className="gold-line-center"/></div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">{[{icon:Wifi,t:'Free Wi-Fi',d:'Complimentary fibre internet throughout.'},{icon:Coffee,t:'Gourmet Breakfast',d:'Nigerian and continental buffet daily.'},{icon:UtensilsCrossed,t:'24hr Room Service',d:'Order food and drinks anytime.'},{icon:Car,t:'Airport Transfers',d:'Pickup from Jos Yakubu Gowon Airport.'},{icon:Calendar,t:'Event Halls',d:'Weddings, conferences, and celebrations.'},{icon:Bot,t:'AI Concierge',d:'ARIA available 24/7 for any request.'}].map(f=><div key={f.t} className="card p-5 group hover:border-enayi-gold/20 hover:-translate-y-0.5 transition-all"><div className="w-10 h-10 rounded-xl bg-enayi-gold/10 border border-enayi-gold/20 flex items-center justify-center mb-3 group-hover:bg-enayi-gold/15"><f.icon size={18} className="text-enayi-gold"/></div><h3 className="font-heading text-base text-enayi-text mb-1">{f.t}</h3><p className="text-enayi-muted text-xs">{f.d}</p></div>)}</div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-sm"><div className="container-site"><div className="card-gold rounded-3xl p-10 text-center relative overflow-hidden"><div className="glow-orb w-64 h-64 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"/><div className="relative z-10"><h2 className="font-display text-4xl text-enayi-text mb-4">Ready for an Unforgettable Stay?</h2><div className="gold-line-center mb-6"/><div className="flex gap-4 justify-center flex-wrap"><Link to="/book" className="btn-gold-lg gap-2">Book a Room <ArrowRight size={18}/></Link><Link to="/contact" className="btn-outline gap-2"><MapPin size={15}/> Contact Us</Link></div></div></div></div></section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch showcase (inlined here so LandingPage has no external dependency)
// ─────────────────────────────────────────────────────────────────────────────
function BranchShowcase() {
  const { data: hotels, isLoading } = useQuery<Hotel[]>({
    queryKey: ['hotels'],
    queryFn: () => api.get('/hotels/').then(r => {
      const data = r.data
      return Array.isArray(data) ? data : (data?.results ?? [])
    }),
  })

  const [active, setActive] = useState<Hotel | null>(null)

  return (
    <section className="section container-site relative overflow-hidden">
      <div className="glow-orb w-[420px] h-[420px] -top-24 right-0 opacity-15" />

      <div className="text-center mb-12 relative z-10">
        <div className="badge-gold inline-flex mb-4">✦ Two Branches, One Standard of Luxury</div>
        <h2 className="font-display text-4xl text-enayi-text mb-4">Choose Your Enayi</h2>
        <p className="text-enayi-muted max-w-xl mx-auto mb-4">
          Our Zaramaganda and Fwawei branches each offer their own character and rates.
          Tap a branch to explore its spaces.
        </p>
        <div className="gold-line-center" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {isLoading && [0, 1].map(i => (
          <div key={i} className="skeleton aspect-[16/10] rounded-2xl" />
        ))}

        {!isLoading && (hotels ?? []).map((hotel, i) => (
          <motion.div
            key={hotel.id}
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              onClick={() => hotel.images?.length && setActive(hotel)}
              className="card-hover group block w-full text-left overflow-hidden rounded-2xl"
            >
              <div className="relative aspect-[16/10] bg-enayi-panel overflow-hidden">
                {hotel.cover_image_url || hotel.images?.[0]?.image_url ? (
                  <img
                    src={hotel.cover_image_url || hotel.images[0].image_url || ''}
                    alt={hotel.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-enayi-muted">
                    <ImageIcon size={40} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-enayi-bg via-enayi-bg/30 to-transparent" />

                {hotel.is_primary && (
                  <span className="absolute top-4 left-4 badge-gold">Flagship</span>
                )}
                {hotel.images?.length > 0 && (
                  <span className="absolute top-4 right-4 badge bg-black/40 text-enayi-text border border-white/10 backdrop-blur-sm">
                    <ImageIcon size={12} /> {hotel.images.length}
                  </span>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h3 className="font-display text-2xl text-enayi-text mb-1">
                    {hotel.name?.replace('Enayi Hotels & Suites — ', '') || hotel.branch}
                  </h3>
                  {hotel.tagline && (
                    <p className="text-enayi-muted text-sm mb-3 line-clamp-1">{hotel.tagline}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-enayi-muted">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-enayi-gold" />
                      {[hotel.city, hotel.state].filter(Boolean).join(', ')}
                    </span>
                    {hotel.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={12} className="text-enayi-gold" />
                        {hotel.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-5">
                <span className="text-enayi-gold text-sm font-semibold inline-flex items-center gap-1.5">
                  <ImageIcon size={14} /> View photos
                </span>
                <Link
                  to={`/rooms?branch=${hotel.branch}`}
                  onClick={(e) => e.stopPropagation()}
                  className="btn-outline text-xs px-3 py-1.5 gap-1"
                >
                  See rooms & rates <ArrowRight size={13} />
                </Link>
              </div>
            </button>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {active && <BranchLightbox hotel={active} onClose={() => setActive(null)} />}
      </AnimatePresence>
    </section>
  )
}

function BranchLightbox({ hotel, onClose }: { hotel: Hotel; onClose: () => void }) {
  const images = hotel.images ?? []
  const [idx, setIdx] = useState(0)
  const go = (dir: number) => setIdx((p) => (p + dir + images.length) % images.length)
  const current = images[idx]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-lg text-enayi-text">{hotel.name}</h3>
          <button onClick={onClose} className="btn-ghost p-2 rounded-full" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-enayi-panel aspect-[16/10] border border-enayi-border">
          <AnimatePresence mode="wait">
            <motion.img
              key={current?.id ?? idx}
              src={current?.image_url ?? ''}
              alt={current?.caption || hotel.name}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </AnimatePresence>

          {images.length > 1 && (
            <>
              <button
                onClick={() => go(-1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm flex items-center justify-center text-enayi-text hover:bg-enayi-gold hover:text-enayi-bg transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => go(1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm flex items-center justify-center text-enayi-text hover:bg-enayi-gold hover:text-enayi-bg transition-colors"
                aria-label="Next"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {current?.caption && (
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
              <p className="text-enayi-text text-sm">{current.caption}</p>
            </div>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide pb-1">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setIdx(i)}
                className={`shrink-0 w-20 h-14 rounded-lg overflow-hidden border transition-all ${
                  i === idx ? 'border-enayi-gold' : 'border-enayi-border opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img.image_url ?? ''} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
