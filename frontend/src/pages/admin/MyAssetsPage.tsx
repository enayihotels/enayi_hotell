import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { formatDateTime } from '@/utils/helpers'
import { PageSpinner, EmptyState, Button, Modal, Textarea, Badge } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { Wrench, AlertTriangle, CheckCircle2, Clock, Wine, UtensilsCrossed, BedDouble } from 'lucide-react'
import type { PropertyAsset } from '@/types'

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

const STATUS_BADGE: Record<string, 'green' | 'red' | 'gold' | 'gray'> = {
  working: 'green', broken: 'red', under_repair: 'gold', decommissioned: 'gray',
}
const ISSUE_STATUS_BADGE: Record<string, 'red' | 'gold' | 'gray' | 'green'> = {
  reported: 'red', cleared_for_repair: 'gold', rejected: 'gray', fixed: 'green',
}

// Department scoping already happens server-side (PropertyAssetListView
// filters by ROLE_DEPARTMENT) — this is purely cosmetic, choosing an
// icon/title that matches who's looking, not a security boundary.
const DEPT_META: Record<string, { icon: typeof Wine; title: string; empty: string }> = {
  bar_staff:     { icon: Wine,           title: 'Bar Assets',           empty: 'Nothing assigned to Bar yet.' },
  kitchen_staff: { icon: UtensilsCrossed, title: 'Kitchen Assets',      empty: 'Nothing assigned to Kitchen yet.' },
  housekeeper:   { icon: BedDouble,       title: 'Housekeeping Assets', empty: 'Nothing assigned to Housekeeping yet.' },
}

