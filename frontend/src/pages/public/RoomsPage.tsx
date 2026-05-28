import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Star, Users, Maximize2, BedDouble } from 'lucide-react'
import api from '@/utils/api'
import { formatCurrency } from '@/utils/helpers'
import { PageSpinner } from '@/components/ui'
import type { RoomCategory } from '@/types'

export default function RoomsPage() {
  const { data: rooms, isLoading } = useQuery<RoomCategory[]>({ queryKey:['rooms'], queryFn: () => api.get('/rooms/categories/').then(r => r.data.results ?? r.data),
})
  if (isLoading) return <PageSpinner />
  return (
    <div className="bg-enayi-bg min-h-screen">
      <div className="section-sm bg-enayi-surface border-b border-enayi-border text-center"><div className="container-site"><div className="badge-gold inline-flex mb-4">🛏️ Rooms & Suites</div><h1 className="font-display text-5xl text-enayi-text mb-4">Our Rooms</h1><div className="gold-line-center mb-4"/><p className="text-enayi-muted text-lg max-w-lg mx-auto">From comfortable standard rooms to lavish presidential suites.</p></div></div>
      <div className="container-site section"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(rooms||[]).map((r,i)=>(
          <motion.div key={r.id} initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{delay:i*0.1}}>
            <Link to={`/rooms/${r.slug}`} className="card-hover block overflow-hidden group">
              <div className="aspect-[4/3] bg-enayi-panel overflow-hidden flex items-center justify-center relative">
                {r.images?.[0]?.image_url?<img src={r.images[0].image_url} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>:<div className="text-5xl">🛏️</div>}
                {r.available_rooms>0?<div className="absolute top-3 right-3 badge-green text-xs">Available</div>:<div className="absolute top-3 right-3 badge-red text-xs">Sold Out</div>}
              </div>
              <div className="p-5">
                <div className="badge-gold text-xs mb-2">{r.tagline}</div>
                <div className="flex justify-between mb-2"><h3 className="font-heading text-xl text-enayi-text">{r.name}</h3>{r.avg_rating&&<span className="text-xs text-enayi-gold flex items-center gap-1"><Star size={11} fill="currentColor"/>{r.avg_rating}</span>}</div>
                <p className="text-enayi-muted text-sm mb-4 line-clamp-2">{r.description}</p>
                <div className="flex items-center gap-4 text-xs text-enayi-muted mb-4"><span className="flex items-center gap-1"><Users size={11}/>{r.max_adults}</span><span className="flex items-center gap-1"><BedDouble size={11}/>{r.bed_type}</span><span className="flex items-center gap-1"><Maximize2 size={11}/>{r.room_size_sqm}m²</span></div>
                <div className="flex items-center justify-between"><span className="text-enayi-gold font-display text-2xl">{formatCurrency(Number(r.current_price||r.base_price))}<span className="text-enayi-muted text-xs ml-1">/night</span></span><span className="btn-outline text-sm px-4 py-2">Book</span></div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div></div>
    </div>
  )
}
