import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { formatDateTime } from '@/utils/helpers'
import { PageSpinner, EmptyState, Button, Modal, Input, Textarea, Select, Badge } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { Wrench, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, XCircle, ShieldCheck, Clock } from 'lucide-react'
import type { PropertyAsset } from '@/types'

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

const CATEGORIES = [
  { value: 'appliance', label: 'Appliance (AC, TV, Fridge...)' },
  { value: 'electrical', label: 'Electrical (Socket, Switch, Wiring...)' },
  { value: 'plumbing', label: 'Plumbing (Tap, Shower, Toilet...)' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'fixture', label: 'Fixture (Light, Fan, Door, Window...)' },
  { value: 'linen', label: 'Linen / Soft Furnishing (Pillow, Duvet, Curtain...)' },
  { value: 'other', label: 'Other' },
]

const DEPARTMENTS = [
  { value: 'shared', label: 'Shared / Common Area — central only' },
  { value: 'frontdesk', label: 'Front Desk' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bar', label: 'Bar' },
  { value: 'housekeeping', label: 'Housekeeping (incl. all guest rooms)' },
]

const STATUS_BADGE: Record<string, 'green' | 'red' | 'gold' | 'gray'> = {
  working: 'green', broken: 'red', under_repair: 'gold', decommissioned: 'gray',
}

const ISSUE_STATUS_BADGE: Record<string, 'red' | 'gold' | 'gray' | 'green'> = {
  reported: 'red', cleared_for_repair: 'gold', rejected: 'gray', fixed: 'green',
}

type AssetForm = { name: string; category: string; department: string; quantity: string; roomMode: 'room' | 'common'; room: string; location_note: string; serial_number: string; notes: string }
const emptyAssetForm: AssetForm = { name: '', category: 'appliance', department: 'shared', quantity: '1', roomMode: 'common', room: '', location_note: '', serial_number: '' , notes: '' }

const DEPT_LABELS: Record<string, string> = {
  shared: '🏨 Common Areas', frontdesk: '🖥️ Front Desk', kitchen: '🍳 Kitchen', bar: '🍸 Bar', housekeeping: '🛏️ Housekeeping',
}

export default function AdminAssets() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'admin'
  const canClearOrReject = user?.role === 'manager' || user?.role === 'admin'
  const canAddOrDelete   = user?.role === 'manager' || user?.role === 'admin'

  const [statusFilter, setStatusFilter] = useState<'all' | 'broken' | 'working' | 'awaiting_review'>('all')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')

  // Only the Owner operates across every branch — Manager/Front Desk are
  // already scoped server-side to their own account's branch, so this
  // selector only ever renders for Admin. Same pattern as AdminInventory.
  const [hotelFilter, setHotelFilter] = useState<string>('')

  const { data: hotels } = useQuery<any[]>({
    queryKey: ['hotels-for-assets'],
    queryFn: () => api.get('/hotels/').then(r => unwrapList(r.data)),
    enabled: isAdmin,
  })

  useEffect(() => {
    if (isAdmin && !hotelFilter && hotels && hotels.length > 0) {
      setHotelFilter(hotels[0].id)
    }
  }, [isAdmin, hotelFilter, hotels])

  const { data: assets, isLoading } = useQuery<PropertyAsset[]>({
    queryKey: ['property-assets', hotelFilter],
    queryFn: () => api.get('/assets/', { params: isAdmin && hotelFilter ? { hotel: hotelFilter } : {} }).then(r => unwrapList(r.data)),
  })
  const { data: rooms } = useQuery<any[]>({
    queryKey: ['admin-rooms-for-assets', hotelFilter],
    queryFn: () => api.get('/rooms/list/', { params: isAdmin && hotelFilter ? { hotel: hotelFilter } : {} }).then(r => unwrapList(r.data)),
  })

  // ── Asset CRUD ──
  const [assetModalOpen, setAssetModalOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<PropertyAsset | null>(null)
  const [form, setForm] = useState<AssetForm>(emptyAssetForm)

  const openNewAsset = () => { setEditingAsset(null); setForm(emptyAssetForm); setAssetModalOpen(true) }
  const openEditAsset = (a: PropertyAsset) => {
    setEditingAsset(a)
    setForm({
      name: a.name, category: a.category, department: a.department, quantity: String(a.quantity),
      roomMode: a.room ? 'room' : 'common',
      room: a.room || '', location_note: a.location_note, serial_number: a.serial_number, notes: a.notes,
    })
    setAssetModalOpen(true)
  }

  const saveAsset = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name, category: form.category, department: form.department,
        quantity: Number(form.quantity) || 1,
        serial_number: form.serial_number, notes: form.notes,
        room: form.roomMode === 'room' ? form.room : null,
        location_note: form.roomMode === 'common' ? form.location_note : '',
      }
      return editingAsset ? api.patch(`/assets/${editingAsset.id}/`, payload) : api.post('/assets/', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-assets'] })
      toast.success(editingAsset ? 'Asset updated.' : 'Asset added.')
      setAssetModalOpen(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteAsset = useMutation({
    mutationFn: (id: string) => api.delete(`/assets/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['property-assets'] }); toast.success('Asset deleted.') },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  // ── Report issue ──
  const [reportTarget, setReportTarget] = useState<PropertyAsset | null>(null)
  const [issueDescription, setIssueDescription] = useState('')

  const reportIssue = useMutation({
    mutationFn: () => api.post(`/assets/${reportTarget!.id}/report-issue/`, { issue_description: issueDescription }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-assets'] })
      toast.success(`${reportTarget!.name} marked broken — awaiting Manager/Owner review.`)
      setReportTarget(null); setIssueDescription('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  // ── Clear / Reject (Manager/Owner approval gate) ──
  const [clearanceTarget, setClearanceTarget] = useState<{ asset: PropertyAsset; issueId: string; action: 'clear' | 'reject' } | null>(null)
  const [clearanceNote, setClearanceNote] = useState('')

  const decideClearance = useMutation({
    mutationFn: () => api.post(`/assets/issues/${clearanceTarget!.issueId}/${clearanceTarget!.action}/`, { clearance_note: clearanceNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-assets'] })
      toast.success(clearanceTarget!.action === 'clear' ? `${clearanceTarget!.asset.name} cleared for repair.` : `${clearanceTarget!.asset.name}'s report rejected.`)
      setClearanceTarget(null); setClearanceNote('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  // ── Resolve issue (mark fixed) ──
  const [resolveTarget, setResolveTarget] = useState<{ asset: PropertyAsset; issueId: string } | null>(null)
  const [fixNotes, setFixNotes] = useState('')

  const resolveIssue = useMutation({
    mutationFn: () => api.post(`/assets/issues/${resolveTarget!.issueId}/resolve/`, { fix_notes: fixNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-assets'] })
      toast.success(`${resolveTarget!.asset.name} marked fixed.`)
      setResolveTarget(null); setFixNotes('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (isLoading) return <PageSpinner />

  const brokenCount = (assets || []).filter(a => a.status === 'broken').length
  const awaitingReviewCount = (assets || []).filter(a => a.open_issue?.status === 'reported').length

  // Filter first by status/review, then by department segment
  const segmentFiltered = (assets || []).filter(a => {
    if (statusFilter === 'awaiting_review') return a.open_issue?.status === 'reported'
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (departmentFilter !== 'all' && a.department !== departmentFilter) return false
    return true
  })

  // Group by physical location within the selected segment — Rooms first,
  // then common areas alphabetically. Rooms sort numerically ("Room 2"
  // before "Room 10") rather than lexicographically.
  const grouped = new Map<string, PropertyAsset[]>()
  for (const a of segmentFiltered) {
    const key = a.where
    const list = grouped.get(key) || []
    list.push(a)
    grouped.set(key, list)
  }
  const sortedLocations = Array.from(grouped.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  )

  // Which departments actually have assets, for the segment picker
  const activeDepartments = [...new Set((assets || []).map(a => a.department))].sort()

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-enayi-text">Property & Assets</h1>
          <p className="text-enayi-muted text-sm">Every appliance, fixture, and room item across the hotel — the central place everything lives.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && hotels && hotels.length > 0 && (
            <Select value={hotelFilter} onChange={e => setHotelFilter(e.target.value)} className="max-w-[220px]">
              {hotels.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </Select>
          )}
          {canAddOrDelete && <Button variant="gold" onClick={openNewAsset}><Plus size={14} /> Add Asset</Button>}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter==='all' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          All ({(assets||[]).length})
        </button>
        {canClearOrReject && (
          <button onClick={() => setStatusFilter('awaiting_review')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter==='awaiting_review' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
            <ShieldCheck size={14} className="inline mr-1.5 -mt-0.5" /> Awaiting Review ({awaitingReviewCount})
          </button>
        )}
        <button onClick={() => setStatusFilter('broken')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter==='broken' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          <AlertTriangle size={14} className="inline mr-1.5 -mt-0.5" /> Broken ({brokenCount})
        </button>
        <button onClick={() => setStatusFilter('working')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter==='working' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          Working
        </button>
      </div>

      {/* Department/segment picker — makes 292 items navigable instead of one wall of cards */}
      {statusFilter !== 'awaiting_review' && activeDepartments.length > 1 && (
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-enayi-muted text-xs mr-1">Segment:</span>
          <button onClick={() => setDepartmentFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${departmentFilter==='all' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'card text-enayi-muted hover:text-enayi-gold'}`}>
            All ({(assets||[]).length})
          </button>
          {activeDepartments.map(d => (
            <button key={d} onClick={() => setDepartmentFilter(departmentFilter === d ? 'all' : d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${departmentFilter===d ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'card text-enayi-muted hover:text-enayi-gold'}`}>
              {DEPT_LABELS[d] ?? d} ({(assets||[]).filter(a => a.department === d).length})
            </button>
          ))}
        </div>
      )}

      {segmentFiltered.length === 0 ? (
        <div className="card p-12 text-center"><EmptyState icon={Wrench} title="No assets here" desc="Nothing matches this filter yet." /></div>
      ) : (
        // Group by location — rooms first, then common areas
        sortedLocations.map(where => (
          <div key={where} className="space-y-3">
            <h2 className="font-heading text-base text-enayi-text border-b border-enayi-border pb-2">
              {where} <span className="text-enayi-muted text-sm font-normal">({grouped.get(where)!.length} item{grouped.get(where)!.length === 1 ? '' : 's'})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {grouped.get(where)!.map(a => (
            <div key={a.id} className="card p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-enayi-text font-medium">{a.quantity > 1 ? `${a.quantity}× ` : ''}{a.name}</div>
                  <div className="text-enayi-muted text-xs">{a.category_display?.split(' (')[0] ?? a.category}</div>
                  {departmentFilter === 'all' && <div className="text-enayi-muted text-[11px]">{DEPT_LABELS[a.department] ?? a.department_display}{isAdmin ? ` · ${a.hotel_name}` : ''}</div>}
                </div>
                <Badge variant={STATUS_BADGE[a.status]}>{a.status.replace('_',' ')}</Badge>
              </div>
              {a.open_issue && (
                <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/20 rounded-lg p-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 font-medium"><AlertTriangle size={11} /> {a.open_issue.issue_description}</span>
                    <Badge variant={ISSUE_STATUS_BADGE[a.open_issue.status]}>{a.open_issue.status_display}</Badge>
                  </div>
                  <div className="text-enayi-muted">Reported by {a.open_issue.reported_by_name} · {formatDateTime(a.open_issue.reported_at)}</div>
                  {a.open_issue.status === 'cleared_for_repair' && a.open_issue.cleared_by_name && (
                    <div className="text-enayi-muted">Cleared by {a.open_issue.cleared_by_name} · {a.open_issue.clearance_note}</div>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-1 flex-wrap">
                {canAddOrDelete && <Button size="sm" variant="outline" onClick={() => openEditAsset(a)}><Pencil size={12} /> Edit</Button>}
                {canAddOrDelete && <Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete "${a.name}"?`)) deleteAsset.mutate(a.id) }}><Trash2 size={12} /> Delete</Button>}
                {a.status === 'working' && (
                  <Button size="sm" variant="danger" onClick={() => { setReportTarget(a); setIssueDescription('') }}><AlertTriangle size={12} /> Report Broken</Button>
                )}
                {canClearOrReject && a.open_issue?.status === 'reported' && (
                  <>
                    <Button size="sm" variant="gold" onClick={() => { setClearanceTarget({ asset: a, issueId: a.open_issue!.id, action: 'clear' }); setClearanceNote('') }}>
                      <ShieldCheck size={12} /> Clear for Repair
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setClearanceTarget({ asset: a, issueId: a.open_issue!.id, action: 'reject' }); setClearanceNote('') }}>
                      <XCircle size={12} /> Reject
                    </Button>
                  </>
                )}
                {a.open_issue?.status === 'cleared_for_repair' && (
                  <Button size="sm" variant="surface" onClick={() => { setResolveTarget({ asset: a, issueId: a.open_issue!.id }); setFixNotes('') }}>
                    <CheckCircle2 size={12} /> Mark Fixed
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
                        {r.status === 'fixed' && r.fixed_by_name && ` — fixed by ${r.fixed_by_name}`}
                        {r.status === 'rejected' && r.cleared_by_name && ` — rejected by ${r.cleared_by_name}`}
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

      {/* Add/Edit Asset modal */}
      <Modal open={assetModalOpen} onClose={() => setAssetModalOpen(false)} title={editingAsset ? 'Edit Asset' : 'Add Asset'} size="sm">
        <div className="space-y-4">
          <Input label="Name" placeholder="e.g. Split AC Unit, Pillow" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <Input label="Quantity" type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <Select label="Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
            {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </Select>
          <div className="flex gap-2">
            <button onClick={() => setForm({ ...form, roomMode: 'room' })} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${form.roomMode==='room' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'card text-enayi-muted'}`}>Tied to a room</button>
            <button onClick={() => setForm({ ...form, roomMode: 'common' })} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${form.roomMode==='common' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'card text-enayi-muted'}`}>Common area</button>
          </div>
          {form.roomMode === 'room' ? (
            <Select label="Room" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })}>
              <option value="">Select a room</option>
              {(rooms || []).map((r: any) => <option key={r.id} value={r.id}>Room {r.room_number}{r.branch_name ? ` · ${r.branch_name}` : ''}</option>)}
            </Select>
          ) : (
            <Input label="Location" placeholder="e.g. Main Lobby, 2nd Floor Corridor" value={form.location_note} onChange={e => setForm({ ...form, location_note: e.target.value })} />
          )}
          <Input label="Serial number (optional)" value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} />
          <Textarea label="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setAssetModalOpen(false)}>Cancel</Button>
            <Button variant="gold" loading={saveAsset.isPending} onClick={() => saveAsset.mutate()} disabled={!form.name || (form.roomMode === 'room' ? !form.room : !form.location_note)}>
              {editingAsset ? 'Save changes' : 'Create Asset'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Report Broken modal */}
      <Modal open={!!reportTarget} onClose={() => setReportTarget(null)} title={`Report "${reportTarget?.name}" Broken`} size="sm">
        <div className="space-y-4">
          <Textarea label="What's wrong?" placeholder="e.g. AC not cooling, making loud noise" value={issueDescription} onChange={e => setIssueDescription(e.target.value)} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setReportTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={reportIssue.isPending} onClick={() => reportIssue.mutate()} disabled={!issueDescription.trim()}>
              <AlertTriangle size={14} /> Mark Broken
            </Button>
          </div>
        </div>
      </Modal>

      {/* Clear / Reject modal */}
      <Modal open={!!clearanceTarget} onClose={() => setClearanceTarget(null)} title={clearanceTarget?.action === 'clear' ? `Clear "${clearanceTarget?.asset.name}" for Repair` : `Reject "${clearanceTarget?.asset.name}"'s Report`} size="sm">
        <div className="space-y-4">
          <Textarea
            label={clearanceTarget?.action === 'clear' ? 'Clearance note (optional)' : 'Why reject this? (optional)'}
            placeholder={clearanceTarget?.action === 'clear' ? 'e.g. Approved — call the AC technician' : 'e.g. False alarm, already fixed'}
            value={clearanceNote} onChange={e => setClearanceNote(e.target.value)}
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setClearanceTarget(null)}>Cancel</Button>
            <Button variant={clearanceTarget?.action === 'clear' ? 'gold' : 'danger'} loading={decideClearance.isPending} onClick={() => decideClearance.mutate()}>
              {clearanceTarget?.action === 'clear' ? <><ShieldCheck size={14} /> Confirm Clearance</> : <><XCircle size={14} /> Confirm Rejection</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mark Fixed modal */}
      <Modal open={!!resolveTarget} onClose={() => setResolveTarget(null)} title={`Mark "${resolveTarget?.asset.name}" Fixed`} size="sm">
        <div className="space-y-4">
          <Textarea label="Fix notes (optional)" placeholder="e.g. Refilled gas, replaced fan motor" value={fixNotes} onChange={e => setFixNotes(e.target.value)} />
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
