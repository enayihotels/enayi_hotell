import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { formatCurrency, formatDateTime } from '@/utils/helpers'
import { PageSpinner, EmptyState, Button, Modal, Textarea, Alert } from '@/components/ui'
import { ShieldCheck, ShieldX, ClipboardCheck } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import type { CheckoutApprovalRequest } from '@/types'

export default function AdminCheckoutApprovals() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'

  const { data, isLoading } = useQuery<CheckoutApprovalRequest[]>({
    queryKey: ['checkout-approvals'],
    queryFn: () => api.get('/bookings/checkout-approvals/').then(r => r.data),
    enabled: isManagerOrAdmin,
  })

  const [rejecting, setRejecting] = useState<CheckoutApprovalRequest | null>(null)
  const [decisionNote, setDecisionNote] = useState('')

  const decide = useMutation({
    mutationFn: (vars: { id: string; decision: 'approve' | 'reject'; decision_note?: string }) =>
      api.post(`/bookings/checkout-approvals/${vars.id}/decide/`, { decision: vars.decision, decision_note: vars.decision_note || '' }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['checkout-approvals'] })
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      toast.success(res.data?.message || 'Decision recorded.')
      setRejecting(null)
      setDecisionNote('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (!isManagerOrAdmin) {
    return (
      <div className="p-6">
        <Alert type="error">This page is restricted to managers and admins.</Alert>
      </div>
    )
  }

  if (isLoading) return <PageSpinner />

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="font-display text-3xl text-enayi-text">Checkout Approvals</h1>
        <p className="text-enayi-muted text-sm">{data?.length ?? 0} pending — checkouts held back because the guest's balance wasn't fully settled.</p>
      </div>

      {(data || []).length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing pending" desc="All checkouts have either completed or are fully paid." />
      ) : (
        <div className="space-y-3">
          {(data || []).map(req => (
            <div key={req.id} className="card p-5 flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-enayi-gold">{req.booking_reference}</span>
                  <span className="text-enayi-text font-medium">{req.guest_name}</span>
                  <span className="text-enayi-muted text-xs">Room {req.room_number}</span>
                </div>
                <div className="text-red-400 text-sm font-semibold">{formatCurrency(req.balance_due_at_request)} outstanding</div>
                {req.reason && <div className="text-enayi-muted text-xs italic">"{req.reason}"</div>}
                <div className="text-enayi-muted text-xs">
                  Requested by {req.requested_by_name} · {formatDateTime(req.created_at)}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  loading={decide.isPending}
                  onClick={() => decide.mutate({ id: req.id, decision: 'approve' })}
                >
                  <ShieldCheck size={14} /> Approve
                </Button>
                <Button size="sm" variant="danger" onClick={() => setRejecting(req)}>
                  <ShieldX size={14} /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!rejecting} onClose={() => { setRejecting(null); setDecisionNote('') }} title="Reject checkout" size="sm">
        {rejecting && (
          <div className="space-y-4">
            <Alert type="warning">
              {rejecting.guest_name} will remain checked in. Front desk will need to collect the balance and try again.
            </Alert>
            <Textarea
              label="Note (optional)"
              placeholder="e.g. Ask guest to settle balance at front desk first."
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setRejecting(null); setDecisionNote('') }}>Cancel</Button>
              <Button
                variant="danger"
                loading={decide.isPending}
                onClick={() => rejecting && decide.mutate({ id: rejecting.id, decision: 'reject', decision_note: decisionNote })}
              >
                Confirm reject
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
