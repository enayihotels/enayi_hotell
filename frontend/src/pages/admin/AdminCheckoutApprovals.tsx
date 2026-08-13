import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { formatCurrency, formatDateTime } from '@/utils/helpers'
import { PageSpinner, EmptyState, Button, Modal, Textarea, Alert, Badge } from '@/components/ui'
import { ShieldCheck, ShieldX, ClipboardCheck, Users } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import type { CheckoutApprovalRequest } from '@/types'

type ManagerStats = {
  total_decisions: number
  approved: number
  rejected: number
  amount_waved_through: number
}
type ManagerActivityHistoryItem = {
  id: string
  booking_reference: string
  guest_name: string
  requested_by_name: string
  decided_by_name: string
  status: 'approved' | 'rejected'
  balance_due: number
  reason: string
  decision_note: string
  decided_at: string
}
type ManagerActivity = {
  by_manager: Record<string, ManagerStats>
  history: ManagerActivityHistoryItem[]
}

export default function AdminCheckoutApprovals() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'
  const isOwner = user?.role === 'admin'
  const [tab, setTab] = useState<'pending' | 'manager-activity'>('pending')

  const { data, isLoading } = useQuery<CheckoutApprovalRequest[]>({
    queryKey: ['checkout-approvals'],
    queryFn: () => api.get('/bookings/checkout-approvals/').then(r => r.data?.results ?? r.data),
    enabled: isManagerOrAdmin,
  })

  const { data: managerActivity, isLoading: activityLoading } = useQuery<ManagerActivity>({
    queryKey: ['manager-activity'],
    queryFn: () => api.get('/bookings/manager-activity/').then(r => r.data),
    enabled: isOwner && tab === 'manager-activity',
  })

  const [rejecting, setRejecting] = useState<CheckoutApprovalRequest | null>(null)
  const [decisionNote, setDecisionNote] = useState('')

  const decide = useMutation({
    mutationFn: (vars: { id: string; decision: 'approve' | 'reject'; decision_note?: string }) =>
      api.post(`/bookings/checkout-approvals/${vars.id}/decide/`, { decision: vars.decision, decision_note: vars.decision_note || '' }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['checkout-approvals'] })
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      qc.invalidateQueries({ queryKey: ['manager-activity'] })
      toast.success(res.data?.message || 'Decision recorded.')
      setRejecting(null)
      setDecisionNote('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (!isManagerOrAdmin) {
    return (
      <div className="p-4 md:p-6">
        <Alert type="error">This page is restricted to managers and owners.</Alert>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="font-display text-3xl text-enayi-text">Checkout Approvals</h1>
        <p className="text-enayi-muted text-sm">Checkouts held back because a guest's balance wasn't fully settled.</p>
      </div>

      {isOwner && (
        <div className="flex gap-2">
          <button onClick={() => setTab('pending')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab==='pending' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
            <ClipboardCheck size={14} className="inline mr-1.5 -mt-0.5" /> Pending ({data?.length ?? 0})
          </button>
          <button onClick={() => setTab('manager-activity')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab==='manager-activity' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
            <Users size={14} className="inline mr-1.5 -mt-0.5" /> Manager Activity
            <span className="ml-1.5 text-[10px] uppercase tracking-wide text-enayi-gold/70">Owner only</span>
          </button>
        </div>
      )}

      {tab === 'pending' && (
        isLoading ? <PageSpinner /> : (data || []).length === 0 ? (
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
        )
      )}

      {tab === 'manager-activity' && isOwner && (
        activityLoading ? <PageSpinner /> : (
          <div className="space-y-6">
            <div>
              <div className="text-enayi-muted text-xs font-semibold uppercase tracking-wide mb-3">Per-manager summary</div>
              {Object.keys(managerActivity?.by_manager || {}).length === 0 ? (
                <EmptyState icon={Users} title="No decisions recorded yet" desc="Once a manager approves or rejects a checkout, their activity shows up here." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(managerActivity!.by_manager).map(([name, stats]) => (
                    <div key={name} className="card p-4 space-y-2">
                      <div className="text-enayi-text font-medium">{name}</div>
                      <div className="flex gap-3 text-sm">
                        <span className="text-green-400 font-semibold">{stats.approved} approved</span>
                        <span className="text-red-400 font-semibold">{stats.rejected} rejected</span>
                      </div>
                      <div className="text-enayi-muted text-xs">{stats.total_decisions} decision(s) total</div>
                      <div className="text-enayi-gold text-sm font-semibold pt-1 border-t border-enayi-border">
                        {formatCurrency(stats.amount_waved_through)} waved through on approval
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-enayi-muted text-xs font-semibold uppercase tracking-wide mb-3">Full decision history</div>
              {(managerActivity?.history || []).length === 0 ? (
                <div className="text-enayi-muted text-sm">Nothing decided yet.</div>
              ) : (
                <div className="space-y-2.5">
                  {managerActivity!.history.map(item => (
                    <div key={item.id} className="card p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-enayi-gold">{item.booking_reference}</span>
                          <Badge variant={item.status === 'approved' ? 'green' : 'red'}>{item.status}</Badge>
                        </div>
                        <div className="text-enayi-text text-sm">{item.guest_name} · {formatCurrency(item.balance_due)} owed</div>
                        <div className="text-enayi-muted text-xs">
                          Requested by {item.requested_by_name} · Decided by <span className="text-enayi-gold">{item.decided_by_name}</span> · {item.decided_at ? formatDateTime(item.decided_at) : '—'}
                        </div>
                        {item.decision_note && <div className="text-enayi-muted text-xs italic">"{item.decision_note}"</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
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
