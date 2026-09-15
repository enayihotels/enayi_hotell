import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { PageSpinner, EmptyState, Button, Badge } from '@/components/ui'
import { UserCog, Power, Inbox, Check, X, Clock } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import type { User, AccessRequest } from '@/types'

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])
const ROLE_LABELS: Record<string, string> = {
  staff: 'Front Desk Staff', bar_staff: 'Bar Staff', kitchen_staff: 'Kitchen Staff', housekeeper: 'Housekeeper',
}

export default function AdminStaffDuty() {
  const { user: me } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'staff' | 'requests'>('staff')

  const { data: staff, isLoading: staffLoading } = useQuery<User[]>({
    queryKey: ['admin-staff-duty'], queryFn: () => api.get('/auth/staff/').then(r => unwrapList(r.data)),
  })
  const { data: requests, isLoading: requestsLoading } = useQuery<AccessRequest[]>({
    queryKey: ['access-requests'], queryFn: () => api.get('/auth/access-requests/').then(r => unwrapList(r.data)),
  })

  const toggleDuty = useMutation({
    mutationFn: ({ id, isOnDuty }: { id: string; isOnDuty: boolean }) =>
      api.post(`/auth/staff/${id}/duty/`, { is_on_duty: isOnDuty }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-staff-duty'] })
      toast.success(res.data?.message || 'Updated.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const decideRequest = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api.post(`/auth/access-requests/${id}/decide/`, { approve }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['access-requests'] })
      qc.invalidateQueries({ queryKey: ['admin-staff-duty'] })
      toast.success(res.data?.message || 'Done.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const shiftStaff = (staff || []).filter(s => s.is_shift_role)
  const pendingRequests = (requests || []).filter(r => r.status === 'pending')
  const decidedRequests = (requests || []).filter(r => r.status !== 'pending').slice(0, 10)

  if (staffLoading) return <PageSpinner />

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-enayi-text">Staff Duty</h1>
        <p className="text-enayi-muted text-sm">
          Control who can sign in right now — Front Desk, Bar Staff, Kitchen Staff, and Housekeeper only.
          {me?.role === 'manager' && ' Scoped to your own branch.'}
        </p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('staff')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab==='staff' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          <UserCog size={14} className="inline mr-1.5 -mt-0.5" /> Staff ({shiftStaff.length})
        </button>
        <button onClick={() => setTab('requests')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all relative ${tab==='requests' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          <Inbox size={14} className="inline mr-1.5 -mt-0.5" /> Access Requests
          {pendingRequests.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">{pendingRequests.length}</span>
          )}
        </button>
      </div>

      {tab === 'staff' && (
        shiftStaff.length === 0 ? (
          <div className="card p-12 text-center"><EmptyState icon={UserCog} title="No shift-role staff yet" desc="Front Desk, Bar, Kitchen, and Housekeeper accounts will show up here once added." /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shiftStaff.map(s => (
              <div key={s.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-enayi-text font-medium">{s.full_name}</div>
                    <div className="text-enayi-muted text-xs">{ROLE_LABELS[s.role] ?? s.role}{s.hotel_name ? ` · ${s.hotel_name}` : ''}</div>
                  </div>
                  <Badge variant={s.is_on_duty ? 'green' : 'red'}>{s.is_on_duty ? 'On Duty' : 'Off Duty'}</Badge>
                </div>
                <div className="text-enayi-muted text-xs">{s.email}</div>
                <Button
                  size="sm"
                  variant={s.is_on_duty ? 'danger' : 'gold'}
                  className="w-full"
                  loading={toggleDuty.isPending}
                  onClick={() => toggleDuty.mutate({ id: s.id, isOnDuty: !s.is_on_duty })}
                >
                  <Power size={13} /> Switch {s.is_on_duty ? 'Off' : 'On'} Duty
                </Button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'requests' && (
        requestsLoading ? <PageSpinner /> : (
          <div className="space-y-6">
            <div>
              <h2 className="text-enayi-text font-medium text-sm mb-3">Pending ({pendingRequests.length})</h2>
              {pendingRequests.length === 0 ? (
                <div className="card p-8 text-center"><EmptyState icon={Inbox} title="Nothing pending" desc="Access requests from off-duty staff will show up here." /></div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map(r => (
                    <div key={r.id} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-enayi-text font-medium">{r.user_name}</div>
                        <div className="text-enayi-muted text-xs">{ROLE_LABELS[r.user_role] ?? r.user_role}{r.hotel_name ? ` · ${r.hotel_name}` : ''} · {r.user_email}</div>
                        {r.note && <div className="text-enayi-muted text-xs italic mt-1">"{r.note}"</div>}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="danger" loading={decideRequest.isPending} onClick={() => decideRequest.mutate({ id: r.id, approve: false })}>
                          <X size={13} /> Deny
                        </Button>
                        <Button size="sm" variant="gold" loading={decideRequest.isPending} onClick={() => decideRequest.mutate({ id: r.id, approve: true })}>
                          <Check size={13} /> Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {decidedRequests.length > 0 && (
              <div>
                <h2 className="text-enayi-text font-medium text-sm mb-3 flex items-center gap-1.5"><Clock size={13} /> Recently decided</h2>
                <div className="space-y-2">
                  {decidedRequests.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-3 text-sm px-4 py-2.5 rounded-xl bg-enayi-surface border border-enayi-border">
                      <span className="text-enayi-text">{r.user_name}</span>
                      <span className="text-enayi-muted text-xs">
                        <Badge variant={r.status === 'approved' ? 'green' : 'red'}>{r.status}</Badge>
                        {r.decided_by_name ? ` by ${r.decided_by_name}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}
