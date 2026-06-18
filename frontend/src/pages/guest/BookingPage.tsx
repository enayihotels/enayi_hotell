import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { BedDouble, Users, Coffee, Car, Clock, ArrowRight, Loader2, Maximize2, MapPin, ImageIcon, Check, X, ChevronDown } from 'lucide-react'
import api from '@/utils/api'
import { formatCurrency, today, tomorrow } from '@/utils/helpers'
import { useCreateBooking } from '@/hooks/useBooking'
import type { RoomCategory } from '@/types'

// ── Branch-aware shapes (returned by the API, typed locally) ────────────────
interface BranchPrice {
  hotel: string; branch: string; branch_name: string
  base_price: string; current_price: string
  breakfast_price: string; current_price_with_breakfast: string
}
type Cat = RoomCategory & { branch_prices?: BranchPrice[] }
interface HotelLite { id: string; name: string; branch: string; is_primary: boolean }
interface RoomNo { room_number: string; floor: number; status: string; is_occupied: boolean; label: string }
interface BranchClassAvail { category: string; category_slug: string; rooms: RoomNo[]; free_count: number; total_count: number }

const listOf = <T,>(d: any): T[] => (Array.isArray(d) ? d : (d?.results ?? []))
const stripBrand = (s?: string) => s?.replace('Enayi Hotels & Suites — ', '') || ''

