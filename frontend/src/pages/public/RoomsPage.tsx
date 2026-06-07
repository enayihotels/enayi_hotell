import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BedDouble, CheckCircle, XCircle, Loader2,
  Building2, ChevronDown, AlertCircle, RefreshCw,
  Eye, Maximize2, Wind,
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

function getRoomImage(slug: string, name: string): string {
  const s = (slug + ' ' + name).toLowerCase()
  if (s.includes('presidential'))                             return '/rooms/presidential.jpg'
  if (s.includes('honeymoon'))                               return '/rooms/honeymoon-suite.jpg'
  if (s.includes('suite'))                                   return '/rooms/suite.jpg'
  if (s.includes('executive') || s.includes('exec'))         return '/rooms/executive-deluxe.jpg'
  if (s.includes('classic plus') || s.includes('classic-plus')) return '/rooms/classic-plus.jpg'
  if (s.includes('deluxe'))                                  return '/rooms/deluxe-room.jpg'
  if (s.includes('classic'))                                 return '/rooms/classic-room.jpg'
  if (s.includes('superior'))                                return '/rooms/superior-room.jpg'
  if (s.includes('family'))                                  return '/rooms/family-room.jpg'
  if (s.includes('single'))                                  return '/rooms/single-room.jpg'
  if (s.includes('standard'))                                return '/rooms/standard-room.jpg'
  return '/rooms/standard-room.jpg'
}

