import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { formatCurrency, formatDateTime } from '@/utils/helpers'
import { PageSpinner, EmptyState, Button, Badge, Alert } from '@/components/ui'
import { ShieldAlert, Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import type { FraudAuditReport } from '@/types'

export default function AdminFraudReports() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<FraudAuditReport[]>({
    queryKey: ['fraud-reports'],
    queryFn: () => api.get('/dashboard/fraud-reports/').then(r => r.data),
    enabled: isManagerOrAdmin,
  })

  const runNow = useMutation({
    mutationFn: () => api.post('/dashboard/fraud-reports/run-now/', { hours: 24 }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['fraud-reports'] })
      const flagged = res.data?.flagged_count ?? 0
      toast.success(flagged > 0 ? `Audit complete — ${flagged} item(s) flagged.` : 'Audit complete — nothing flagged.')
      setExpandedId(res.data?.id ?? null)
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-enayi-text">Fraud Audit Reports</h1>
          <p className="text-enayi-muted text-sm">AI-reviewed sweep of checkout overrides, manual payments, and room turnover — runs nightly at 2:00 AM, or on demand below.</p>
        </div>
        <Button variant="gold" loading={runNow.isPending} onClick={() => runNow.mutate()}>
          <RefreshCw size={14} /> Run audit now
        </Button>
      </div>

      {(data || []).length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No audit reports yet" desc="Run one now, or wait for tonight's scheduled sweep." />
      ) : (
        <div className="space-y-3">
          {(data || []).map(report => {
            const expanded = expandedId === report.id
            const s = report.raw_signals
            return (
              <div key={report.id} className="card overflow-hidden">
                <button
                  className="w-full flex items-center justify-between gap-4 p-5 text-left"
                  onClick={() => setExpandedId(expanded ? null : report.id)}
                >
                  <div className="flex items-center gap-3">
                    {report.flagged_count > 0
                      ? <Badge variant="red">{report.flagged_count} flagged</Badge>
                      : <Badge variant="green">Clean</Badge>}
                    <span className="text-enayi-text font-medium">{formatDateTime(report.created_at)}</span>
                    <Badge variant="gray">{report.triggered_by === 'manual' ? 'Manual' : 'Scheduled'}</Badge>
                    {report.ai_generated && (
                      <span className="flex items-center gap-1 text-enayi-gold text-xs"><Sparkles size={12} /> AI summary</span>
                    )}
                  </div>
                  {expanded ? <ChevronUp size={16} className="text-enayi-muted" /> : <ChevronDown size={16} className="text-enayi-muted" />}
                </button>
                <div className="px-5 pb-5">
                  <p className="text-enayi-text text-sm leading-relaxed">{report.summary_text}</p>
                </div>
                {expanded && (
                  <div className="border-t border-enayi-border p-5 space-y-4 bg-enayi-panel">
                    <div>
                      <div className="text-enayi-muted text-xs font-semibold uppercase mb-1.5">Checkout Approvals</div>
                      <p className="text-enayi-text text-sm">
                        {s.checkout_approvals.total} total ({s.checkout_approvals.approved} approved, {s.checkout_approvals.rejected} rejected, {s.checkout_approvals.pending} pending)
                      </p>
                      {Object.keys(s.checkout_approvals.staff_with_repeat_requests).length > 0 && (
                        <p className="text-red-400 text-xs mt-1">
                          Repeat requests: {Object.entries(s.checkout_approvals.staff_with_repeat_requests).map(([name, n]) => `${name} (${n})`).join(', ')}
                        </p>
                      )}
                    </div>
                    <div>
                      <div className="text-enayi-muted text-xs font-semibold uppercase mb-1.5">Manual Cash/POS Payments</div>
                      <p className="text-enayi-text text-sm">
                        {s.manual_payments.count} payment(s), {formatCurrency(s.manual_payments.total_amount)} total
                      </p>
                    </div>
                    <div>
                      <div className="text-enayi-muted text-xs font-semibold uppercase mb-1.5">Fast Room Turnovers (&lt;30 min)</div>
                      {s.fast_room_turnovers.length === 0 ? (
                        <p className="text-enayi-muted text-sm">None</p>
                      ) : (
                        <ul className="text-sm text-enayi-text space-y-1">
                          {s.fast_room_turnovers.map((t, i) => (
                            <li key={i}>Room {t.room}: {t.checked_out} → {t.next_checkin} ({t.gap_minutes} min gap)</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <div className="text-enayi-muted text-xs font-semibold uppercase mb-1.5">Unverified Check-ins</div>
                      <p className={s.unverified_checkins > 0 ? 'text-red-400 text-sm' : 'text-enayi-muted text-sm'}>{s.unverified_checkins}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
