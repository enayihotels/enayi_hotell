import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BedDouble, CheckCircle, XCircle, Loader2,
  Building2, ChevronDown, AlertCircle, RefreshCw,
} from 'lucide-react'
import api from '@/utils/api'

interface RoomEntry {
  id: string
  room_number: string
  floor: number
  status: string
  view_type: string
  has_balcony: boolean
  is_available: boolean
}
interface CategoryGroup {
  category: string
  category_slug: string
  rooms: RoomEntry[]
  free_count: number
  total_count: number
}
interface BranchData {
  hotel_id: string
  hotel_name: string
  branch: string
  total_rooms: number
  free_rooms: number
  categories: CategoryGroup[]
}
interface Hotel { id: string; name: string; branch: string }

const STATUS_STYLE: Record<string, string> = {
  available:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  occupied:    'bg-rose-500/15   text-rose-400   border-rose-500/30',
  reserved:    'bg-amber-500/15  text-amber-400  border-amber-500/30',
  maintenance: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  cleaning:    'bg-blue-500/15   text-blue-400   border-blue-500/30',
}

export default function RoomsPage() {
  const [selectedHotel, setSelectedHotel] = useState('')
  const [openCat, setOpenCat]             = useState<string | null>(null)

  const { data: hotels = [], isLoading: hotelsLoading } = useQuery<Hotel[]>({
    queryKey: ['hotels'],
    queryFn:  () => api.get('/hotels/').then(r =>
      Array.isArray(r.data) ? r.data : (r.data?.results ?? [])),
    retry: 2,
    retryDelay: 3000,
  })

  const {
    data, isLoading, isError, error, refetch,
  } = useQuery<BranchData>({
    queryKey: ['branch-rooms', selectedHotel],
    queryFn:  () =>
      api.get(`/rooms/branch-availability/?hotel=${selectedHotel}`)
         .then(r => r.data),
    enabled:    !!selectedHotel,
    retry:      2,
    retryDelay: 4000,
  })

  return (
    <div className="bg-enayi-bg min-h-screen">

      {/* Page header */}
      <div className="section-sm bg-enayi-surface border-b border-enayi-border text-center">
        <div className="container-site">
          <div className="badge-gold inline-flex mb-4">Room Directory</div>
          <h1 className="font-display text-4xl md:text-5xl text-enayi-text mb-4">
            Rooms by Branch
          </h1>
          <div className="gold-line-center mb-5" />
          <p className="text-enayi-muted text-lg max-w-xl mx-auto">
            Select a branch to browse all rooms by category with live availability.
          </p>
        </div>
      </div>

      <div className="container-site py-12">

        {/* Branch selector */}
        <div className="max-w-sm mb-10">
          <label className="block text-xs font-semibold text-enayi-muted uppercase tracking-widest mb-2">
            Select Branch
          </label>
          {hotelsLoading ? (
            <div className="input flex items-center gap-2 text-enayi-muted">
              <Loader2 size={14} className="animate-spin" /> Loading branches...
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedHotel}
                onChange={e => { setSelectedHotel(e.target.value); setOpenCat(null); }}
                className="input appearance-none pr-10 cursor-pointer"
              >
                <option value="">-- Choose a branch --</option>
                {hotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              <ChevronDown size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-enayi-muted pointer-events-none" />
            </div>
          )}
        </div>

        {/* No branch selected */}
        {!selectedHotel && (
          <div className="card text-center py-20 max-w-md mx-auto">
            <Building2 size={48} className="text-enayi-gold/30 mx-auto mb-4" />
            <p className="text-enayi-muted">Select a branch above to view room numbers</p>
          </div>
        )}

        {/* Loading */}
        {selectedHotel && isLoading && (
          <div className="text-center py-20">
            <Loader2 size={36} className="animate-spin text-enayi-gold mx-auto mb-4" />
            <p className="text-enayi-muted">Loading rooms — server may be waking up, please wait...</p>
          </div>
        )}

        {/* Error */}
        {selectedHotel && isError && !isLoading && (
          <div className="card border-rose-500/30 bg-rose-500/5 text-center py-12 max-w-md mx-auto">
            <AlertCircle size={36} className="text-rose-400 mx-auto mb-4" />
            <p className="text-rose-300 font-medium mb-2">Could not load rooms</p>
            <p className="text-enayi-muted text-sm mb-6">
              The server may still be starting up. Please try again.
            </p>
            <button onClick={() => refetch()}
              className="inline-flex items-center gap-2 btn-outline text-sm px-5 py-2.5">
              <RefreshCw size={14} /> Try Again
            </button>
          </div>
        )}

        {/* Room data */}
        {data && !isLoading && (
          <div className="space-y-4">

            {/* Branch summary card */}
            <div className="card-gold p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="font-display text-2xl text-enayi-text">{data.hotel_name}</h2>
                <p className="text-enayi-muted text-sm mt-0.5 capitalize">
                  {data.branch} Branch
                </p>
              </div>
              <div className="flex gap-8">
                <div className="text-center">
                  <p className="font-display text-3xl text-emerald-400">{data.free_rooms}</p>
                  <p className="text-enayi-muted text-xs uppercase tracking-wider mt-0.5">Available</p>
                </div>
                <div className="text-center">
                  <p className="font-display text-3xl text-enayi-text">{data.total_rooms}</p>
                  <p className="text-enayi-muted text-xs uppercase tracking-wider mt-0.5">Total</p>
                </div>
              </div>
            </div>

            {/* No rooms found */}
            {data.categories.length === 0 && (
              <div className="card text-center py-12">
                <BedDouble size={36} className="text-enayi-gold/30 mx-auto mb-3" />
                <p className="text-enayi-muted">No rooms found for this branch yet.</p>
              </div>
            )}

            {/* Category accordions */}
            {data.categories.map(cat => (
              <div key={cat.category_slug} className="card overflow-hidden">

                {/* Category header — click to expand */}
                <button
                  onClick={() => setOpenCat(
                    openCat === cat.category_slug ? null : cat.category_slug
                  )}
                  className="w-full flex items-center justify-between p-5
                             hover:bg-white/3 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-enayi-gold/10
                                    border border-enayi-gold/20 flex items-center justify-center shrink-0">
                      <BedDouble size={18} className="text-enayi-gold" />
                    </div>
                    <div>
                      <p className="text-enayi-text font-semibold">{cat.category}</p>
                      <p className="text-enayi-muted text-xs mt-0.5">
                        {cat.total_count} rooms total
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-emerald-400 font-bold text-lg">{cat.free_count}</span>
                    <span className="text-enayi-muted text-sm">/ {cat.total_count} free</span>
                    <ChevronDown size={16} className={`text-enayi-muted transition-transform duration-200
                      ${openCat === cat.category_slug ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Room grid — expandable */}
                <AnimatePresence>
                  {openCat === cat.category_slug && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden border-t border-enayi-border"
                    >
                      <div className="p-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-5">
                          {cat.rooms.map(room => (
                            <div key={room.id}
                              className={`rounded-xl border p-3 text-center transition-all
                                ${STATUS_STYLE[room.status] ?? STATUS_STYLE.occupied}`}
                            >
                              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                                {room.is_available
                                  ? <CheckCircle size={12} />
                                  : <XCircle size={12} />}
                                <span className="font-mono font-bold text-sm">
                                  {room.room_number}
                                </span>
                              </div>
                              <p className="text-xs opacity-70">Floor {room.floor}</p>
                              <p className="text-xs opacity-55 capitalize mt-0.5">
                                {room.status}
                              </p>
                              {room.has_balcony && (
                                <p className="text-xs opacity-45 mt-0.5">Balcony</p>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Status legend */}
                        <div className="flex flex-wrap gap-2 pt-4 border-t border-enayi-border">
                          {Object.entries({
                            available: 'Available',
                            occupied:  'Occupied',
                            reserved:  'Reserved',
                            maintenance: 'Maintenance',
                            cleaning: 'Cleaning',
                          }).map(([s, l]) => (
                            <span key={s}
                              className={`inline-flex items-center gap-1 text-xs
                                         px-2.5 py-1 rounded-full border
                                         ${STATUS_STYLE[s] ?? ''}`}>
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
