import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { PageSpinner, EmptyState, Button, Modal, Input, Textarea, Badge, Select } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { Shirt, Plus, CheckCircle2, Mail, MailX, Minus, Settings, Trash2 } from 'lucide-react'

interface HotelLite { id: string; name: string; branch: string; is_primary: boolean }
interface PriceItem { id: string; name: string; price: string; is_active: boolean }
interface TicketLine { id: string; item_name: string; unit_price: string; quantity: number; line_total: string }
interface Ticket {
  id: string; room: string | null; room_number: string | null
  guest_name: string; guest_email: string; guest_phone: string
  notes: string; total_price: string; status: 'pending' | 'ready'; status_display: string
  line_items: TicketLine[]; logged_by_name: string | null; notified: boolean
  created_at: string; ready_at: string | null
}

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])
const emptyForm = { room: '', guest_name: '', guest_email: '', guest_phone: '', notes: '' }

export default function LaundryPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'
  const isAdmin = user?.role === 'admin'

  // Only the Owner operates across every branch — Manager/Laundry Staff
  // are already scoped server-side to their own account's branch, so
  // this selector only ever renders for Admin. Same pattern as
  // AdminAssets/AdminInventory. Every request below includes `hotel`
  // for Admin — the backend requires it for that role specifically.
  const [hotelId, setHotelId] = useState<string>('')

  const { data: hotels } = useQuery<HotelLite[]>({
    queryKey: ['hotels-for-laundry'],
    queryFn: () => api.get('/hotels/').then(r => unwrapList(r.data)),
    enabled: isAdmin,
  })

  useEffect(() => {
    if (isAdmin && !hotelId && hotels && hotels.length > 0) {
      setHotelId((hotels.find(h => h.is_primary) ?? hotels[0]).id)
    }
  }, [isAdmin, hotelId, hotels])

  const hotelParams = isAdmin && hotelId ? { hotel: hotelId } : {}

  const [tab, setTab] = useState<'pending' | 'ready'>('pending')
  const [showForm, setShowForm] = useState(false)
  const [showPrices, setShowPrices] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ['laundry-tickets', hotelId],
    queryFn: () => api.get('/laundry/tickets/', { params: hotelParams }).then(r => unwrapList(r.data)),
    enabled: !isAdmin || !!hotelId,
  })

  const { data: prices } = useQuery<PriceItem[]>({
    queryKey: ['laundry-prices', hotelId],
    queryFn: () => api.get('/laundry/prices/', { params: hotelParams }).then(r => unwrapList(r.data)),
    enabled: !isAdmin || !!hotelId,
  })

  const createTicket = useMutation({
    mutationFn: () => {
      const items = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([price_item, quantity]) => ({ price_item, quantity }))
      return api.post('/laundry/tickets/', { ...form, room: form.room || null, items, ...(isAdmin ? { hotel: hotelId } : {}) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['laundry-tickets'] })
      toast.success(`Ticket logged for ${form.guest_name}.`)
      setForm(emptyForm); setQuantities({}); setShowForm(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const markReady = useMutation({
    mutationFn: (id: string) => api.post(`/laundry/tickets/${id}/mark-ready/`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['laundry-tickets'] })
      const name = res.data.guest_name
      if (res.data.email_sent) toast.success(`${name} notified by email — ready for pickup.`)
      else toast.success(`Marked ready. No email on file — let ${name} know directly.`)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  // ── Price catalog management (Manager/Admin only) ──
  const [newPrice, setNewPrice] = useState({ name: '', price: '' })
  const addPrice = useMutation({
    mutationFn: () => api.post('/laundry/prices/', { ...newPrice, ...(isAdmin ? { hotel: hotelId } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['laundry-prices'] })
      toast.success(`Added "${newPrice.name}".`)
      setNewPrice({ name: '', price: '' })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
  const removePrice = useMutation({
    mutationFn: (id: string) => api.delete(`/laundry/prices/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['laundry-prices'] }); toast.success('Removed.') },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (isLoading) return <PageSpinner />

  const pending = (tickets || []).filter(t => t.status === 'pending')
  const ready = (tickets || []).filter(t => t.status === 'ready')
  const list = tab === 'pending' ? pending : ready

  const formTotal = (prices || []).reduce((sum, p) => sum + (Number(p.price) * (quantities[p.id] || 0)), 0)

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-enayi-text flex items-center gap-2">
            <Shirt size={22} className="text-enayi-gold" /> Laundry
          </h1>
          <p className="text-enayi-muted text-sm">{pending.length} in progress · {ready.length} ready for pickup</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && hotels && hotels.length > 0 && (
            <Select value={hotelId} onChange={e => setHotelId(e.target.value)} className="max-w-[220px]">
              {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </Select>
          )}
          {isManagerOrAdmin && (
            <Button variant="surface" onClick={() => setShowPrices(true)} disabled={isAdmin && !hotelId}><Settings size={14} /> Prices</Button>
          )}
          <Button onClick={() => setShowForm(true)} disabled={isAdmin && !hotelId}><Plus size={14} /> New Ticket</Button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-enayi-border">
        <button onClick={() => setTab('pending')} className={`px-3 py-2 text-sm font-medium border-b-2 transition-all ${tab === 'pending' ? 'border-enayi-gold text-enayi-gold' : 'border-transparent text-enayi-muted hover:text-enayi-text'}`}>
          In Progress ({pending.length})
        </button>
        <button onClick={() => setTab('ready')} className={`px-3 py-2 text-sm font-medium border-b-2 transition-all ${tab === 'ready' ? 'border-enayi-gold text-enayi-gold' : 'border-transparent text-enayi-muted hover:text-enayi-text'}`}>
          Ready ({ready.length})
        </button>
      </div>

      {list.length === 0 ? (
        <div className="card p-8 text-center">
          <EmptyState icon={Shirt} title={tab === 'pending' ? 'Nothing in progress' : 'Nothing ready yet'}
            desc={tab === 'pending' ? 'Log a new ticket when a guest hands over items.' : 'Mark a ticket ready once it\u2019s done.'} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map(t => (
            <div key={t.id} className="card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-enayi-text text-sm">{t.guest_name}</div>
                  <div className="text-enayi-muted text-xs">{t.room_number ? `Room ${t.room_number}` : 'No room on file'}</div>
                </div>
                <Badge variant={t.status === 'ready' ? 'green' : 'gold'}>{t.status_display}</Badge>
              </div>

              <div className="text-xs text-enayi-muted space-y-0.5">
                {t.line_items.map(l => (
                  <div key={l.id} className="flex justify-between">
                    <span>{l.quantity}x {l.item_name}</span>
                    <span>₦{Number(l.line_total).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              {t.notes && <div className="text-xs text-enayi-muted italic">{t.notes}</div>}
              <div className="text-enayi-text text-sm font-semibold">Total: ₦{Number(t.total_price).toLocaleString()}</div>

              <div className="flex items-center gap-1.5 text-xs text-enayi-muted">
                {t.guest_email ? <><Mail size={11} /> {t.guest_email}</> : <><MailX size={11} /> No email on file</>}
              </div>

              {t.status === 'pending' && (
                <Button size="sm" variant="gold" loading={markReady.isPending} onClick={() => markReady.mutate(t.id)}>
                  <CheckCircle2 size={12} /> Mark Ready & Notify
                </Button>
              )}
              {t.status === 'ready' && (
                <div className="text-xs text-enayi-muted">
                  {t.notified ? 'Guest notified by email.' : 'Marked ready — guest was not emailed (no address on file).'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── New ticket ── */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Log Laundry Ticket" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Room number (optional)" placeholder="e.g. 12" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} />
            <Input label="Guest name" placeholder="Guest's name" value={form.guest_name} onChange={e => setForm({ ...form, guest_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Guest email (for ready notification)" type="email" placeholder="guest@example.com" value={form.guest_email} onChange={e => setForm({ ...form, guest_email: e.target.value })} />
            <Input label="Guest phone (optional)" placeholder="+234..." value={form.guest_phone} onChange={e => setForm({ ...form, guest_phone: e.target.value })} />
          </div>
          <Textarea label="Notes (optional)" placeholder="e.g. extra starch requested" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />

          <div>
            <label className="label">Items</label>
            {!prices || prices.length === 0 ? (
              <p className="text-xs text-enayi-muted mt-1">No price list set up yet — add one via Prices first.</p>
            ) : (
              <div className="space-y-1.5 mt-1.5">
                {prices.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 bg-enayi-surface border border-enayi-border rounded-xl px-3 py-2">
                    <div className="text-sm text-enayi-text">{p.name} <span className="text-enayi-muted text-xs">₦{Number(p.price).toLocaleString()}</span></div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setQuantities(q => ({ ...q, [p.id]: Math.max(0, (q[p.id] || 0) - 1) }))}
                        className="w-6 h-6 rounded-full bg-enayi-panel text-enayi-muted hover:text-enayi-text flex items-center justify-center"><Minus size={12} /></button>
                      <span className="text-sm text-enayi-text w-5 text-center">{quantities[p.id] || 0}</span>
                      <button type="button" onClick={() => setQuantities(q => ({ ...q, [p.id]: (q[p.id] || 0) + 1 }))}
                        className="w-6 h-6 rounded-full bg-enayi-panel text-enayi-muted hover:text-enayi-text flex items-center justify-center"><Plus size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-enayi-border">
            <span className="text-enayi-text font-semibold">Total: ₦{formTotal.toLocaleString()}</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button variant="gold" loading={createTicket.isPending}
                onClick={() => createTicket.mutate()}
                disabled={!form.guest_name.trim() || formTotal <= 0}>
                Log Ticket
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Price catalog (Manager/Admin) ── */}
      {isManagerOrAdmin && (
        <Modal open={showPrices} onClose={() => setShowPrices(false)} title="Laundry Prices" size="md">
          <div className="space-y-4">
            <div className="space-y-1.5 max-h-64 overflow-auto">
              {(prices || []).map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2 bg-enayi-surface border border-enayi-border rounded-xl px-3 py-2">
                  <span className="text-sm text-enayi-text">{p.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-enayi-gold">₦{Number(p.price).toLocaleString()}</span>
                    <button onClick={() => removePrice.mutate(p.id)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {(!prices || prices.length === 0) && <p className="text-sm text-enayi-muted">No prices added yet.</p>}
            </div>
            <div className="flex gap-2 items-end pt-2 border-t border-enayi-border">
              <Input label="Item name" placeholder="e.g. Shirt" value={newPrice.name} onChange={e => setNewPrice({ ...newPrice, name: e.target.value })} />
              <Input label="Price (₦)" type="number" min="0" step="0.01" placeholder="0.00" value={newPrice.price} onChange={e => setNewPrice({ ...newPrice, price: e.target.value })} />
              <Button variant="gold" loading={addPrice.isPending} disabled={!newPrice.name.trim() || !newPrice.price || (isAdmin && !hotelId)}
                onClick={() => addPrice.mutate()}>Add</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
