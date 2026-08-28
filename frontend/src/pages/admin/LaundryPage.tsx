import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { PageSpinner, EmptyState, Button, Modal, Input, Textarea, Badge, Select } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { Shirt, Plus, CheckCircle2, Mail, MailX, Minus, Settings, Trash2, X, UserCircle2, BarChart3, AlertTriangle } from 'lucide-react'

interface HotelLite { id: string; name: string; branch: string; is_primary: boolean }
interface PriceItem { id: string; name: string; price: string; is_active: boolean }
interface TicketLine { id: string; item_name: string; unit_price: string; quantity: number; line_total: string }
interface GuestLite { id: string; first_name: string; last_name: string; full_name?: string; email: string; phone?: string }
interface Ticket {
  id: string; room: string | null; room_number: string | null
  guest_account: string | null
  guest_name: string; guest_email: string; guest_phone: string
  notes: string; total_price: string; status: 'pending' | 'ready'; status_display: string
  line_items: TicketLine[]; is_paid: boolean; logged_by_name: string | null; notified: boolean
  created_at: string; ready_at: string | null
}
interface ReconStaffRow {
  logged_by_id: string | null; logged_by_name: string; tickets: number
  total_amount: number; paid_amount: number; unpaid_amount: number
  paid_count: number; unpaid_count: number
}
interface ReconData {
  overall: { tickets: number; total_amount: number; paid_amount: number; unpaid_amount: number; paid_count: number; unpaid_count: number }
  by_staff: ReconStaffRow[]
}

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])
const emptyForm = { room: '', notes: '' }
const unpaidRate = (row: { total_amount: number; unpaid_amount: number }) =>
  row.total_amount > 0 ? Math.round((row.unpaid_amount / row.total_amount) * 100) : 0

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
  const [showRecon, setShowRecon] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  // ── Guest search — payment requires a real account, so this is how
  // staff attaches a ticket to one instead of typing free text. Falls
  // back to manual entry only if no account can be found (a walk-in
  // without a registered account can't be paid for in-app).
  const [guestQuery, setGuestQuery] = useState('')
  const [selectedGuest, setSelectedGuest] = useState<GuestLite | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualGuest, setManualGuest] = useState({ guest_name: '', guest_email: '', guest_phone: '' })

  const { data: guests } = useQuery<GuestLite[]>({
    queryKey: ['guests-for-laundry'],
    queryFn: () => api.get('/auth/guests/').then(r => unwrapList(r.data)),
    enabled: showForm && !manualMode,
  })

  const guestMatches = useMemo(() => {
    if (!guestQuery.trim() || !guests) return []
    const q = guestQuery.trim().toLowerCase()
    return guests.filter(g =>
      (g.full_name ?? `${g.first_name} ${g.last_name}`).toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q)
    ).slice(0, 6)
  }, [guestQuery, guests])

  const resetGuestPicker = () => {
    setGuestQuery(''); setSelectedGuest(null); setManualMode(false)
    setManualGuest({ guest_name: '', guest_email: '', guest_phone: '' })
  }

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
      const guestPayload = selectedGuest
        ? { guest_account: selectedGuest.id }
        : manualGuest
      return api.post('/laundry/tickets/', {
        ...form, room: form.room || null, items, ...guestPayload,
        ...(isAdmin ? { hotel: hotelId } : {}),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['laundry-tickets'] })
      const name = selectedGuest ? (selectedGuest.full_name ?? selectedGuest.first_name) : manualGuest.guest_name
      toast.success(`Ticket logged for ${name}.`)
      setForm(emptyForm); setQuantities({}); resetGuestPicker(); setShowForm(false)
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

  // ── Reconciliation (Manager/Admin only) — per-staff tickets logged
  // vs. actually paid, over a chosen date range. ──
  const [reconFrom, setReconFrom] = useState('')
  const [reconTo, setReconTo] = useState('')

  const { data: recon, isLoading: reconLoading } = useQuery<ReconData>({
    queryKey: ['laundry-reconciliation', hotelId, reconFrom, reconTo],
    queryFn: () => api.get('/laundry/reconciliation/', {
      params: { ...hotelParams, ...(reconFrom ? { date_from: reconFrom } : {}), ...(reconTo ? { date_to: reconTo } : {}) },
    }).then(r => r.data),
    enabled: showRecon && isManagerOrAdmin && (!isAdmin || !!hotelId),
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
            <Button variant="surface" onClick={() => setShowRecon(true)} disabled={isAdmin && !hotelId}><BarChart3 size={14} /> Reconciliation</Button>
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
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={t.status === 'ready' ? 'green' : 'gold'}>{t.status_display}</Badge>
                  <Badge variant={t.is_paid ? 'green' : 'red'}>{t.is_paid ? 'Paid' : 'Unpaid'}</Badge>
                </div>
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
      <Modal open={showForm} onClose={() => { setShowForm(false); resetGuestPicker() }} title="Log Laundry Ticket" size="lg">
        <div className="space-y-4">
          <Input label="Room number (optional)" placeholder="e.g. 12" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} />

          <div>
            <label className="label">Guest</label>
            {selectedGuest ? (
              <div className="flex items-center justify-between gap-2 bg-enayi-surface border border-enayi-border rounded-xl px-3 py-2 mt-1.5">
                <div className="flex items-center gap-2">
                  <UserCircle2 size={16} className="text-enayi-gold" />
                  <div>
                    <div className="text-sm text-enayi-text">{selectedGuest.full_name ?? `${selectedGuest.first_name} ${selectedGuest.last_name}`}</div>
                    <div className="text-xs text-enayi-muted">{selectedGuest.email}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedGuest(null)} className="text-enayi-muted hover:text-enayi-text"><X size={16} /></button>
              </div>
            ) : manualMode ? (
              <div className="space-y-2 mt-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-400">No account found — this ticket can't be paid in-app.</span>
                  <button onClick={() => setManualMode(false)} className="text-xs text-enayi-gold hover:underline">Search instead</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Guest name" value={manualGuest.guest_name} onChange={e => setManualGuest({ ...manualGuest, guest_name: e.target.value })} />
                  <Input placeholder="Email (optional)" type="email" value={manualGuest.guest_email} onChange={e => setManualGuest({ ...manualGuest, guest_email: e.target.value })} />
                </div>
                <Input placeholder="Phone (optional)" value={manualGuest.guest_phone} onChange={e => setManualGuest({ ...manualGuest, guest_phone: e.target.value })} />
              </div>
            ) : (
              <div className="mt-1.5">
                <Input placeholder="Search by name or email..." value={guestQuery} onChange={e => setGuestQuery(e.target.value)} />
                {guestQuery.trim() && (
                  <div className="mt-1.5 border border-enayi-border rounded-xl overflow-hidden">
                    {guestMatches.length > 0 ? guestMatches.map(g => (
                      <button key={g.id} onClick={() => { setSelectedGuest(g); setGuestQuery('') }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-enayi-panel transition-colors border-b border-enayi-border last:border-b-0">
                        <UserCircle2 size={14} className="text-enayi-muted flex-shrink-0" />
                        <div>
                          <div className="text-sm text-enayi-text">{g.full_name ?? `${g.first_name} ${g.last_name}`}</div>
                          <div className="text-xs text-enayi-muted">{g.email}</div>
                        </div>
                      </button>
                    )) : (
                      <div className="px-3 py-2 text-xs text-enayi-muted">
                        No match. <button onClick={() => setManualMode(true)} className="text-enayi-gold hover:underline">Enter details manually</button> instead.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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
              <Button variant="ghost" onClick={() => { setShowForm(false); resetGuestPicker() }}>Cancel</Button>
              <Button variant="gold" loading={createTicket.isPending}
                onClick={() => createTicket.mutate()}
                disabled={(!selectedGuest && !manualGuest.guest_name.trim()) || formTotal <= 0}>
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

      {/* ── Reconciliation (Manager/Admin) ── */}
      {isManagerOrAdmin && (
        <Modal open={showRecon} onClose={() => setShowRecon(false)} title="Laundry Reconciliation" size="xl">
          <div className="space-y-4">
            <p className="text-xs text-enayi-muted">
              Tickets logged vs. actually paid, per staff member. This spots patterns worth a closer
              look — it doesn't prove anything by itself. A high unpaid amount can also just mean a
              guest hasn't paid yet. Leave both dates blank for all-time.
            </p>

            <div className="flex gap-3 items-end">
              <Input label="From" type="date" value={reconFrom} onChange={e => setReconFrom(e.target.value)} />
              <Input label="To" type="date" value={reconTo} onChange={e => setReconTo(e.target.value)} />
            </div>

            {reconLoading ? (
              <PageSpinner />
            ) : !recon || recon.by_staff.length === 0 ? (
              <p className="text-sm text-enayi-muted">No tickets logged in this range.</p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="card p-3"><div className="text-enayi-muted text-xs">Tickets</div><div className="text-enayi-text font-semibold">{recon.overall.tickets}</div></div>
                  <div className="card p-3"><div className="text-enayi-muted text-xs">Total</div><div className="text-enayi-text font-semibold">₦{recon.overall.total_amount.toLocaleString()}</div></div>
                  <div className="card p-3"><div className="text-enayi-muted text-xs">Paid</div><div className="text-green-400 font-semibold">₦{recon.overall.paid_amount.toLocaleString()}</div></div>
                  <div className="card p-3"><div className="text-enayi-muted text-xs">Unpaid</div><div className="text-red-400 font-semibold">₦{recon.overall.unpaid_amount.toLocaleString()}</div></div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-enayi-muted text-xs border-b border-enayi-border">
                        <th className="py-2 pr-3">Staff</th>
                        <th className="py-2 pr-3">Tickets</th>
                        <th className="py-2 pr-3">Total</th>
                        <th className="py-2 pr-3">Paid</th>
                        <th className="py-2 pr-3">Unpaid</th>
                        <th className="py-2 pr-3">Unpaid %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recon.by_staff.map(row => {
                        const rate = unpaidRate(row)
                        return (
                          <tr key={row.logged_by_id ?? row.logged_by_name} className="border-b border-enayi-border last:border-b-0">
                            <td className="py-2 pr-3 text-enayi-text">{row.logged_by_name}</td>
                            <td className="py-2 pr-3 text-enayi-muted">{row.tickets}</td>
                            <td className="py-2 pr-3 text-enayi-text">₦{row.total_amount.toLocaleString()}</td>
                            <td className="py-2 pr-3 text-green-400">₦{row.paid_amount.toLocaleString()} <span className="text-enayi-muted text-xs">({row.paid_count})</span></td>
                            <td className="py-2 pr-3 text-red-400">₦{row.unpaid_amount.toLocaleString()} <span className="text-enayi-muted text-xs">({row.unpaid_count})</span></td>
                            <td className="py-2 pr-3">
                              <span className={`flex items-center gap-1 ${rate >= 50 ? 'text-red-400' : rate >= 25 ? 'text-amber-400' : 'text-enayi-muted'}`}>
                                {rate >= 50 && <AlertTriangle size={12} />}
                                {rate}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
