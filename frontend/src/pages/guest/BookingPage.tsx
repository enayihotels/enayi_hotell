import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { BedDouble, Users, Coffee, Car, Clock, ArrowRight, Loader2, Maximize2, MapPin, CheckCircle, XCircle, ChevronDown } from 'lucide-react'
import api from '@/utils/api'
import { formatCurrency, today, tomorrow } from '@/utils/helpers'
import { useCreateBooking } from '@/hooks/useBooking'
import type { RoomCategory } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────
interface BranchPrice {
  hotel: string; branch: string; branch_name: string
  base_price: string; current_price: string
  breakfast_price: string; current_price_with_breakfast: string
}
type Cat = RoomCategory & { branch_prices?: BranchPrice[] }
interface HotelLite { id: string; name: string; branch: string; is_primary: boolean }

// Shape returned by GET /rooms/branch-availability/?hotel=<id> on the live backend
interface RoomEntry {
  id: string
  room_number: string
  floor: number
  status: string
  view_type?: string
  has_balcony?: boolean
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

// Status colors — matches the rooms page exactly
const STATUS_STYLE: Record<string, string> = {
  available:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  occupied:    'bg-rose-500/15   text-rose-400   border-rose-500/30',
  reserved:    'bg-amber-500/15  text-amber-400  border-amber-500/30',
  maintenance: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  cleaning:    'bg-blue-500/15   text-blue-400   border-blue-500/30',
}

// Image resolver — matches the rooms page exactly
function getRoomImage(slug: string, name: string): string {
  const s = (slug + ' ' + name).toLowerCase()
  if (s.includes('presidential'))                               return '/rooms/presidential.jpg'
  if (s.includes('honeymoon'))                                  return '/rooms/honeymoon-suite.jpg'
  if (s.includes('suite'))                                      return '/rooms/suite.jpg'
  if (s.includes('executive') || s.includes('exec'))            return '/rooms/executive-deluxe.jpg'
  if (s.includes('classic plus') || s.includes('classic-plus')) return '/rooms/classic-plus.jpg'
  if (s.includes('deluxe'))                                     return '/rooms/deluxe-room.jpg'
  if (s.includes('classic'))                                    return '/rooms/classic-room.jpg'
  if (s.includes('superior'))                                   return '/rooms/superior-room.jpg'
  if (s.includes('family'))                                     return '/rooms/family-room.jpg'
  if (s.includes('single'))                                     return '/rooms/single-room.jpg'
  if (s.includes('standard'))                                   return '/rooms/standard-room.jpg'
  return '/rooms/standard-room.jpg'
}

const list = <T,>(d: any): T[] => (Array.isArray(d) ? d : (d?.results ?? []))

function cleanCatName(name: string): string {
  return name
    .replace(/zaramaganda/gi, '')
    .replace(/fwawei/gi, '')
    .replace(/fwavei/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-\s]+|[-\s]+$/g, '')
}

