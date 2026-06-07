import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { BedDouble, CheckCircle, XCircle, Loader2, Building2, ChevronDown } from 'lucide-react'
import api from '@/utils/api'

interface RoomNumber {
  id: string
  room_number: string
  floor: number
  status: string
  view_type: string
  has_balcony: boolean
  category_name: string
  is_available: boolean
}
interface BranchRoomData {
  hotel_id: string
  hotel_name: string
  branch: string
  categories: {
    category_id: string
    category_name: string
    slug: string
    available: number
    total: number
    rooms: RoomNumber[]
  }[]
}

interface Hotel { id: string; name: string; branch: string }

export default function RoomNumbersPage() {
  const [selectedHotel, setSelectedHotel] = useState<string>('')
  const [openCategory, setOpenCategory] = useState<string | null>(null)

  const { data: hotels = [] } = useQuery<Hotel[]>({
    queryKey: ['hotels'],
    queryFn: () => api.get('/hotels/').then(r => Array.isArray(r.data) ? r.data : r.data?.results ?? []),
  })

  const { data, isLoading } = useQuery<BranchRoomData>({
    queryKey: ['branch-rooms', selectedHotel],
    queryFn: () => api.get(`/rooms/branch-availability/?hotel=${selectedHotel}`).then(r => r.data),
    enabled: !!selectedHotel,
  })

  const statusColor = (s: string) => ({
    available:   'bg-jade/15 text-jade border-jade/30',
    occupied:    'bg-rose-500/15 text-rose-400 border-rose-500/30',
    reserved:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
    maintenance: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    cleaning:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  }[s] ?? 'bg-white/10 text-white/40 border-white/10')

  return (
    <div className="bg-enayi-bg min-h-screen">
      {/* Header */}
      <div className="section-sm bg-enayi-surface border-b border-enayi-border text-center">
        <div className="container-site">
          <div className="badge-gold inline-flex mb-4">Room Directory</div>
          <h1 className="font-display text-4xl md:text-5xl text-enayi-text mb-4">
            Room Numbers by Branch
          </h1>
          <div className="gold-line-center mb-5" />
          <p className="text-enayi-muted text-lg max-w-xl mx-auto">
            Browse all rooms by category and see real-time availability at each branch.
          </p>
        </div>
      </div>

      <div className="container-site section">

        {/* Branch selector */}
        <div className="max-w-sm mb-10">
          <label className="label mb-2">Select Branch</label>
          <div className="relative">
            <select
              value={selectedHotel}
              onChange={e => { setSelectedHotel(e.target.value); setOpenCategory(null); }}
              className="input appearance-none pr-10 cursor-pointer"
            >
              <option value="">-- Choose a branch --</option>
              {hotels.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-enayi-muted pointer-events-none" />
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-enayi-gold" />
          </div>
        )}

        {/* No branch selected */}
        {!selectedHotel && !isLoading && (
          <div className="card text-center py-20">
            <Building2 size={48} className="text-enayi-gold/30 mx-auto mb-4" />
            <p className="text-enayi-muted text-lg">Select a branch above to view room numbers</p>
          </div>
        )}

        {/* Room data */}
        {data && !isLoading && (
          <div className="space-y-4">
            {/* Branch summary */}
            <div className="card-gold p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="font-display text-2xl text-enayi-text">{data.hotel_name}</h2>
                <p className="text-enayi-muted text-sm mt-0.5 capitalize">{data.branch} Branch</p>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="font-display text-3xl text-jade">
                    {data.categories.reduce((a, c) => a + c.available, 0)}
                  </p>
                  <p className="text-enayi-muted text-xs uppercase tracking-wider">Available</p>
                </div>
                <div className="text-center">
                  <p className="font-display text-3xl text-enayi-text">
                    {data.categories.reduce((a, c) => a + c.total, 0)}
                  </p>
                  <p className="text-enayi-muted text-xs uppercase tracking-wider">Total Rooms</p>
                </div>
              </div>
            </div>

            {/* Categories accordion */}
            {data.categories.map(cat => (
              <div key={cat.category_id} className="card overflow-hidden">
                <button
                  onClick={() => setOpenCategory(openCategory === cat.category_id ? null : cat.category_id)}
                  className="w-full flex items-center justify-between p-5 hover:bg-white/3 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-enayi-gold/10 border border-enayi-gold/20 flex items-center justify-center">
                      <BedDouble size={18} className="text-enayi-gold" />
                    </div>
                    <div className="text-left">
                      <p className="text-enayi-text font-semibold">{cat.category_name}</p>
                      <p className="text-enayi-muted text-xs mt-0.5">
                        {cat.total} rooms total
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-jade font-bold text-lg">{cat.available}</span>
                      <span className="text-enayi-muted text-sm">/ {cat.total} available</span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-enayi-muted transition-transform duration-200 ${openCategory === cat.category_id ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                <AnimatePresence>
                  {openCategory === cat.category_id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden border-t border-enayi-border"
                    >
                      <div className="p-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {cat.rooms.map(room => (
                            <div
                              key={room.id}
                              className={`rounded-xl border p-3 text-center transition-all ${statusColor(room.status)}`}
                            >
                              <div className="flex items-center justify-center gap-1.5 mb-2">
                                {room.is_available
                                  ? <CheckCircle size={13} />
                                  : <XCircle size={13} />
                                }
                                <span className="font-mono font-bold text-sm">
                                  {room.room_number}
                                </span>
                              </div>
                              <p className="text-xs opacity-70">Floor {room.floor}</p>
                              <p className="text-xs opacity-60 capitalize mt-0.5">
                                {room.status}
                              </p>
                              {room.has_balcony && (
                                <p className="text-xs opacity-50 mt-0.5">Balcony</p>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-enayi-border">
                          {[
                            {s:'available',  l:'Available'},
                            {s:'occupied',   l:'Occupied'},
                            {s:'reserved',   l:'Reserved'},
                            {s:'maintenance',l:'Maintenance'},
                            {s:'cleaning',   l:'Cleaning'},
                          ].map(({s, l}) => (
                            <span key={s} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${statusColor(s)}`}>
                              {l}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
