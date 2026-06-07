import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { BedDouble, Users, Coffee, Car, Clock, ArrowRight, Loader2, Star, Maximize2, MapPin, ImageIcon, Check, X } from 'lucide-react'
import api from '@/utils/api'
import { formatCurrency, today, tomorrow } from '@/utils/helpers'
import { useCreateBooking } from '@/hooks/useBooking'
import type { RoomCategory } from '@/types'

// ── Branch-aware shapes (returned by the API, typed locally) ────────────────
interface BranchPrice {
  hotel: string
  branch: string
  branch_name: string
  base_price: string
  current_price: string
  breakfast_price: string
  current_price_with_breakfast: string
}
type Cat = RoomCategory & { branch_prices?: BranchPrice[] }
interface HotelLite { id: string; name: string; branch: string; is_primary: boolean }
interface RoomNo { room_number: string; floor: number; status: string; is_occupied: boolean; label: string }

const list = <T,>(d: any): T[] => (Array.isArray(d) ? d : (d?.results ?? []))

// Strip branch names from category display
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
  // Read hotel from URL query param e.g. /book/standard-room?hotel=<uuid>
  const urlHotel = new URLSearchParams(window.location.search).get('hotel') ?? 

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

  // Pre-select branch from URL param, else default to flagship/first branch.
  useEffect(() => {
    if (urlHotel && hotels?.some(h => h.id === urlHotel)) {
      setBranchId(urlHotel)
    } else if (!branchId && hotels?.length) {
      setBranchId((hotels.find(h => h.is_primary) ?? hotels[0]).id)
    }
  }, [hotels, branchId, urlHotel])

  const { register, handleSubmit, watch } = useForm({
    defaultValues: { check_in: today(), check_out: tomorrow(), adults: 1, children: 0, special_requests: '', breakfast_included: false, airport_pickup: false, late_checkout: false, early_checkin: false },
  })
  const f = watch()
  const nights = f.check_in && f.check_out ? Math.max((new Date(f.check_out).getTime() - new Date(f.check_in).getTime()) / 86400000, 0) : 0

  // Strip branch words from category name for clean display
  const cleanName = (name: string) =>
    name.replace(/zaramaganda/gi,'').replace(/fwawei/gi,'').replace(/fwavei/gi,'')
        .replace(/\s+/g,' ').trim().replace(/^[-\s]+|[-\s]+$/g,'')

  // Filter categories for selected branch:
  // 1. Try branch_prices match first
  // 2. If no branch_prices set, use room name to guess branch
  //    (e.g. "STANDARD ROOM ZARAMAGANDA" only shows for Zaramaganda branch)
  const selectedHotel = (hotels ?? []).find(h => h.id === branchId)
  const branchName = selectedHotel?.name?.toLowerCase() ?? ''
  const branchSlug = selectedHotel?.branch?.toLowerCase() ?? ''

  const offered = (rooms ?? []).filter(c => {
    // Has explicit branch price for this branch -> show it
    if (c.branch_prices?.some((bp: any) => bp.hotel === branchId)) return true
    // Has branch prices but none for this branch -> don't show
    if (c.branch_prices?.length > 0) return false
    // No branch prices at all: filter by name
    const nameLower = c.name.toLowerCase()
    const hasZara  = nameLower.includes('zaramaganda')
    const hasFwav  = nameLower.includes('fwawei') || nameLower.includes('fwavei')
    if (hasZara && !hasFwav) return branchSlug.includes('zaramaganda') || branchName.includes('zaramaganda')
    if (hasFwav && !hasZara) return branchSlug.includes('fwawei') || branchName.includes('fwawei') || branchSlug.includes('fwavei')
    return true // no branch name in category -> show for all
  })
  const rawList = offered.length ? offered : (rooms ?? [])
  // Deduplicate by clean name — if two categories clean to the same name, keep only one
  const seen = new Set<string>()
  const classList = rawList.filter(r => {
    const key = cleanName(r.name).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const catId = room?.id || selectedCat
  const selectedRoom: Cat | undefined = room || classList.find(r => r.id === catId)

  // Resolve the CORRECT category ID for the selected branch.
  // "Standard Room" selected in Fwawei must use the Fwawei category ID.
  // Look in the FULL undeduped list for a category that:
  //   1. Has same clean name as selected category
  //   2. Has a branch_price for this branch, OR contains branch name
  const resolvedCatId = (() => {
    if (!selectedRoom || !branchId) return catId
    const selClean = cleanName(selectedRoom.name).toLowerCase()
    const all = rooms ?? []
    // Try to find exact branch match first
    const branchMatch = all.find(c =>
      cleanName(c.name).toLowerCase() === selClean &&
      c.branch_prices?.some((bp: any) => bp.hotel === branchId)
    )
    if (branchMatch) return branchMatch.id
    // Fall back to name-based match for selected branch
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
  const img = selectedRoom?.images?.find(i => i.is_primary)?.image_url || selectedRoom?.images?.[0]?.image_url

  // Live room-number availability for the chosen branch + class.
  const { data: avail, isLoading: availLoading } = useQuery<RoomNo[]>({
    queryKey: ['branch-avail', branchId, selectedRoom?.slug],
    queryFn: () => api.get(`/rooms/branch-availability/?hotel=${branchId}&category=${selectedRoom!.slug}`)
      .then(r => (r.data?.classes?.[0]?.rooms ?? []) as RoomNo[]),
    enabled: !!(branchId && selectedRoom?.slug),
  })

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

            {/* Branch */}
            <div className="card p-5">
              <h2 className="font-heading text-lg text-enayi-text mb-4 flex items-center gap-2"><MapPin size={18} className="text-enayi-gold"/>Choose Branch</h2>
              <div className="grid grid-cols-2 gap-3">
                {(hotels ?? []).map(h => (
                  <button key={h.id} type="button"
                    onClick={() => { setBranchId(h.id); if (!slug) setSelectedCat('') }}
                    className={`card p-4 text-left transition-all ${branchId === h.id ? 'border-enayi-gold bg-enayi-gold/5' : 'hover:border-enayi-gold/30'}`}>
                    <div className="font-semibold text-enayi-text text-sm">{h.name?.replace('Enayi Hotels & Suites — ', '') || h.branch}</div>
                    <div className="text-xs text-enayi-muted mt-0.5 capitalize">{h.branch} branch</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Room class */}
            {!slug && (
              <div className="card p-5">
                <h2 className="font-heading text-lg text-enayi-text mb-4 flex items-center gap-2"><BedDouble size={18} className="text-enayi-gold"/>Select Room Class</h2>
                {!branchId ? <p className="text-enayi-muted text-sm">Choose a branch first.</p> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {classList.map(r => {
                      const rp = r.branch_prices?.find(p => p.hotel === branchId)
                      const rprice = Number(rp?.current_price ?? r.current_price ?? r.base_price)
                      return (
                        <button key={r.id} type="button" onClick={() => setSelectedCat(r.id)}
                          className={`card p-4 text-left transition-all ${catId === r.id ? 'border-enayi-gold bg-enayi-gold/5' : 'hover:border-enayi-gold/30'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-semibold text-enayi-text text-sm">{cleanName(r.name)}</span>
                            {r.avg_rating && <span className="text-xs text-enayi-gold flex items-center gap-1"><Star size={10} fill="currentColor"/>{r.avg_rating}</span>}
                          </div>
                          <div className="text-xs text-enayi-muted mb-2">{r.bed_type} · {r.room_size_sqm}m² · {r.max_adults} adults</div>
                          <div className="text-enayi-gold font-semibold text-sm">{formatCurrency(rprice)}<span className="text-enayi-muted font-normal text-xs">/night</span></div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Selected class: picture, price, details, room numbers */}
            {selectedRoom && branch && (
              <div className="card overflow-hidden">
                <div className="aspect-[16/9] bg-enayi-panel relative">
                  {img ? <img src={img} alt={cleanCatName(selectedRoom.name)} className="w-full h-full object-cover"/>
                       : <div className="w-full h-full flex items-center justify-center text-enayi-muted"><ImageIcon size={40}/></div>}
                  <span className="absolute top-3 left-3 badge-gold">{branch.name?.replace('Enayi Hotels & Suites — ', '') || branch.branch}</span>
                </div>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-heading text-xl text-enayi-text">{cleanCatName(selectedRoom.name)}</h3>
                    <div className="text-enayi-gold font-display text-2xl">{formatCurrency(price)}<span className="text-enayi-muted text-xs font-normal">/night</span></div>
                  </div>
                  {selectedRoom.description && <p className="text-enayi-muted text-sm mb-3">{selectedRoom.description}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-enayi-muted mb-4">
                    <span className="flex items-center gap-1"><BedDouble size={12} className="text-enayi-gold"/>{selectedRoom.bed_type}</span>
                    <span className="flex items-center gap-1"><Maximize2 size={12} className="text-enayi-gold"/>{selectedRoom.room_size_sqm}m²</span>
                    <span className="flex items-center gap-1"><Users size={12} className="text-enayi-gold"/>{selectedRoom.max_adults} adults · {selectedRoom.max_children} children</span>
                  </div>

                  <div className="border-t border-enayi-border pt-4">
                    <div className="text-sm text-enayi-text mb-2 font-medium">Rooms in this class at {branch.name?.replace('Enayi Hotels & Suites — ', '') || branch.branch}</div>
                    {availLoading ? <div className="text-enayi-muted text-xs">Checking availability…</div> : (
                      (avail ?? []).length === 0 ? <div className="text-enayi-muted text-xs">No rooms listed for this class yet.</div> : (
                        <div className="flex flex-wrap gap-2">
                          {(avail ?? []).map(rm => (
                            <span key={rm.room_number}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border ${rm.is_occupied
                                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>
                              {rm.is_occupied ? <X size={11}/> : <Check size={11}/>}
                              {rm.room_number} · {rm.label}
                            </span>
                          ))}
                        </div>
                      )
                    )}
                    {!!(avail ?? []).length && (
                      <p className="text-enayi-muted text-xs mt-2">
                        {(avail ?? []).filter(r => !r.is_occupied).length} of {(avail ?? []).length} free · a free room is assigned automatically when you book.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

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

            {/* Extras */}
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
                    <div className="flex justify-between"><span className="text-enayi-muted">Branch</span><span className="text-enayi-text">{branch.name?.replace('Enayi Hotels & Suites — ', '') || branch.branch}</span></div>
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
              ) : <p className="text-enayi-muted text-sm text-center py-6">Choose a branch and room class to see pricing.</p>}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
