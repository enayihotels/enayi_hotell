import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { PageSpinner, EmptyState, Button, Modal, Input, Textarea, Select, Badge } from '@/components/ui'
import { CalendarDays, Building2, Plus, Pencil, Trash2, Image as ImageIcon, Upload } from 'lucide-react'
import type { EventHall, EventBooking, EventStatus } from '@/types'
import { useAuthStore } from '@/store/authStore'

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

const STATUS_OPTIONS: EventStatus[] = ['pending', 'confirmed', 'deposit_paid', 'fully_paid', 'completed', 'cancelled']
const STATUS_BADGE: Record<EventStatus, 'green'|'red'|'gold'|'blue'|'gray'> = {
  pending: 'gold', confirmed: 'blue', deposit_paid: 'blue', fully_paid: 'green', completed: 'green', cancelled: 'red',
}

type HallForm = {
  name: string; description: string;
  capacity_seated: string; capacity_cocktail: string; capacity_banquet: string;
  size_sqm: string; floor: string;
  price_per_hour: string; price_half_day: string; price_full_day: string; price_weekend: string;
  deposit_percent: string; is_active: boolean;
}
const emptyHallForm: HallForm = {
  name: '', description: '',
  capacity_seated: '100', capacity_cocktail: '150', capacity_banquet: '80',
  size_sqm: '200', floor: '1',
  price_per_hour: '10000', price_half_day: '40000', price_full_day: '70000', price_weekend: '80000',
  deposit_percent: '30', is_active: true,
}

