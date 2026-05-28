import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Star, Users, BedDouble, Maximize2, Bath, ArrowRight, ChevronLeft } from 'lucide-react'
import api from '@/utils/api'
import { formatCurrency } from '@/utils/helpers'
import { PageSpinner } from '@/components/ui'
import type { RoomCategory } from '@/types'

export default function RoomDetailPage() {
  const { slug } = useParams<{slug:string}>()
  const { data: room, isLoading } = useQuery<RoomCategory>({ queryKey:['room',slug], queryFn:()=>api.get(`/rooms/categories/${slug}/`).then(r=>r.data) })
  if (isLoading) return <PageSpinner />
  if (!room) return <div className="container-site section text-center text-enayi-muted">Room not found.</div>
  const primary = room.images.find(i=>i.is_primary)||room.images[0]
  return (
    <div className="bg-enayi-bg min-h-screen"><div className="container-site py-8">
      <Link to="/rooms" className="flex items-center gap-2 text-enayi-muted hover:text-enayi-gold text-sm mb-6"><ChevronLeft size={15}/>Back to Rooms</Link>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-enayi-panel">{primary?.image_url?<img src={primary.image_url} alt={room.name} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center text-6xl">🛏️</div>}</div>
          {room.images.length>1&&<div className="grid grid-cols-4 gap-2">{room.images.slice(1,5).map(img=><div key={img.id} className="aspect-square rounded-xl overflow-hidden bg-enayi-panel"><img src={img.image_url} alt="" className="w-full h-full object-cover"/></div>)}</div>}
        </div>
        <div className="space-y-5">
          <div><div className="badge-gold text-xs mb-2">{room.tagline}</div><h1 className="font-display text-3xl text-enayi-text mb-2">{room.name}</h1>{room.avg_rating&&<div className="flex items-center gap-2">{[...Array(5)].map((_,i)=><Star key={i} size={14} className={i<Math.round(room.avg_rating||0)?'text-enayi-gold fill-enayi-gold':'text-enayi-border'}/>)}<span className="text-enayi-gold text-sm">{room.avg_rating}</span></div>}</div>
          <div className="grid grid-cols-2 gap-3">{[{icon:Users,l:'Max Guests',v:`${room.max_adults} adults`},{icon:BedDouble,l:'Bed',v:`${room.num_beds} ${room.bed_type}`},{icon:Maximize2,l:'Size',v:`${room.room_size_sqm}m²`},{icon:Bath,l:'Bathrooms',v:`${room.num_bathrooms}`}].map(({icon:Icon,l,v})=><div key={l} className="card p-3 flex items-center gap-2"><Icon size={14} className="text-enayi-gold"/><div><div className="text-enayi-muted text-[10px]">{l}</div><div className="text-enayi-text text-sm font-medium">{v}</div></div></div>)}</div>
          <p className="text-enayi-muted text-sm leading-relaxed">{room.long_description||room.description}</p>
          {room.amenities.length>0&&<div><div className="text-enayi-gold text-xs font-semibold uppercase tracking-wider mb-2">Amenities</div><div className="flex flex-wrap gap-2">{room.amenities.map(a=><span key={a.id} className="badge-gold text-xs">{a.name}</span>)}</div></div>}
          <div className="card-gold p-5 rounded-2xl"><div className="flex justify-between items-center mb-4"><div><span className="text-enayi-gold font-display text-3xl">{formatCurrency(Number(room.current_price||room.base_price))}</span><span className="text-enayi-muted text-sm ml-2">/night</span></div>{room.available_rooms>0&&<div className="badge-green text-xs">{room.available_rooms} available</div>}</div><Link to={`/book/${room.slug}`} className="btn-gold w-full gap-2">Book Now <ArrowRight size={15}/></Link></div>
        </div>
      </div>
    </div></div>
  )
}