export default function MyAssetsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const meta = DEPT_META[user?.role ?? ''] ?? { icon: Wrench, title: 'My Assets', empty: 'Nothing here yet.' }

  const { data: assets, isLoading } = useQuery<PropertyAsset[]>({
    queryKey: ['my-assets'],
    queryFn: () => api.get('/assets/').then(r => unwrapList(r.data)), // server already scopes this to the caller's own department
  })

  // ── Report issue ──
  const [reportTarget, setReportTarget] = useState<PropertyAsset | null>(null)
  const [issueDescription, setIssueDescription] = useState('')

  const reportIssue = useMutation({
    mutationFn: () => api.post(`/assets/${reportTarget!.id}/report-issue/`, { issue_description: issueDescription }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-assets'] })
      toast.success(`${reportTarget!.name} reported — a Manager or the Owner will review it.`)
      setReportTarget(null); setIssueDescription('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  // ── Confirm fixed (only once cleared for repair by Manager/Owner) ──
  const [resolveTarget, setResolveTarget] = useState<{ asset: PropertyAsset; issueId: string } | null>(null)
  const [fixNotes, setFixNotes] = useState('')

  const resolveIssue = useMutation({
    mutationFn: () => api.post(`/assets/issues/${resolveTarget!.issueId}/resolve/`, { fix_notes: fixNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-assets'] })
      toast.success(`${resolveTarget!.asset.name} marked fixed.`)
      setResolveTarget(null); setFixNotes('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (isLoading) return <PageSpinner />

  const Icon = meta.icon
  const brokenCount = (assets || []).filter(a => a.status !== 'working').length

  // Group by where the item actually is (room, or a common-area/
  // department location note) so Housekeeping — with items spread
  // across 30+ rooms — gets a sane, scannable layout instead of one
  // giant flat list.
  const grouped = new Map<string, PropertyAsset[]>()
  for (const a of assets || []) {
    const key = a.where
    const list = grouped.get(key) || []
    list.push(a)
    grouped.set(key, list)
  }
  const sortedKeys = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-enayi-text flex items-center gap-2"><Icon size={22} className="text-enayi-gold" /> {meta.title}</h1>
        <p className="text-enayi-muted text-sm">
          Everything in your care — report anything damaged and a Manager or the Owner will review it.
          {brokenCount > 0 && <span className="text-red-400"> {brokenCount} item{brokenCount === 1 ? '' : 's'} currently not working.</span>}
        </p>
      </div>

      {(assets || []).length === 0 ? (
        <div className="card p-8 text-center"><EmptyState icon={Icon} title="Nothing here yet" desc={meta.empty} /></div>
      ) : (
        sortedKeys.map(where => (
          <div key={where}>
            <h2 className="font-heading text-base text-enayi-text mb-3">{where} <span className="text-enayi-muted text-sm font-normal">({grouped.get(where)!.length})</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {grouped.get(where)!.map(a => (
                <div key={a.id} className="card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-enayi-text text-sm">{a.quantity > 1 ? `${a.quantity}× ` : ''}{a.name}</div>
                    <Badge variant={STATUS_BADGE[a.status]}>{a.status.replace('_', ' ')}</Badge>
                  </div>

                  {a.open_issue && (
                    <div className="text-xs bg-red-500/5 border border-red-500/20 rounded-lg p-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1 text-red-400 font-medium"><AlertTriangle size={11} /> {a.open_issue.issue_description}</span>
                        <Badge variant={ISSUE_STATUS_BADGE[a.open_issue.status]}>{a.open_issue.status_display}</Badge>
                      </div>
                      {a.open_issue.status === 'reported' && (
                        <div className="text-enayi-muted">Reported {formatDateTime(a.open_issue.reported_at)} — awaiting review.</div>
                      )}
                      {a.open_issue.status === 'cleared_for_repair' && (
                        <div className="text-enayi-muted">Cleared for repair{a.open_issue.cleared_by_name ? ` by ${a.open_issue.cleared_by_name}` : ''}.</div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    {a.status === 'working' && (
                      <Button size="sm" variant="danger" onClick={() => { setReportTarget(a); setIssueDescription('') }}>
                        <AlertTriangle size={12} /> Report Damage
                      </Button>
                    )}
                    {a.open_issue?.status === 'cleared_for_repair' && (
                      <Button size="sm" variant="surface" onClick={() => { setResolveTarget({ asset: a, issueId: a.open_issue!.id }); setFixNotes('') }}>
                        <CheckCircle2 size={12} /> Confirm Fixed
                      </Button>
                    )}
                  </div>

                  {a.issue_reports.length > 0 && (
                    <details className="text-xs">
                      <summary className="text-enayi-muted cursor-pointer flex items-center gap-1"><Clock size={11} /> History ({a.issue_reports.length})</summary>
                      <div className="mt-2 space-y-1.5 pl-3 border-l border-enayi-border">
                        {a.issue_reports.map(r => (
                          <div key={r.id} className="text-enayi-muted">
                            <span className={r.status === 'fixed' ? 'text-green-400' : r.status === 'rejected' ? 'text-enayi-muted' : 'text-red-400'}>{r.status_display}</span>: {r.issue_description}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Report Damage modal */}
      <Modal open={!!reportTarget} onClose={() => setReportTarget(null)} title={`Report "${reportTarget?.name}" Damaged`} size="sm">
        <div className="space-y-4">
          <Textarea label="What's wrong?" placeholder="e.g. Not cooling, making a loud noise, cracked" value={issueDescription} onChange={e => setIssueDescription(e.target.value)} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setReportTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={reportIssue.isPending} onClick={() => reportIssue.mutate()} disabled={!issueDescription.trim()}>
              <AlertTriangle size={14} /> Report Damage
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Fixed modal */}
      <Modal open={!!resolveTarget} onClose={() => setResolveTarget(null)} title={`Confirm "${resolveTarget?.asset.name}" Fixed`} size="sm">
        <div className="space-y-4">
          <Textarea label="Notes (optional)" placeholder="e.g. Technician replaced the part" value={fixNotes} onChange={e => setFixNotes(e.target.value)} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setResolveTarget(null)}>Cancel</Button>
            <Button variant="gold" loading={resolveIssue.isPending} onClick={() => resolveIssue.mutate()}>
              <CheckCircle2 size={14} /> Confirm Fixed
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