function RoomModal({ room, catName, catSlug, branchName, hotelId, onClose }: {
  room: RoomEntry; catName: string; catSlug: string;
  branchName?: string; hotelId?: string; onClose: () => void
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }} transition={{ duration: 0.22 }}
        onClick={e => e.stopPropagation()}
        className="bg-enayi-surface border border-enayi-gold/30 rounded-2xl overflow-hidden w-full max-w-lg shadow-2xl">
        <div className="relative aspect-video">
          <img src={getRoomImage(catSlug, catName)} alt={catName}
               className="w-full h-full object-cover"/>
          <div className="absolute inset-0 bg-gradient-to-t from-enayi-bg/90 via-transparent to-transparent"/>
          <div className="absolute top-4 right-4">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border
              ${STATUS_STYLE[room.status] ?? STATUS_STYLE.occupied}`}>
              {room.is_available ? <><CheckCircle size={12}/> Available</> : <><XCircle size={12}/> {room.status}</>}
            </span>
          </div>
          <div className="absolute bottom-4 left-4">
            {branchName && <p className="text-enayi-gold text-xs font-semibold uppercase tracking-widest mb-0.5">{branchName}</p>}
            <p className="text-enayi-gold text-xs font-semibold uppercase tracking-widest mb-1">Room Number</p>
            <p className="font-display font-bold text-4xl text-white">{room.room_number}</p>
          </div>
        </div>
        <div className="p-6">
          <h3 className="font-display text-2xl text-enayi-text mb-1">{catName}</h3>
          <div className="h-px w-12 mb-4" style={{background:'linear-gradient(90deg,#C9A227,transparent)'}}/>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { icon: Maximize2, label: 'Floor',   value: `Floor ${room.floor}` },
              { icon: Eye,       label: 'View',    value: room.view_type.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase()) },
              { icon: Wind,      label: 'Balcony', value: room.has_balcony ? 'Yes' : 'No' },
              { icon: BedDouble, label: 'Type',    value: catName },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-enayi-bg/50 rounded-xl px-4 py-3 flex items-center gap-3">
                <Icon size={16} className="text-enayi-gold shrink-0"/>
                <div>
                  <p className="text-enayi-muted text-xs">{label}</p>
                  <p className="text-enayi-text text-sm font-medium">{value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <a href={`/book/${catSlug}${hotelId ? `?hotel=${hotelId}` : ""}`} className="flex-1 text-center text-sm py-3 font-semibold rounded-xl
               bg-enayi-gold text-enayi-bg flex items-center justify-center gap-2 hover:brightness-110 transition-all">
              Book This Room
            </a>
            <button onClick={onClose} className="px-4 py-3 rounded-xl border border-enayi-border
               text-enayi-muted hover:text-enayi-text hover:border-enayi-gold/40 transition-colors text-sm">
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Merge categories from multiple branches for "All Branches" view
function mergeCategories(branches: BranchData[]): CategoryGroup[] {
  const merged: Record<string, CategoryGroup & { branches: string[] }> = {}
  for (const branch of branches) {
    for (const cat of branch.categories) {
      const key = cat.category.toLowerCase().trim()
      if (!merged[key]) {
        merged[key] = { ...cat, branches: [branch.hotel_name], rooms: [...cat.rooms] }
      } else {
        merged[key].rooms = [...merged[key].rooms, ...cat.rooms]
        merged[key].free_count += cat.free_count
        merged[key].total_count += cat.total_count
        merged[key].branches.push(branch.hotel_name)
      }
    }
  }
  return Object.values(merged).sort((a, b) => a.category.localeCompare(b.category))
}

export default function RoomsPage() {
  const [selectedHotel, setSelectedHotel] = useState<string | 'all'>('all')
  const [openCat, setOpenCat]   = useState<string | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<{
    room: RoomEntry; catName: string; catSlug: string; branchName?: string; hotelId?: string
  } | null>(null)

  const { data: hotels = [], isLoading: hotelsLoading } = useQuery<Hotel[]>({
    queryKey: ['hotels'],
    queryFn: () => api.get('/hotels/').then(r => Array.isArray(r.data) ? r.data : (r.data?.results ?? [])),
    retry: 2, retryDelay: 3000,
  })

  // Query for each hotel individually
  const branchQueries = hotels.map(h => ({
    id: h.id,
    name: h.name,
    query: useQuery<BranchData>({
      queryKey: ['branch-rooms', h.id],
      queryFn: () => api.get(`/rooms/branch-availability/?hotel=${h.id}`).then(r => r.data),
      retry: 2, retryDelay: 4000,
    })
  }))

  const singleQuery = useQuery<BranchData>({
    queryKey: ['branch-rooms', selectedHotel],
    queryFn: () => api.get(`/rooms/branch-availability/?hotel=${selectedHotel}`).then(r => r.data),
    enabled: selectedHotel !== 'all' && !!selectedHotel,
    retry: 2, retryDelay: 4000,
  })

  // Compute what to display
  const displayData = useMemo(() => {
    if (selectedHotel === 'all') {
      const allBranches = branchQueries
        .filter(q => q.query.data)
        .map(q => q.query.data!)
      if (allBranches.length === 0) return null
      const merged = mergeCategories(allBranches)
      return {
        hotel_name: 'All Branches',
        branch: 'Combined',
        total_rooms: allBranches.reduce((a, b) => a + b.total_rooms, 0),
        free_rooms:  allBranches.reduce((a, b) => a + b.free_rooms, 0),
        categories: merged,
      } as BranchData
    }
    return singleQuery.data ?? null
  }, [selectedHotel, singleQuery.data, branchQueries.map(q => q.query.data).join(',')])

  const isLoading = selectedHotel === 'all'
    ? branchQueries.some(q => q.query.isLoading)
    : singleQuery.isLoading
  const isError = selectedHotel === 'all'
    ? branchQueries.every(q => q.query.isError)
    : singleQuery.isError
  const refetch = () => selectedHotel === 'all'
    ? branchQueries.forEach(q => q.query.refetch())
    : singleQuery.refetch()

  return (
    <div className="bg-enayi-bg min-h-screen">
      {/* Page header */}
      <div className="section-sm bg-enayi-surface border-b border-enayi-border text-center">
        <div className="container-site">
          <div className="badge-gold inline-flex mb-4">Room Directory</div>
          <h1 className="font-display text-4xl md:text-5xl text-enayi-text mb-4">Browse Rooms by Branch</h1>
          <div className="gold-line-center mb-5"/>
          <p className="text-enayi-muted text-lg max-w-xl mx-auto">
            Select a branch, expand a room category, then click any room number to see its photo and details.
          </p>
        </div>
      </div>

      <div className="container-site py-12">

        {/* Branch selector cards */}
        <div className="max-w-3xl mx-auto mb-12 text-center">
          <p className="text-enayi-gold font-bold text-sm uppercase tracking-[0.3em] mb-3">
            Step 1 — Choose Your Branch
          </p>
          <h2 className="font-display text-3xl text-white mb-6">Which Enayi Hotels location?</h2>

          {hotelsLoading ? (
            <div className="flex items-center justify-center gap-2 text-enayi-muted py-4">
              <Loader2 size={18} className="animate-spin"/> Loading branches...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* All Branches */}
              <button onClick={() => { setSelectedHotel('all'); setOpenCat(null); }}
                className={`p-5 rounded-2xl border-2 transition-all text-left
                  ${selectedHotel === 'all'
                    ? 'border-enayi-gold bg-enayi-gold/10'
                    : 'border-enayi-border hover:border-enayi-gold/40'}`}>
                <Building2 size={28} className={selectedHotel === 'all' ? 'text-enayi-gold' : 'text-enayi-muted'}/>
                <p className={`font-display text-xl mt-2 ${selectedHotel === 'all' ? 'text-enayi-gold' : 'text-enayi-text'}`}>
                  All Branches
                </p>
                <p className="text-enayi-muted text-sm mt-0.5">All rooms from both branches</p>
                {selectedHotel === 'all' && (
                  <span className="inline-flex items-center gap-1 mt-2 text-xs text-enayi-gold font-semibold">
                    <CheckCircle size={11}/> Selected
                  </span>
                )}
              </button>

              {hotels.map(h => (
                <button key={h.id} onClick={() => { setSelectedHotel(h.id); setOpenCat(null); }}
                  className={`p-5 rounded-2xl border-2 transition-all text-left
                    ${selectedHotel === h.id
                      ? 'border-enayi-gold bg-enayi-gold/10'
                      : 'border-enayi-border hover:border-enayi-gold/40'}`}>
                  <Building2 size={28} className={selectedHotel === h.id ? 'text-enayi-gold' : 'text-enayi-muted'}/>
                  <p className={`font-display text-xl mt-2 ${selectedHotel === h.id ? 'text-enayi-gold' : 'text-enayi-text'}`}>
                    {h.name.replace(/enayi hotels.*?—\s*/i,'').replace(/enayi hotels.*?-\s*/i,'')}
                  </p>
                  <p className="text-enayi-muted text-sm mt-0.5 capitalize">{h.branch} Branch</p>
                  {selectedHotel === h.id && (
                    <span className="inline-flex items-center gap-1 mt-2 text-xs text-enayi-gold font-semibold">
                      <CheckCircle size={11}/> Selected
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-16">
            <Loader2 size={36} className="animate-spin text-enayi-gold mx-auto mb-4"/>
            <p className="text-enayi-muted">Loading rooms...</p>
          </div>
        )}

        {/* Error */}
        {isError && !isLoading && (
          <div className="card border-rose-500/30 bg-rose-500/5 text-center py-12 max-w-sm mx-auto">
            <AlertCircle size={36} className="text-rose-400 mx-auto mb-4"/>
            <p className="text-rose-300 font-medium mb-2">Could not load rooms</p>
            <p className="text-enayi-muted text-sm mb-5">Server may still be starting. Try again.</p>
            <button onClick={refetch}
              className="inline-flex items-center gap-2 text-sm px-5 py-2.5
                         border border-enayi-gold text-enayi-gold rounded-xl hover:bg-enayi-gold/10 transition-colors">
              <RefreshCw size={14}/> Try Again
            </button>
          </div>
        )}

        {/* Room data */}
        {displayData && !isLoading && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="card-gold p-5 flex items-center justify-between flex-wrap gap-4 mb-6">
              <div>
                <h2 className="font-display text-2xl text-enayi-text">{displayData.hotel_name}</h2>
                <p className="text-enayi-muted text-sm mt-0.5 capitalize">{displayData.branch}</p>
              </div>
              <div className="flex gap-8">
                <div className="text-center">
                  <p className="font-display text-3xl text-emerald-400">{displayData.free_rooms}</p>
                  <p className="text-enayi-muted text-xs uppercase tracking-wider mt-0.5">Available</p>
                </div>
                <div className="text-center">
                  <p className="font-display text-3xl text-enayi-text">{displayData.total_rooms}</p>
                  <p className="text-enayi-muted text-xs uppercase tracking-wider mt-0.5">Total</p>
                </div>
              </div>
            </div>

            <p className="text-enayi-muted text-sm text-center mb-4">
              Step 2 — Click a category to expand, then click a room number to view its photo
            </p>

            {displayData.categories.length === 0 && (
              <div className="card text-center py-12">
                <BedDouble size={36} className="text-enayi-gold/30 mx-auto mb-3"/>
                <p className="text-enayi-muted">No rooms found yet.</p>
              </div>
            )}

            {displayData.categories.map(cat => (
              <div key={cat.category_slug + cat.category} className="card overflow-hidden">
                <button
                  onClick={() => setOpenCat(openCat === cat.category_slug ? null : cat.category_slug)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-white/3 transition-colors text-left">
                  <div className="w-20 h-14 rounded-xl overflow-hidden shrink-0 border border-enayi-gold/20">
                    <img src={getRoomImage(cat.category_slug, cat.category)}
                         alt={cat.category} className="w-full h-full object-cover"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-enayi-text font-semibold text-base">{cat.category}</p>
                    <p className="text-enayi-muted text-xs mt-0.5">{cat.total_count} rooms total</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold text-xl">{cat.free_count}</span>
                      <span className="text-enayi-muted text-sm"> / {cat.total_count} free</span>
                    </div>
                    <ChevronDown size={16} className={`text-enayi-muted transition-transform duration-200
                      ${openCat === cat.category_slug ? 'rotate-180' : ''}`}/>
                  </div>
                </button>

                <AnimatePresence>
                  {openCat === cat.category_slug && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                      className="overflow-hidden border-t border-enayi-border">
                      <div className="p-5">
                        {/* Category image */}
                        <div className="relative rounded-xl overflow-hidden mb-5 aspect-video max-h-52">
                          <img src={getRoomImage(cat.category_slug, cat.category)}
                               alt={cat.category} className="w-full h-full object-cover"/>
                          <div className="absolute inset-0 bg-gradient-to-t from-enayi-bg/80 via-transparent to-transparent"/>
                          <div className="absolute bottom-3 left-4">
                            <p className="text-enayi-gold text-xs font-semibold uppercase tracking-widest">{cat.category}</p>
                            <p className="text-white/70 text-xs">Click a room number to see details</p>
                          </div>
                        </div>

                        <p className="text-enayi-muted text-xs uppercase tracking-widest mb-3 font-semibold">
                          Room Numbers — click to view
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 mb-5">
                          {cat.rooms.map(room => (
                            <motion.button key={room.id}
                              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                              onClick={() => setSelectedRoom({
                                room, catName: cat.category, catSlug: cat.category_slug,
                                hotelId: selectedHotel !== 'all' ? selectedHotel : undefined
                              })}
                              className={`rounded-xl border p-3 text-center transition-all cursor-pointer
                                ${STATUS_STYLE[room.status] ?? STATUS_STYLE.occupied}
                                hover:ring-2 hover:ring-enayi-gold/50`}>
                              <div className="flex items-center justify-center gap-1 mb-1">
                                {room.is_available ? <CheckCircle size={11}/> : <XCircle size={11}/>}
                                <span className="font-mono font-bold text-sm">{room.room_number}</span>
                              </div>
                              <p className="text-xs opacity-65">Fl. {room.floor}</p>
                            </motion.button>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-2 pt-4 border-t border-enayi-border">
                          {Object.entries({
                            available: 'Available', occupied: 'Occupied',
                            reserved: 'Reserved', maintenance: 'Maintenance', cleaning: 'Cleaning',
                          }).map(([s, l]) => (
                            <span key={s} className={`inline-flex items-center gap-1 text-xs
                              px-2.5 py-1 rounded-full border ${STATUS_STYLE[s] ?? ''}`}>{l}</span>
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

      <AnimatePresence>
        {selectedRoom && (
          <RoomModal room={selectedRoom.room} catName={selectedRoom.catName}
            catSlug={selectedRoom.catSlug} branchName={selectedRoom.branchName}
            hotelId={selectedRoom.hotelId}
            onClose={() => setSelectedRoom(null)}/>
        )}
      </AnimatePresence>
    </div>
  )
}
