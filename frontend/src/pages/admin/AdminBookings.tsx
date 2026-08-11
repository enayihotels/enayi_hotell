import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { StatusBadge, PageSpinner, EmptyState, Button, Modal, Textarea, Alert, Input, Select } from '@/components/ui'
import { BedDouble, LogIn, LogOut, ShieldAlert, Banknote, MailCheck, RefreshCw, ScanFace, Camera } from 'lucide-react'
import type { Booking, CheckoutApprovalRequest } from '@/types'

const NON_PAYABLE_STATUSES: Booking['status'][] = ['cancelled', 'checked_out', 'no_show']

const VERDICT_STYLE: Record<string, { badge: 'green' | 'gold' | 'red' | 'gray'; label: string }> = {
  likely_match:    { badge: 'green', label: 'Likely match' },
  uncertain:       { badge: 'gold',  label: 'Uncertain — take a closer look' },
  likely_mismatch: { badge: 'red',   label: 'Likely mismatch — investigate' },
  error:           { badge: 'gray',  label: 'Check unavailable' },
}

export default function AdminBookings() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Booking[]>({ queryKey:['admin-bookings'], queryFn:()=>api.get('/bookings/').then(r=>r.data) })

  // Booking currently going through the "outstanding balance" checkout flow.
  const [pendingCheckout, setPendingCheckout] = useState<Booking | null>(null)
  const [reason, setReason] = useState('')

  // Booking currently having a cash/POS payment recorded against it.
  const [recordingPaymentFor, setRecordingPaymentFor] = useState<Booking | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pos'>('cash')
  const [paymentNote, setPaymentNote] = useState('')

  // Booking currently going through guest-verified check-in.
  const [checkingInFor, setCheckingInFor] = useState<Booking | null>(null)
  const [otpSentTo, setOtpSentTo] = useState('')
  const [otpCode, setOtpCode] = useState('')

  // Optional photo-based plausibility check, nested inside the check-in modal.
  const [showIdentityCheck, setShowIdentityCheck] = useState(false)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [idPhotoFile, setIdPhotoFile] = useState<File | null>(null)
  const [identityResult, setIdentityResult] = useState<{ verdict: string; note: string; disclaimer: string } | null>(null)

  const sendOtp = useMutation({
    mutationFn: (bookingId: string) => api.post(`/bookings/${bookingId}/checkin/send-otp/`),
    onSuccess: (res) => {
      setOtpSentTo(res.data?.message || 'Code sent.')
      toast.success('Check-in code emailed to the guest.')
    },
    onError: (err) => {
      setOtpSentTo('')
      toast.error(getErrorMessage(err))
    },
  })

  const checkIn = useMutation({
    mutationFn: (vars: { bookingId: string; otp_code: string }) =>
      api.post(`/bookings/${vars.bookingId}/checkin/`, { otp_code: vars.otp_code }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      toast.success(res.data?.message || 'Guest checked in.')
      closeCheckinModal()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const verifyIdentity = useMutation({
    mutationFn: (bookingId: string) => {
      const form = new FormData()
      if (selfieFile) form.append('selfie', selfieFile)
      if (idPhotoFile) form.append('id_photo', idPhotoFile)
      return api.post(`/bookings/${bookingId}/checkin/verify-identity/`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: (res) => {
      setIdentityResult(res.data)
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

  const recordPayment = useMutation({
    mutationFn: (vars: { bookingId: string; amount: string; method: 'cash' | 'pos'; narration?: string }) =>
      api.post(`/bookings/${vars.bookingId}/record-payment/`, {
        amount: vars.amount, method: vars.method, narration: vars.narration || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      toast.success(res.data?.message || 'Payment recorded.')
      closePaymentModal()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const handleCheckoutClick = (booking: Booking) => {
    if (booking.is_clear_to_checkout) {
      checkOut.mutate({ bookingId: booking.id })
    } else {
      // Outstanding balance (room and/or unpaid Food & Bar orders) — collect
      // an optional reason before sending for manager approval.
      setPendingCheckout(booking)
    }
  }

  const confirmPendingCheckout = () => {
    if (!pendingCheckout) return
    checkOut.mutate({ bookingId: pendingCheckout.id, reason })
  }

  const openPaymentModal = (booking: Booking) => {
    setRecordingPaymentFor(booking)
    setPaymentAmount(String(booking.balance_due))
    setPaymentMethod('cash')
    setPaymentNote('')
  }

  const closePaymentModal = () => {
    setRecordingPaymentFor(null)
    setPaymentAmount('')
    setPaymentNote('')
  }

  const confirmRecordPayment = () => {
    if (!recordingPaymentFor) return
    recordPayment.mutate({
      bookingId: recordingPaymentFor.id,
      amount: paymentAmount,
      method: paymentMethod,
      narration: paymentNote,
    })
  }

  const openCheckinModal = (booking: Booking) => {
    setCheckingInFor(booking)
    setOtpSentTo('')
    setOtpCode('')
    setShowIdentityCheck(false)
    setSelfieFile(null)
    setIdPhotoFile(null)
    setIdentityResult(null)
    sendOtp.mutate(booking.id)
  }

  const closeCheckinModal = () => {
    setCheckingInFor(null)
    setOtpSentTo('')
    setOtpCode('')
    setShowIdentityCheck(false)
    setSelfieFile(null)
    setIdPhotoFile(null)
    setIdentityResult(null)
  }

  const confirmCheckIn = () => {
    if (!checkingInFor || otpCode.length !== 6) return
    checkIn.mutate({ bookingId: checkingInFor.id, otp_code: otpCode })
  }

  if (isLoading) return <PageSpinner />

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div><h1 className="font-display text-2xl md:text-3xl text-enayi-text">All Bookings</h1><p className="text-enayi-muted text-sm">{data?.length??0} total</p></div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
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
                  {b.unpaid_orders_total > 0 && (
                    <div className="text-amber-400 text-[11px] mt-0.5">+{formatCurrency(b.unpaid_orders_total)} unpaid orders</div>
                  )}
                </td>
                <td className="px-4 py-3"><StatusBadge status={b.status}/></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {!b.is_fully_paid && !NON_PAYABLE_STATUSES.includes(b.status) && (
                      <Button size="sm" variant="surface" onClick={() => openPaymentModal(b)}>
                        <Banknote size={13} /> Record Payment
                      </Button>
                    )}
                    {b.status === 'confirmed' && (
                      <Button size="sm" variant="outline" onClick={() => openCheckinModal(b)}>
                        <LogIn size={13} /> Check In
                      </Button>
                    )}
                    {b.status === 'checked_in' && (
                      <Button
                        size="sm"
                        variant={b.is_clear_to_checkout ? 'outline' : 'danger'}
                        loading={checkOut.isPending && pendingCheckout?.id === b.id}
                        onClick={() => handleCheckoutClick(b)}
                      >
                        <LogOut size={13} /> {b.is_clear_to_checkout ? 'Check Out' : 'Check Out…'}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Confirmation for underpaid checkout — makes clear this won't complete instantly. */}
      <Modal open={!!pendingCheckout} onClose={() => { setPendingCheckout(null); setReason('') }} title="Outstanding balance" size="sm">
        {pendingCheckout && (
          <div className="space-y-4">
            <Alert type="warning">
              <span className="flex items-start gap-1.5">
                <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" />
                {pendingCheckout.guest_name} still owes <strong className="mx-1">{formatCurrency(pendingCheckout.total_outstanding)}</strong>
                {pendingCheckout.unpaid_orders_total > 0 && (
                  <> (includes {formatCurrency(pendingCheckout.unpaid_orders_total)} in unpaid Food &amp; Bar orders)</>
                )}.
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

      {/* Record a cash/POS payment collected at the front desk. */}
      <Modal open={!!recordingPaymentFor} onClose={closePaymentModal} title="Record cash / POS payment" size="sm">
        {recordingPaymentFor && (
          <div className="space-y-4">
            <Alert type="info">
              {recordingPaymentFor.guest_name} owes <strong className="mx-1">{formatCurrency(recordingPaymentFor.balance_due)}</strong>.
              This creates a real payment record tied to your name and completes the booking automatically once fully paid.
            </Alert>
            <Input
              label="Amount received (₦)"
              type="number"
              min={1}
              max={recordingPaymentFor.balance_due}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <Select label="Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'pos')}>
              <option value="cash">Cash</option>
              <option value="pos">POS</option>
            </Select>
            <Textarea
              label="Note (optional)"
              placeholder="e.g. Full balance settled at check-in."
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={closePaymentModal}>Cancel</Button>
              <Button
                variant="gold"
                loading={recordPayment.isPending}
                disabled={!paymentAmount || Number(paymentAmount) <= 0}
                onClick={confirmRecordPayment}
              >
                Record payment
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Guest self-verification check-in: a code is emailed to the guest;
          only the guest can retrieve it, so staff alone can't fabricate an arrival. */}
      <Modal open={!!checkingInFor} onClose={closeCheckinModal} title="Verify guest to check in" size="sm">
        {checkingInFor && (
          <div className="space-y-4">
            <Alert type={sendOtp.isError ? 'error' : 'info'}>
              <span className="flex items-start gap-1.5">
                <MailCheck size={14} className="mt-0.5 flex-shrink-0" />
                {sendOtp.isPending
                  ? 'Sending a check-in code to the guest\u2019s email…'
                  : sendOtp.isError
                    ? 'Could not send the code. Use Resend, or check the error toast for details.'
                    : (otpSentTo || 'Preparing to send a check-in code…')}
              </span>
            </Alert>
            <p className="text-enayi-muted text-xs">
              Ask {checkingInFor.guest_name} to read you the code from their email — this confirms they're the actual account holder before check-in completes.
            </p>
            <Input
              label="6-digit check-in code"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center tracking-[0.5em] text-lg font-mono"
            />

            {!showIdentityCheck ? (
              <button
                type="button"
                className="text-enayi-gold text-xs flex items-center gap-1.5 hover:underline"
                onClick={() => setShowIdentityCheck(true)}
              >
                <ScanFace size={13} /> Optional: run a photo plausibility check
              </button>
            ) : (
              <div className="border border-enayi-border rounded-xl p-4 space-y-3 bg-enayi-panel">
                <p className="text-enayi-muted text-xs leading-relaxed">
                  Optional and advisory only — a general visual read, not a biometric guarantee. Take a selfie of the guest now; provide an ID photo too if they have no saved profile photo.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col items-center justify-center gap-1.5 border border-dashed border-enayi-border rounded-lg p-3 cursor-pointer text-center hover:border-enayi-gold/40 transition-colors">
                    <Camera size={16} className="text-enayi-muted" />
                    <span className="text-xs text-enayi-muted">{selfieFile ? selfieFile.name : 'Take selfie'}</span>
                    <input type="file" accept="image/*" capture="user" className="hidden"
                      onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <label className="flex flex-col items-center justify-center gap-1.5 border border-dashed border-enayi-border rounded-lg p-3 cursor-pointer text-center hover:border-enayi-gold/40 transition-colors">
                    <Camera size={16} className="text-enayi-muted" />
                    <span className="text-xs text-enayi-muted">{idPhotoFile ? idPhotoFile.name : 'Photo of ID (optional)'}</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={(e) => setIdPhotoFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
                <Button
                  size="sm"
                  variant="surface"
                  className="w-full"
                  loading={verifyIdentity.isPending}
                  disabled={!selfieFile}
                  onClick={() => checkingInFor && verifyIdentity.mutate(checkingInFor.id)}
                >
                  Run check
                </Button>
                {identityResult && (
                  <Alert type={identityResult.verdict === 'likely_mismatch' ? 'warning' : 'info'}>
                    <div className="space-y-1">
                      <div className="font-semibold text-xs">
                        {VERDICT_STYLE[identityResult.verdict]?.label ?? identityResult.verdict}
                      </div>
                      <div className="text-xs">{identityResult.note}</div>
                      <div className="text-[10px] text-enayi-muted italic mt-1">{identityResult.disclaimer}</div>
                    </div>
                  </Alert>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" loading={sendOtp.isPending} onClick={() => sendOtp.mutate(checkingInFor.id)}>
                <RefreshCw size={13} /> Resend code
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={closeCheckinModal}>Cancel</Button>
                <Button variant="gold" loading={checkIn.isPending} disabled={otpCode.length !== 6} onClick={confirmCheckIn}>
                  Confirm check-in
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}


