import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { StatusBadge, PageSpinner, EmptyState, Button, Modal, Textarea, Alert } from '@/components/ui'
import { BedDouble, LogIn, LogOut, ShieldAlert } from 'lucide-react'
import type { Booking, CheckoutApprovalRequest } from '@/types'

export default function AdminBookings() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Booking[]>({ queryKey:['admin-bookings'], queryFn:()=>api.get('/bookings/').then(r=>r.data) })

  // Booking currently going through the "outstanding balance" checkout flow.
  const [pendingCheckout, setPendingCheckout] = useState<Booking | null>(null)
  const [reason, setReason] = useState('')

  const checkIn = useMutation({
    mutationFn: (bookingId: string) => api.post(`/bookings/${bookingId}/checkin/`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      toast.success(res.data?.message || 'Guest checked in.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const checkOut = useMutation({
    mutationFn: (vars: { bookingId: string; reason?: string }) =>
      api.post(`/bookings/${vars.bookingId}/checkout/`, vars.reason ? { reason: vars.reason } : {}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      if (res.status === 202) {
        // Balance outstanding — a CheckoutApprovalRequest was created, not a completed checkout.
        toast(res.data?.error || 'Outstanding balance — sent for manager approval.', { icon: '⏳' })
      } else {
        toast.success(res.data?.message || 'Guest checked out.')
      }
      setPendingCheckout(null)
      setReason('')
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) {
        // Already has a pending approval request — not a failure, just inform staff.
        toast(getErrorMessage(err), { icon: '⏳' })
        setPendingCheckout(null)
        setReason('')
      } else {
        toast.error(getErrorMessage(err))
      }
    },
  })

  const handleCheckoutClick = (booking: Booking) => {
    if (booking.is_fully_paid) {
      checkOut.mutate({ bookingId: booking.id })
    } else {
      // Outstanding balance — collect an optional reason before sending for manager approval.
      setPendingCheckout(booking)
    }
  }

  const confirmPendingCheckout = () => {
    if (!pendingCheckout) return
    checkOut.mutate({ bookingId: pendingCheckout.id, reason })
  }

  if (isLoading) return <PageSpinner />

  return (
    <div className="p-6 space-y-5">
      <div><h1 className="font-display text-3xl text-enayi-text">All Bookings</h1><p className="text-enayi-muted text-sm">{data?.length??0} total</p></div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-enayi-panel border-b border-enayi-border"><tr>{['Reference','Guest','Room','Check-in','Check-out','Amount','Balance','Status','Actions'].map(h=><th key={h} className="text-left px-4 py-3 text-enayi-muted text-xs font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-enayi-border">
            {(data||[]).length===0 ? <tr><td colSpan={9} className="text-center py-12 text-enayi-muted"><EmptyState icon={BedDouble} title="No bookings found" /></td></tr>
            : (data||[]).map(b=>(
              <tr key={b.id} className="hover:bg-enayi-panel transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-enayi-gold">{b.booking_reference}</td>
                <td className="px-4 py-3 text-enayi-text">{b.guest_name}</td>
                <td className="px-4 py-3 text-enayi-muted">{b.room_detail?.room_number ?? '—'}</td>
                <td className="px-4 py-3 text-enayi-muted">{formatDate(b.check_in)}</td>
                <td className="px-4 py-3 text-enayi-muted">{formatDate(b.check_out)}</td>
                <td className="px-4 py-3 text-enayi-gold font-semibold">{formatCurrency(b.total_amount)}</td>
                <td className="px-4 py-3">
                  {b.is_fully_paid
                    ? <span className="text-green-400 text-xs">Paid</span>
                    : <span className="text-red-400 text-xs font-semibold">{formatCurrency(b.balance_due)} due</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={b.status}/></td>
                <td className="px-4 py-3">
                  {b.status === 'confirmed' && (
                    <Button size="sm" variant="outline" loading={checkIn.isPending} onClick={() => checkIn.mutate(b.id)}>
                      <LogIn size={13} /> Check In
                    </Button>
                  )}
                  {b.status === 'checked_in' && (
                    <Button
                      size="sm"
                      variant={b.is_fully_paid ? 'outline' : 'danger'}
                      loading={checkOut.isPending && pendingCheckout?.id === b.id}
                      onClick={() => handleCheckoutClick(b)}
                    >
                      <LogOut size={13} /> {b.is_fully_paid ? 'Check Out' : 'Check Out…'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirmation for underpaid checkout — makes clear this won't complete instantly. */}
      <Modal open={!!pendingCheckout} onClose={() => { setPendingCheckout(null); setReason('') }} title="Outstanding balance" size="sm">
        {pendingCheckout && (
          <div className="space-y-4">
            <Alert type="warning">
              <span className="flex items-start gap-1.5">
                <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" />
                {pendingCheckout.guest_name} still owes <strong className="mx-1">{formatCurrency(pendingCheckout.balance_due)}</strong>.
                This checkout will be sent to a manager for approval instead of completing immediately.
              </span>
            </Alert>
            <Textarea
              label="Reason (optional)"
              placeholder="e.g. Guest rushing for a flight, will settle balance by transfer…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setPendingCheckout(null); setReason('') }}>Cancel</Button>
              <Button variant="danger" loading={checkOut.isPending} onClick={confirmPendingCheckout}>Send for approval</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
