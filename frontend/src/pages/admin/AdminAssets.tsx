import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { formatDateTime } from '@/utils/helpers'
import { PageSpinner, EmptyState, Button, Modal, Input, Textarea, Select, Badge } from '@/components/ui'
import { Wrench, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import type { PropertyAsset } from '@/types'

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

const CATEGORIES = [
  { value: 'appliance', label: 'Appliance (AC, TV, Fridge...)' },
  { value: 'electrical', label: 'Electrical (Socket, Switch, Wiring...)' },
  { value: 'plumbing', label: 'Plumbing (Tap, Shower, Toilet...)' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'fixture', label: 'Fixture (Light, Fan, Door, Window...)' },
  { value: 'other', label: 'Other' },
]

const STATUS_BADGE: Record<string, 'green' | 'red' | 'gold' | 'gray'> = {
  working: 'green', broken: 'red', under_repair: 'gold', decommissioned: 'gray',
}

type AssetForm = { name: string; category: string; roomMode: 'room' | 'common'; room: string; location_note: string; serial_number: string; notes: string }
const emptyAssetForm: AssetForm = { name: '', category: 'appliance', roomMode: 'common', room: '', location_note: '', serial_number: '', notes: '' }

export default function AdminAssets() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'all' | 'broken' | 'working'>('all')

  const { data: assets, isLoading } = useQuery<PropertyAsset[]>({
    queryKey: ['property-assets'],
    queryFn: () => api.get('/assets/').then(r => unwrapList(r.data)),
  })
  const { data: rooms } = useQuery<any[]>({
    queryKey: ['admin-rooms-for-assets'],
    queryFn: () => api.get('/rooms/list/').then(r => unwrapList(r.data)),
  })

  // ── Asset CRUD ──
  const [assetModalOpen, setAssetModalOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<PropertyAsset | null>(null)
  const [form, setForm] = useState<AssetForm>(emptyAssetForm)

  const openNewAsset = () => { setEditingAsset(null); setForm(emptyAssetForm); setAssetModalOpen(true) }
  const openEditAsset = (a: PropertyAsset) => {
    setEditingAsset(a)
    setForm({
      name: a.name, category: a.category, roomMode: a.room ? 'room' : 'common',
      room: a.room || '', location_note: a.location_note, serial_number: a.serial_number, notes: a.notes,
    })
    setAssetModalOpen(true)
  }

  const saveAsset = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name, category: form.category, serial_number: form.serial_number, notes: form.notes,
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
      toast.success(`${reportTarget!.name} marked broken.`)
      setReportTarget(null); setIssueDescription('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  // ── Resolve issue ──
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

  const filteredAssets = (assets || []).filter(a => statusFilter === 'all' || a.status === statusFilter)
  const brokenCount = (assets || []).filter(a => a.status === 'broken').length

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-enayi-text">Property & Assets</h1>
          <p className="text-enayi-muted text-sm">Every appliance and fixture across the hotel — AC units, TVs, fans, sockets, taps, and more.</p>
        </div>
        <Button variant="gold" onClick={openNewAsset}><Plus size={14} /> Add Asset</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter==='all' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          All ({(assets||[]).length})
        </button>
        <button onClick={() => setStatusFilter('broken')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter==='broken' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          <AlertTriangle size={14} className="inline mr-1.5 -mt-0.5" /> Broken ({brokenCount})
        </button>
        <button onClick={() => setStatusFilter('working')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter==='working' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          Working
        </button>
      </div>

      {filteredAssets.length === 0 ? (
        <div className="card p-12 text-center"><EmptyState icon={Wrench} title="No assets yet" desc="Add your first one to get started." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map(a => (
            <div key={a.id} className="card p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-enayi-text font-medium">{a.name}</div>
                  <div className="text-enayi-muted text-xs">{a.where} · {CATEGORIES.find(c=>c.value===a.category)?.label.split(' (')[0]}</div>
                </div>
                <Badge variant={STATUS_BADGE[a.status]}>{a.status.replace('_',' ')}</Badge>
              </div>
              {a.open_issue && (
                <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/20 rounded-lg p-2">
                  <div className="flex items-center gap-1 font-medium"><AlertTriangle size={11} /> {a.open_issue.issue_description}</div>
                  <div className="text-enayi-muted mt-0.5">Reported by {a.open_issue.reported_by_name} · {formatDateTime(a.open_issue.reported_at)}</div>
                </div>
              )}
              <div className="flex gap-2 pt-1 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => openEditAsset(a)}><Pencil size={12} /> Edit</Button>
                <Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete "${a.name}"?`)) deleteAsset.mutate(a.id) }}><Trash2 size={12} /> Delete</Button>
                {a.status === 'working' ? (
                  <Button size="sm" variant="danger" onClick={() => { setReportTarget(a); setIssueDescription('') }}><AlertTriangle size={12} /> Report Broken</Button>
                ) : a.open_issue && (
                  <Button size="sm" variant="surface" onClick={() => { setResolveTarget({ asset: a, issueId: a.open_issue!.id }); setFixNotes('') }}><CheckCircle2 size={12} /> Mark Fixed</Button>
                )}
              </div>
              {a.issue_reports.length > 0 && (
                <details className="text-xs">
                  <summary className="text-enayi-muted cursor-pointer flex items-center gap-1"><Clock size={11} /> History ({a.issue_reports.length})</summary>
                  <div className="mt-2 space-y-1.5 pl-3 border-l border-enayi-border">
                    {a.issue_reports.map(r => (
                      <div key={r.id} className="text-enayi-muted">
                        <span className={r.status === 'fixed' ? 'text-green-400' : 'text-red-400'}>{r.status}</span>: {r.issue_description}
                        {r.status === 'fixed' && r.fixed_by_name && ` — fixed by ${r.fixed_by_name}`}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Asset modal */}
      <Modal open={assetModalOpen} onClose={() => setAssetModalOpen(false)} title={editingAsset ? 'Edit Asset' : 'Add Asset'} size="sm">
        <div className="space-y-4">
          <Input label="Name" placeholder="e.g. Split AC Unit" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
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
