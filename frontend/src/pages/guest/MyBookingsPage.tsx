import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BedDouble, Calendar, Clock, ArrowRight, X, Loader2 } from 'lucide-react'
import { useMyBookings, useCancelBooking } from '@/hooks/useBooking'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { StatusBadge, EmptyState, Modal, PageSpinner } from '@/components/ui'
import type { Booking } from '@/types'

const TABS = ['all','confirmed','checked_in','checked_out','cancelled'] as const

export default function MyBookingsPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('all')
  const [cancelId, setCancelId] = useState<string|null>(null)
  const [reason, setReason] = useState('')
  const { data: bookings, isLoading } = useMyBookings()
  const cancel = useCancelBooking()

  const filtered = tab === 'all' ? bookings ?? [] : (bookings ?? []).filter(b => b.status === tab)

  const handleCancel = async () => {
    if (!cancelId) return
    await cancel.mutateAsync({ id: cancelId, reason })
    setCancelId(null); setReason('')
  }

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="font-display text-3xl text-enayi-text">My Bookings</h1><p className="text-enayi-muted text-sm mt-1">{bookings?.length ?? 0} total bookings</p></div>
        <Link to="/book" className="btn-gold gap-2 text-sm">New Booking <ArrowRight size={14}/></Link>
      </div>
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${tab===t?'bg-enayi-gold text-enayi-bg':'card text-enayi-muted hover:text-enayi-gold'}`}>
            {t === 'all' ? 'All' : t.replace('_',' ')}
          </button>
        ))}
      </div>
      {filtered.length === 0
        ? <EmptyState icon={BedDouble} title="No bookings found" desc="You have no bookings in this category." action={<Link to="/book" className="btn-gold gap-2 text-sm">Book a Room <ArrowRight size={14}/></Link>} />
        : (
          <div className="space-y-4">
            {filtered.map(b => (
              <div key={b.id} className="card-hover p-5">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-enayi-panel border border-enayi-border flex items-center justify-center flex-shrink-0"><BedDouble size={20} className="text-enayi-gold"/></div>
                    <div>
                      <div className="font-heading text-lg text-enayi-text">{b.room_detail?.category_name ?? 'Room'}</div>
                      <div className="text-enayi-muted text-xs mt-0.5">Room {b.room_detail?.room_number} · Floor {b.room_detail?.floor} · Ref: {b.booking_reference}</div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-enayi-muted">
                        <span className="flex items-center gap-1"><Calendar size={11}/> {formatDate(b.check_in)}</span>
                        <span>→</span>
                        <span className="flex items-center gap-1"><Calendar size={11}/> {formatDate(b.check_out)}</span>
                        <span className="flex items-center gap-1"><Clock size={11}/> {b.total_nights} nights</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right"><div className="text-enayi-gold font-display text-xl">{formatCurrency(b.total_amount)}</div><div className="text-xs text-enayi-muted mt-0.5">{b.is_fully_paid ? '✅ Paid' : `₦${formatCurrency(b.balance_due)} due`}</div></div>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
                {['confirmed','pending'].includes(b.status) && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-enayi-border">
                    {!b.is_fully_paid && <Link to={`/payment/${b.id}?purpose=booking&amount=${b.balance_due}`} className="btn-gold text-xs gap-1.5 px-4 py-2">Pay Balance</Link>}
                    <button onClick={() => setCancelId(b.id)} className="btn-surface text-xs gap-1.5 px-4 py-2 text-red-400 border-red-500/20 hover:bg-red-500/10"><X size={12}/> Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
      <Modal open={!!cancelId} onClose={() => setCancelId(null)} title="Cancel Booking">
        <p className="text-enayi-muted text-sm mb-4">Are you sure you want to cancel this booking? This action cannot be undone.</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} className="input w-full mb-4" rows={3} placeholder="Reason for cancellation (optional)"/>
        <div className="flex gap-3">
          <button onClick={() => setCancelId(null)} className="btn-surface flex-1">Keep Booking</button>
          <button onClick={handleCancel} disabled={cancel.isPending} className="flex-1 bg-red-500/10 border border-red-500/30 text-red-400 btn-md rounded-xl hover:bg-red-500/20">
            {cancel.isPending ? <Loader2 size={14} className="animate-spin mx-auto"/> : 'Yes, Cancel'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