export default function BookingPage() {
  const { slug } = useParams()
  const urlHotel = new URLSearchParams(window.location.search).get('hotel') ?? ''

  const { data: hotels } = useQuery<HotelLite[]>({
    queryKey: ['hotels'],
    queryFn: () => api.get('/hotels/').then(r => list<HotelLite>(r.data)),
  })
  const { data: rooms } = useQuery<Cat[]>({
    queryKey: ['rooms'],
    queryFn: () => api.get('/rooms/categories/').then(r => list<Cat>(r.data)),
  })
  const { data: room } = useQuery<Cat>({
    queryKey: ['room', slug],
    queryFn: () => api.get(`/rooms/categories/${slug}/`).then(r => r.data),
    enabled: !!slug,
  })

  const [branchId, setBranchId] = useState<string>('')
  const [selectedCat, setSelectedCat] = useState<string>('')
  const createBooking = useCreateBooking()

  // Pre-select branch from URL param, else default to flagship / first
  useEffect(() => {
    if (urlHotel && hotels?.some(h => h.id === urlHotel)) {
      setBranchId(urlHotel)
    } else if (!branchId && hotels?.length) {
      setBranchId((hotels.find(h => h.is_primary) ?? hotels[0]).id)
    }
  }, [hotels, branchId, urlHotel])

  // Pre-select (and expand) when arriving via /book/:slug
  useEffect(() => {
    if (room && !selectedCat) setSelectedCat(room.id)
  }, [room, selectedCat])

  const { register, handleSubmit, watch } = useForm({
    defaultValues: { check_in: today(), check_out: tomorrow(), adults: 1, children: 0, special_requests: '', breakfast_included: false, airport_pickup: false, late_checkout: false, early_checkin: false },
  })
  const f = watch()
  const nights = f.check_in && f.check_out ? Math.max((new Date(f.check_out).getTime() - new Date(f.check_in).getTime()) / 86400000, 0) : 0

  const cleanName = (name: string) => cleanCatName(name)
  const selectedHotel = (hotels ?? []).find(h => h.id === branchId)
  const branchName = selectedHotel?.name?.toLowerCase() ?? ''
  const branchSlug = selectedHotel?.branch?.toLowerCase() ?? ''

  // Production branch-filter logic
  const offered = (rooms ?? []).filter(c => {
    if (c.branch_prices?.some((bp: any) => bp.hotel === branchId)) return true
    if (c.branch_prices?.length > 0) return false
    const nameLower = c.name.toLowerCase()
    const hasZara  = nameLower.includes('zaramaganda')
    const hasFwav  = nameLower.includes('fwawei') || nameLower.includes('fwavei')
    if (hasZara && !hasFwav) return branchSlug.includes('zaramaganda') || branchName.includes('zaramaganda')
    if (hasFwav && !hasZara) return branchSlug.includes('fwawei') || branchName.includes('fwawei') || branchSlug.includes('fwavei')
    return true
  })
  const rawList = offered.length ? offered : (rooms ?? [])
  const seen = new Set<string>()
  const classList = rawList.filter(r => {
    const key = cleanName(r.name).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const catId = room?.id || selectedCat
  const selectedRoom: Cat | undefined = room || classList.find(r => r.id === catId)

  // Resolve the CORRECT category ID for the selected branch
  const resolvedCatId = (() => {
    if (!selectedRoom || !branchId) return catId
    const selClean = cleanName(selectedRoom.name).toLowerCase()
    const all = rooms ?? []
    const branchMatch = all.find(c =>
      cleanName(c.name).toLowerCase() === selClean &&
      c.branch_prices?.some((bp: any) => bp.hotel === branchId)
    )
    if (branchMatch) return branchMatch.id
    const bslug = branchSlug
    const nameMatch = all.find(c =>
      cleanName(c.name).toLowerCase() === selClean &&
      (c.name.toLowerCase().includes(bslug) ||
       c.name.toLowerCase().includes('fwawei') === bslug.includes('fwawei') ||
       c.name.toLowerCase().includes('zaramaganda') === bslug.includes('zaramaganda'))
    )
    if (nameMatch) return nameMatch.id
    return catId
  })()

  const bp = selectedRoom?.branch_prices?.find(p => p.hotel === branchId)
  const price = Number(bp?.current_price ?? selectedRoom?.current_price ?? selectedRoom?.base_price ?? 0)
  const breakfastPerNight = Number(bp?.breakfast_price ?? 3500)
  const subtotal = price * nights
  const addons =
    (f.breakfast_included ? breakfastPerNight * nights : 0) +
    (f.airport_pickup ? 8000 : 0) +
    (f.early_checkin ? 5000 : 0) +
    (f.late_checkout ? 5000 : 0)
  const total = subtotal + addons

  const branch = hotels?.find(h => h.id === branchId)
  const branchLabel = (h?: HotelLite) => h?.name?.replace('Enayi Hotels & Suites — ', '') || h?.branch || ''

  // Same endpoint as the live rooms page — returns BranchData with categories[]
  const { data: branchAvail } = useQuery<BranchData>({
    queryKey: ['branch-rooms', branchId],
    queryFn: () => api.get(`/rooms/branch-availability/?hotel=${branchId}`).then(r => r.data as BranchData),
    enabled: !!branchId, retry: 2, retryDelay: 4000,
  })

  // Map availability by clean name (so dedup'd classes match)
  const availByCleanName: Record<string, CategoryGroup> = {}
  for (const a of (branchAvail?.categories ?? [])) {
    const key = cleanName(a.category).toLowerCase()
    if (availByCleanName[key]) {
      availByCleanName[key] = {
        ...availByCleanName[key],
        rooms: [...availByCleanName[key].rooms, ...a.rooms],
        free_count: availByCleanName[key].free_count + a.free_count,
        total_count: availByCleanName[key].total_count + a.total_count,
      }
    } else {
      availByCleanName[key] = { ...a, rooms: [...a.rooms] }
    }
  }
  const totalFree = branchAvail?.free_rooms ?? 0
  const totalAll  = branchAvail?.total_rooms ?? 0

  const onSubmit = (data: any) => {
    if (!catId || !branchId) return
    createBooking.mutate({ ...data, category_id: resolvedCatId, hotel_id: branchId, adults: Number(data.adults), children: Number(data.children) })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-enayi-text mb-1">Book a Room</h1>
        <p className="text-enayi-muted text-sm">Enayi Hotels & Suites · Jos, Plateau State</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">

            {/* Branch picker */}
            <div className="card p-5">
              <h2 className="font-heading text-lg text-enayi-text mb-4 flex items-center gap-2"><MapPin size={18} className="text-enayi-gold"/>Choose Branch</h2>
              <div className="grid grid-cols-2 gap-3">
                {(hotels ?? []).map(h => (
                  <button key={h.id} type="button"
                    onClick={() => { setBranchId(h.id); if (!slug) setSelectedCat('') }}
                    className={`card p-4 text-left transition-all ${branchId === h.id ? 'border-enayi-gold bg-enayi-gold/5' : 'hover:border-enayi-gold/30'}`}>
                    <div className="font-semibold text-enayi-text text-sm">{branchLabel(h)}</div>
                    <div className="text-xs text-enayi-muted mt-0.5 capitalize">{h.branch} branch</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Branch totals (matches rooms page summary bar) */}
            {branch && (
              <div className="card-gold p-5 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="font-display text-2xl text-enayi-text">{branchLabel(branch)}</h2>
                  <p className="text-enayi-muted text-sm mt-0.5 capitalize">{branch.branch} branch</p>
                </div>
                <div className="flex gap-8">
                  <div className="text-center">
                    <p className="font-display text-3xl text-emerald-400">{totalFree}</p>
                    <p className="text-enayi-muted text-xs uppercase tracking-wider mt-0.5">Available</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-3xl text-enayi-text">{totalAll}</p>
                    <p className="text-enayi-muted text-xs uppercase tracking-wider mt-0.5">Total</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step hint */}
            {!slug && classList.length > 0 && (
              <p className="text-enayi-muted text-sm text-center">
                Step 2 — Click a category to expand &amp; select, then review the room numbers
              </p>
            )}

            {/* Expandable class list */}
            <div className="space-y-3">
              {classList.map(r => {
                const ra = availByCleanName[cleanName(r.name).toLowerCase()]
                const rp = r.branch_prices?.find(p => p.hotel === branchId)
                const rprice = Number(rp?.current_price ?? r.current_price ?? r.base_price)
                const thumb = r.images?.find(i => i.is_primary)?.image_url || r.images?.[0]?.image_url || getRoomImage(r.slug, r.name)
                const isExpanded = catId === r.id
                const displayName = cleanCatName(r.name)
                return (
                  <div key={r.id} className={`card overflow-hidden transition-all ${isExpanded ? 'border-enayi-gold' : ''}`}>
                    <button type="button"
                      onClick={() => setSelectedCat(prev => prev === r.id ? '' : r.id)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors text-left">
                      <div className="w-20 h-14 rounded-xl overflow-hidden shrink-0 border border-enayi-gold/20">
                        <img src={thumb} alt={displayName} className="w-full h-full object-cover"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-enayi-text font-semibold text-base">{displayName}</p>
                        <p className="text-enayi-muted text-xs mt-0.5">{ra ? `${ra.total_count} rooms total` : '—'}</p>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="text-enayi-gold font-semibold">{formatCurrency(rprice)}</div>
                        <div className="text-xs text-enayi-muted">per night</div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        {ra && (
                          <div className="text-right whitespace-nowrap">
                            <span className="text-emerald-400 font-bold text-xl">{ra.free_count}</span>
                            <span className="text-enayi-muted text-sm"> / {ra.total_count} free</span>
                          </div>
                        )}
                        <ChevronDown size={16} className={`text-enayi-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}/>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden border-t border-enayi-border"
                        >
                          <div className="p-5">
                            {/* Hero image (same as rooms page) */}
                            <div className="relative rounded-xl overflow-hidden mb-5 aspect-video max-h-52">
                              <img src={thumb} alt={displayName} className="w-full h-full object-cover"/>
                              <div className="absolute inset-0 bg-gradient-to-t from-enayi-bg/80 via-transparent to-transparent"/>
                              <div className="absolute bottom-3 left-4">
                                <p className="text-enayi-gold text-xs font-semibold uppercase tracking-widest">{displayName}</p>
                                <p className="text-white/70 text-xs">{formatCurrency(rprice)} per night</p>
                              </div>
                            </div>

                            {/* Booking-specific class details */}
                            {(r.description || r.bed_type || r.room_size_sqm) && (
                              <div className="mb-5">
                                {r.description && <p className="text-enayi-muted text-sm mb-3">{r.description}</p>}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-enayi-muted">
                                  {r.bed_type && <span className="flex items-center gap-1"><BedDouble size={12} className="text-enayi-gold"/>{r.bed_type}</span>}
                                  {r.room_size_sqm && <span className="flex items-center gap-1"><Maximize2 size={12} className="text-enayi-gold"/>{r.room_size_sqm}m²</span>}
                                  <span className="flex items-center gap-1"><Users size={12} className="text-enayi-gold"/>{r.max_adults} adults · {r.max_children} children</span>
                                </div>
                              </div>
                            )}

                            {/* Room numbers — same look as rooms page */}
                            <p className="text-enayi-muted text-xs uppercase tracking-widest mb-3 font-semibold">
                              Room Numbers at {branchLabel(branch)}
                            </p>
                            {!ra ? (
                              <div className="text-enayi-muted text-xs">Loading…</div>
                            ) : ra.rooms.length === 0 ? (
                              <div className="text-enayi-muted text-xs">No rooms listed for this class yet.</div>
                            ) : (
                              <>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 mb-5">
                                  {ra.rooms.map(rm => (
                                    <div key={rm.id}
                                      className={`rounded-xl border p-3 text-center transition-all
                                        ${STATUS_STYLE[rm.status] ?? STATUS_STYLE.occupied}`}>
                                      <div className="flex items-center justify-center gap-1 mb-1">
                                        {rm.is_available ? <CheckCircle size={11}/> : <XCircle size={11}/>}
                                        <span className="font-mono font-bold text-sm">{rm.room_number}</span>
                                      </div>
                                      <p className="text-xs opacity-65">Fl. {rm.floor}</p>
                                    </div>
                                  ))}
                                </div>

                                {/* Status legend — same as rooms page */}
                                <div className="flex flex-wrap gap-2 pt-4 border-t border-enayi-border mb-3">
                                  {Object.entries({
                                    available: 'Available', occupied: 'Occupied',
                                    reserved: 'Reserved', maintenance: 'Maintenance', cleaning: 'Cleaning',
                                  }).map(([s, l]) => (
                                    <span key={s} className={`inline-flex items-center gap-1 text-xs
                                      px-2.5 py-1 rounded-full border ${STATUS_STYLE[s] ?? ''}`}>{l}</span>
                                  ))}
                                </div>

                                <p className="text-enayi-muted text-xs">
                                  {ra.free_count} of {ra.total_count} free · a free room is assigned automatically when you confirm the booking.
                                </p>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

            {/* Stay Details */}
            <div className="card p-5">
              <h2 className="font-heading text-lg text-enayi-text mb-4">Stay Details</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="form-group"><label className="label">Check-in Date</label><input {...register('check_in', { required: true })} type="date" className="input" min={today()}/></div>
                <div className="form-group"><label className="label">Check-out Date</label><input {...register('check_out', { required: true })} type="date" className="input" min={tomorrow()}/></div>
                <div className="form-group"><label className="label">Adults</label><select {...register('adults')} className="input">{[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                <div className="form-group"><label className="label">Children</label><select {...register('children')} className="input">{[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
              </div>
              <div className="form-group"><label className="label">Special Requests</label><textarea {...register('special_requests')} className="input" rows={3} placeholder="Any dietary requirements, room preferences, etc."/></div>
            </div>

            {/* Add-ons */}
            <div className="card p-5">
              <h2 className="font-heading text-lg text-enayi-text mb-4">Add-ons</h2>
              <div className="space-y-3">
                {[{ name: 'breakfast_included', icon: Coffee, label: 'Breakfast Included', price: `${formatCurrency(breakfastPerNight)}/night` },
                  { name: 'airport_pickup', icon: Car, label: 'Airport Pickup', price: '₦8,000' },
                  { name: 'early_checkin', icon: Clock, label: 'Early Check-in (before 2pm)', price: '₦5,000' },
                  { name: 'late_checkout', icon: Clock, label: 'Late Check-out (after 12pm)', price: '₦5,000' }].map(({ name, icon: Icon, label, price: p }) => (
                  <label key={name} className="flex items-center gap-3 p-3 rounded-xl card cursor-pointer hover:border-enayi-gold/20 transition-all">
                    <input {...register(name as any)} type="checkbox" className="w-4 h-4 accent-enayi-gold"/>
                    <Icon size={16} className="text-enayi-gold"/>
                    <span className="text-enayi-text text-sm flex-1">{label}</span>
                    <span className="text-enayi-muted text-xs">{p}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Summary — no VAT */}
          <div>
            <div className="card-gold p-5 rounded-2xl sticky top-4">
              <h2 className="font-heading text-lg text-enayi-text mb-4">Booking Summary</h2>
              {selectedRoom && branch ? (
                <>
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between"><span className="text-enayi-muted">Branch</span><span className="text-enayi-text">{branchLabel(branch)}</span></div>
                    <div className="flex justify-between"><span className="text-enayi-muted">{cleanCatName(selectedRoom.name)}</span><span className="text-enayi-text">{formatCurrency(price)}/night</span></div>
                    <div className="flex justify-between"><span className="text-enayi-muted">Nights</span><span className="text-enayi-text">{nights}</span></div>
                    <div className="flex justify-between"><span className="text-enayi-muted">Room subtotal</span><span className="text-enayi-text">{formatCurrency(subtotal)}</span></div>
                    {addons > 0 && <div className="flex justify-between"><span className="text-enayi-muted">Add-ons</span><span className="text-enayi-text">{formatCurrency(addons)}</span></div>}
                    <div className="border-t border-enayi-border pt-2 flex justify-between font-semibold"><span className="text-enayi-text">Total</span><span className="text-enayi-gold font-display text-xl">{formatCurrency(total)}</span></div>
                  </div>
                  <button type="submit" disabled={createBooking.isPending || !catId || !branchId || nights <= 0} className="btn-gold w-full gap-2">
                    {createBooking.isPending ? <><Loader2 size={15} className="animate-spin"/>Processing…</> : <>Confirm Booking <ArrowRight size={15}/></>}
                  </button>
                  <p className="text-center text-enayi-muted text-xs mt-3">No VAT — you pay the rate shown. You'll be redirected to payment.</p>
                </>
              ) : <p className="text-enayi-muted text-sm text-center py-6">Choose a branch and expand a room class to see pricing.</p>}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