export default function AdminEvents() {
  const { user } = useAuthStore()
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'
  const qc = useQueryClient()
  const [tab, setTab] = useState<'halls' | 'bookings'>('bookings')

  const { data: halls, isLoading: hallsLoading } = useQuery<EventHall[]>({
    queryKey: ['admin-event-halls'], queryFn: () => api.get('/events/halls/').then(r => unwrapList(r.data)),
  })
  const { data: bookings, isLoading: bookingsLoading } = useQuery<EventBooking[]>({
    queryKey: ['admin-event-bookings'], queryFn: () => api.get('/events/bookings/').then(r => unwrapList(r.data)),
  })

  const [hallModalOpen, setHallModalOpen] = useState(false)
  const [editingHall, setEditingHall] = useState<EventHall | null>(null)
  const [hallForm, setHallForm] = useState<HallForm>(emptyHallForm)

  const saveHall = useMutation({
    mutationFn: () => editingHall
      ? api.patch(`/events/halls/${editingHall.slug}/`, hallForm)
      : api.post('/events/halls/', hallForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-event-halls'] })
      toast.success(editingHall ? 'Hall updated.' : 'Hall created.')
      setHallModalOpen(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteHall = useMutation({
    mutationFn: (slug: string) => api.delete(`/events/halls/${slug}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-event-halls'] }); toast.success('Hall deleted.') },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const updateBookingStatus = useMutation({
    mutationFn: (vars: { id: string; status: EventStatus }) => api.patch(`/events/bookings/${vars.id}/status/`, { status: vars.status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-event-bookings'] }); toast.success('Booking status updated.') },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  // ── Photo management modal state ──
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [photoHall, setPhotoHall] = useState<EventHall | null>(null)
  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null)

  const uploadPhotos = useMutation({
    mutationFn: () => {
      const form = new FormData()
      if (photoFiles) Array.from(photoFiles).forEach(f => form.append('images', f))
      return api.post(`/events/halls/${photoHall!.id}/images/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-event-halls'] })
      toast.success(`${res.data?.uploaded ?? 0} photo(s) uploaded.`)
      setPhotoFiles(null)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deletePhoto = useMutation({
    mutationFn: (imageId: string) => api.delete(`/events/halls/images/${imageId}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-event-halls'] }); toast.success('Photo deleted.') },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const openPhotoModal = (h: EventHall) => { setPhotoHall(h); setPhotoFiles(null); setPhotoModalOpen(true) }
  const livePhotoHall = halls?.find(h => h.id === photoHall?.id) ?? photoHall

  const openNewHall = () => { setEditingHall(null); setHallForm(emptyHallForm); setHallModalOpen(true) }
  const openEditHall = (h: EventHall) => {
    setEditingHall(h)
    setHallForm({
      name: h.name, description: h.description,
      capacity_seated: String(h.capacity_seated), capacity_cocktail: String(h.capacity_cocktail), capacity_banquet: String(h.capacity_banquet),
      size_sqm: String(h.size_sqm), floor: String(h.floor),
      price_per_hour: String(h.price_per_hour), price_half_day: String(h.price_half_day), price_full_day: String(h.price_full_day), price_weekend: String(h.price_weekend),
      deposit_percent: String(h.deposit_percent), is_active: h.is_active,
    })
    setHallModalOpen(true)
  }

  if (hallsLoading || bookingsLoading) return <PageSpinner />

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-enayi-text">Events</h1>
          <p className="text-enayi-muted text-sm">{isManagerOrAdmin ? 'Manage event halls and bookings.' : 'View event halls and bookings.'}</p>
        </div>
        {tab === 'halls' && isManagerOrAdmin && (
          <Button variant="gold" onClick={openNewHall}><Plus size={14} /> Add Hall</Button>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('bookings')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab==='bookings' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          <CalendarDays size={14} className="inline mr-1.5 -mt-0.5" /> Bookings ({bookings?.length ?? 0})
        </button>
        <button onClick={() => setTab('halls')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab==='halls' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          <Building2 size={14} className="inline mr-1.5 -mt-0.5" /> Halls ({halls?.length ?? 0})
        </button>
      </div>

      {tab === 'bookings' && (
        (bookings||[]).length === 0 ? (
          <div className="card p-12 text-center"><EmptyState icon={CalendarDays} title="No event bookings yet" /></div>
        ) : (
          <div className="space-y-2.5">
            {bookings!.map(b => (
              <div key={b.id} className="card p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-enayi-gold">{b.booking_reference}</span>
                      <Badge variant={STATUS_BADGE[b.status]}>{b.status.replace('_',' ')}</Badge>
                    </div>
                    <div className="text-enayi-text font-medium">{b.event_name}</div>
                    <div className="text-enayi-muted text-xs">{b.organizer_name} · {b.hall_name} · {formatDate(b.event_date)} {b.start_time}–{b.end_time}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-enayi-gold font-semibold">{formatCurrency(b.total_amount)}</div>
                    {b.balance_due > 0 && <div className="text-red-400 text-xs">{formatCurrency(b.balance_due)} due</div>}
                  </div>
                </div>
                {isManagerOrAdmin && (
                  <Select
                    value={b.status}
                    onChange={e => updateBookingStatus.mutate({ id: b.id, status: e.target.value as EventStatus })}
                    className="max-w-[220px]"
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s.replace('_',' ')}</option>)}
                  </Select>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'halls' && (
        (halls||[]).length === 0 ? (
          <div className="card p-12 text-center"><EmptyState icon={Building2} title="No event halls yet" desc="Add your first one." /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {halls!.map(h => (
              <div key={h.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-enayi-text font-medium">{h.name}</div>
                  {!h.is_active && <Badge variant="gray">Inactive</Badge>}
                </div>
                <div className="text-enayi-gold font-semibold text-sm">{formatCurrency(h.price_full_day)}<span className="text-enayi-muted text-xs font-normal"> / full day</span></div>
                <div className="text-enayi-muted text-xs">Seated {h.capacity_seated} · Cocktail {h.capacity_cocktail} · {h.size_sqm}m²</div>
                <div className="flex gap-2 pt-1 flex-wrap">
                  {isManagerOrAdmin ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openEditHall(h)}><Pencil size={12} /> Edit</Button>
                      <Button size="sm" variant="surface" onClick={() => openPhotoModal(h)}><ImageIcon size={12} /> Photos ({h.images?.length ?? 0})</Button>
                      <Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete "${h.name}"?`)) deleteHall.mutate(h.slug) }}><Trash2 size={12} /> Delete</Button>
                    </>
                  ) : (
                    <span className="text-enayi-muted text-xs italic">View only</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <Modal open={hallModalOpen} onClose={() => setHallModalOpen(false)} title={editingHall ? 'Edit Hall' : 'Add Hall'} size="md">
        <div className="space-y-4">
          <Input label="Name" value={hallForm.name} onChange={e => setHallForm({...hallForm, name: e.target.value})} />
          <Textarea label="Description" value={hallForm.description} onChange={e => setHallForm({...hallForm, description: e.target.value})} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Seated capacity" type="number" value={hallForm.capacity_seated} onChange={e => setHallForm({...hallForm, capacity_seated: e.target.value})} />
            <Input label="Cocktail capacity" type="number" value={hallForm.capacity_cocktail} onChange={e => setHallForm({...hallForm, capacity_cocktail: e.target.value})} />
            <Input label="Banquet capacity" type="number" value={hallForm.capacity_banquet} onChange={e => setHallForm({...hallForm, capacity_banquet: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Size (m²)" type="number" value={hallForm.size_sqm} onChange={e => setHallForm({...hallForm, size_sqm: e.target.value})} />
            <Input label="Floor" type="number" value={hallForm.floor} onChange={e => setHallForm({...hallForm, floor: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Price per hour (₦)" type="number" value={hallForm.price_per_hour} onChange={e => setHallForm({...hallForm, price_per_hour: e.target.value})} />
            <Input label="Half-day price (₦)" type="number" value={hallForm.price_half_day} onChange={e => setHallForm({...hallForm, price_half_day: e.target.value})} />
            <Input label="Full-day price (₦)" type="number" value={hallForm.price_full_day} onChange={e => setHallForm({...hallForm, price_full_day: e.target.value})} />
            <Input label="Weekend price (₦)" type="number" value={hallForm.price_weekend} onChange={e => setHallForm({...hallForm, price_weekend: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <Input label="Deposit %" type="number" value={hallForm.deposit_percent} onChange={e => setHallForm({...hallForm, deposit_percent: e.target.value})} />
            <label className="flex items-center gap-2 cursor-pointer text-sm text-enayi-text pb-2.5">
              <input type="checkbox" checked={hallForm.is_active} onChange={e => setHallForm({...hallForm, is_active: e.target.checked})} /> Active (visible to guests)
            </label>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setHallModalOpen(false)}>Cancel</Button>
            <Button variant="gold" loading={saveHall.isPending} onClick={() => saveHall.mutate()} disabled={!hallForm.name}>
              {editingHall ? 'Save changes' : 'Create hall'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Photo management modal ── */}
      <Modal open={photoModalOpen} onClose={() => setPhotoModalOpen(false)} title={`Photos — ${livePhotoHall?.name ?? ''}`} size="md">
        {livePhotoHall && (
          <div className="space-y-4">
            {(livePhotoHall.images?.length ?? 0) === 0 ? (
              <div className="text-enayi-muted text-sm text-center py-6">No photos yet.</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {livePhotoHall.images!.map(img => (
                  <div key={img.id} className="relative group">
                    <img src={img.image_url} alt={img.caption} className="w-full aspect-square object-cover rounded-lg" />
                    {img.is_primary && <span className="absolute top-1 left-1 badge-gold text-[10px] px-1.5 py-0.5">Primary</span>}
                    <button
                      onClick={() => { if (confirm('Delete this photo?')) deletePhoto.mutate(img.id) }}
                      className="absolute top-1 right-1 bg-red-500/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-enayi-border rounded-lg p-5 cursor-pointer text-center hover:border-enayi-gold/40 transition-colors">
              <Upload size={18} className="text-enayi-muted" />
              <span className="text-xs text-enayi-muted">{photoFiles?.length ? `${photoFiles.length} file(s) selected` : 'Choose one or more photos'}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => setPhotoFiles(e.target.files)} />
            </label>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setPhotoModalOpen(false)}>Close</Button>
              <Button variant="gold" loading={uploadPhotos.isPending} onClick={() => uploadPhotos.mutate()} disabled={!photoFiles?.length}>
                Upload
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
