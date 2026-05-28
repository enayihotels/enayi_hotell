import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, ArrowRight, X, ChevronLeft, ChevronRight, ImageIcon, Phone } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/utils/api'

// ── Types (kept local so the component is drop-in; mirror these into
//    src/types/index.ts if you prefer a shared definition) ──────────────
export interface HotelImage {
  id: string
  image_url: string | null
  caption: string
  is_cover: boolean
  sort_order: number
}

export interface Hotel {
  id: string
  name: string
  branch: 'zaramaganda' | 'fwawei' | string
  slug: string
  tagline: string
  description: string
  address: string
  city: string
  state: string
  phone: string
  whatsapp: string
  cover_image_url: string | null
  images: HotelImage[]
  is_primary: boolean
  sort_order: number
}

const fetchHotels = async (): Promise<Hotel[]> => {
  const { data } = await api.get('/hotels/')
  return Array.isArray(data) ? data : (data?.results ?? [])
}

export default function BranchShowcase() {
  const { data: hotels, isLoading } = useQuery<Hotel[]>({
    queryKey: ['hotels'],
    queryFn: fetchHotels,
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

      {/* Photo lightbox */}
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