export default function BookingPage() {
  const { slug } = useParams()

  const { data: hotels } = useQuery<HotelLite[]>({
    queryKey: ['hotels'],
    queryFn: () => api.get('/hotels/').then(r => listOf<HotelLite>(r.data)),
  })
  const { data: rooms } = useQuery<Cat[]>({
    queryKey: ['rooms'],
    queryFn: () => api.get('/rooms/categories/').then(r => listOf<Cat>(r.data)),
  })
  const { data: roomFromSlug } = useQuery<Cat>({
    queryKey: ['room', slug],
    queryFn: () => api.get(`/rooms/categories/${slug}/`).then(r => r.data),
    enabled: !!slug,
  })

  const [branchId, setBranchId] = useState<string>('')
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)
  const createBooking = useCreateBooking()

  // Default to the flagship (or first) branch once hotels load.
  useEffect(() => {
    if (!branchId && hotels?.length) {
      setBranchId((hotels.find(h => h.is_primary) ?? hotels[0]).id)
    }
  }, [hotels, branchId])

  // If we arrived via /book/:slug, pre-expand that class.
  useEffect(() => {
    if (roomFromSlug && expandedSlug === null) setExpandedSlug(roomFromSlug.slug)
  }, [roomFromSlug, expandedSlug])

  const { register, handleSubmit, watch } = useForm({
    defaultValues: { check_in: today(), check_out: tomorrow(), adults: 1, children: 0, special_requests: '', breakfast_included: false, airport_pickup: false, late_checkout: false, early_checkin: false },
  })
  const f = watch()
  const nights = f.check_in && f.check_out ? Math.max((new Date(f.check_out).getTime() - new Date(f.check_in).getTime()) / 86400000, 0) : 0

  // Live availability for the chosen branch — one call returns every class.
  const { data: branchAvail } = useQuery<BranchClassAvail[]>({
    queryKey: ['branch-avail-all', branchId],
    queryFn: () => api.get(`/rooms/branch-availability/?hotel=${branchId}`).then(r => (r.data?.classes ?? []) as BranchClassAvail[]),
    enabled: !!branchId,
  })
  const availBySlug: Record<string, BranchClassAvail> = Object.fromEntries((branchAvail ?? []).map(c => [c.category_slug, c]))
  const totalFree = (branchAvail ?? []).reduce((s, c) => s + c.free_count, 0)
  const totalAll  = (branchAvail ?? []).reduce((s, c) => s + c.total_count, 0)

  // Classes offered at this branch (fall back to all if branch_prices is empty).
  const offered = (rooms ?? []).filter(c => c.branch_prices?.some(bp => bp.hotel === branchId))
  const classList = offered.length ? offered : (rooms ?? [])

  // The expanded class is the one being booked.
  const selectedCat: Cat | undefined = classList.find(c => c.slug === expandedSlug) || roomFromSlug
  const bp = selectedCat?.branch_prices?.find(p => p.hotel === branchId)
  const price = Number(bp?.current_price ?? selectedCat?.current_price ?? selectedCat?.base_price ?? 0)
  const breakfastPerNight = Number(bp?.breakfast_price ?? 3500)
  const subtotal = price * nights
  const addons =
    (f.breakfast_included ? breakfastPerNight * nights : 0) +
    (f.airport_pickup ? 8000 : 0) +
    (f.early_checkin ? 5000 : 0) +
    (f.late_checkout ? 5000 : 0)
  const total = subtotal + addons

  const branch = hotels?.find(h => h.id === branchId)

  const onSubmit = (data: any) => {
    if (!selectedCat?.id || !branchId) return
    createBooking.mutate({ ...data, category_id: selectedCat.id, hotel_id: branchId, adults: Number(data.adults), children: Number(data.children) })
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
                    onClick={() => { setBranchId(h.id); if (!slug) setExpandedSlug(null) }}
                    className={`card p-4 text-left transition-all ${branchId === h.id ? 'border-enayi-gold bg-enayi-gold/5' : 'hover:border-enayi-gold/30'}`}>
                    <div className="font-semibold text-enayi-text text-sm">{stripBrand(h.name) || h.branch}</div>
                    <div className="text-xs text-enayi-muted mt-0.5 capitalize">{h.branch} branch</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Branch totals header (same look as the rooms page) */}
            {branch && (
              <div className="card p-5 flex items-center justify-between">
                <div>
                  <div className="font-display text-2xl text-enayi-text">{stripBrand(branch.name) || branch.branch}</div>
                  <div className="text-enayi-muted text-sm capitalize">{branch.branch} branch</div>
                </div>
                <div className="flex gap-8 text-right">
                  <div>
                    <div className="font-display text-3xl text-green-400">{totalFree}</div>
                    <div className="text-enayi-muted text-xs uppercase tracking-wide">Available</div>
                  </div>
                  <div>
                    <div className="font-display text-3xl text-enayi-text">{totalAll}</div>
                    <div className="text-enayi-muted text-xs uppercase tracking-wide">Total</div>
                  </div>
                </div>
              </div>
            )}

            {/* Step hint */}
            {classList.length > 0 && (
              <p className="text-center text-enayi-muted text-sm">
                Step 2 — Click a category to expand &amp; select, then review the room numbers
              </p>
            )}

            {/* Expandable class list (matches the rooms page look) */}
            <div className="space-y-3">
              {classList.map(r => {
                const ra = availBySlug[r.slug]
                const rprice = Number(r.branch_prices?.find(p => p.hotel === branchId)?.current_price ?? r.current_price ?? r.base_price)
                const thumb = r.images?.find(i => i.is_primary)?.image_url || r.images?.[0]?.image_url
                const isExpanded = expandedSlug === r.slug
                return (
                  <div key={r.id} className={`card overflow-hidden transition-all ${isExpanded ? 'border-enayi-gold' : ''}`}>
                    <button type="button" onClick={() => setExpandedSlug(isExpanded ? null : r.slug)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-enayi-panel/40 transition-colors text-left">
                      <div className="w-20 h-14 rounded-lg overflow-hidden bg-enayi-panel flex-shrink-0">
                        {thumb ? <img src={thumb} alt={r.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-enayi-muted"><ImageIcon size={18}/></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-enayi-text">{r.name}</div>
                        <div className="text-xs text-enayi-muted">{ra ? `${ra.total_count} rooms total` : '—'}</div>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="text-enayi-gold font-semibold">{formatCurrency(rprice)}</div>
                        <div className="text-xs text-enayi-muted">per night</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {ra && (
                          <div className="text-right whitespace-nowrap">
                            <span className="font-display text-2xl text-green-400">{ra.free_count}</span>
                            <span className="text-enayi-muted text-sm"> / {ra.total_count} free</span>
                          </div>
                        )}
                        <ChevronDown size={18} className={`text-enayi-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}/>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-enayi-border overflow-hidden"
                        >
                          <div className="p-5">
                            <div className="grid md:grid-cols-[2fr_3fr] gap-4 mb-4">
                              <div className="aspect-[4/3] rounded-xl overflow-hidden bg-enayi-panel">
                                {thumb ? <img src={thumb} alt={r.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-enayi-muted"><ImageIcon size={32}/></div>}
                              </div>
                              <div>
                                {r.description && <p className="text-enayi-muted text-sm mb-3">{r.description}</p>}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-enayi-muted mb-3">
                                  <span className="flex items-center gap-1"><BedDouble size={12} className="text-enayi-gold"/>{r.bed_type}</span>
                                  <span className="flex items-center gap-1"><Maximize2 size={12} className="text-enayi-gold"/>{r.room_size_sqm}m²</span>
                                  <span className="flex items-center gap-1"><Users size={12} className="text-enayi-gold"/>{r.max_adults} adults · {r.max_children} children</span>
                                </div>
                                <div className="text-enayi-gold font-display text-xl md:hidden">{formatCurrency(rprice)}<span className="text-enayi-muted text-xs font-normal">/night</span></div>
                              </div>
                            </div>

                            <div>
                              <div className="text-sm text-enayi-text mb-2 font-medium">Rooms in this class at {stripBrand(branch?.name) || branch?.branch}</div>
                              {!ra ? <div className="text-enayi-muted text-xs">Loading…</div> : ra.rooms.length === 0 ? (
                                <div className="text-enayi-muted text-xs">No rooms listed for this class yet.</div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {ra.rooms.map(rm => (
                                    <span key={rm.room_number}
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border ${rm.is_occupied
                                        ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                        : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>
                                      {rm.is_occupied ? <X size={11}/> : <Check size={11}/>}
                                      {rm.room_number} · {rm.label}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {ra && ra.rooms.length > 0 && (
                                <p className="text-enayi-muted text-xs mt-2">A free room is assigned automatically when you confirm the booking.</p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

            {/* Dates */}
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
              {selectedCat && branch ? (
                <>
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between"><span className="text-enayi-muted">Branch</span><span className="text-enayi-text">{stripBrand(branch.name) || branch.branch}</span></div>
                    <div className="flex justify-between"><span className="text-enayi-muted">{selectedCat.name}</span><span className="text-enayi-text">{formatCurrency(price)}/night</span></div>
                    <div className="flex justify-between"><span className="text-enayi-muted">Nights</span><span className="text-enayi-text">{nights}</span></div>
                    <div className="flex justify-between"><span className="text-enayi-muted">Room subtotal</span><span className="text-enayi-text">{formatCurrency(subtotal)}</span></div>
                    {addons > 0 && <div className="flex justify-between"><span className="text-enayi-muted">Add-ons</span><span className="text-enayi-text">{formatCurrency(addons)}</span></div>}
                    <div className="border-t border-enayi-border pt-2 flex justify-between font-semibold"><span className="text-enayi-text">Total</span><span className="text-enayi-gold font-display text-xl">{formatCurrency(total)}</span></div>
                  </div>
                  <button type="submit" disabled={createBooking.isPending || !selectedCat?.id || !branchId || nights <= 0} className="btn-gold w-full gap-2">
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
