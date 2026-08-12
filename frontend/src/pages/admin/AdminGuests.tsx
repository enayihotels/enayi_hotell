import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/utils/api'
import { formatDate } from '@/utils/helpers'
import { PageSpinner, EmptyState, Badge, Input } from '@/components/ui'
import { Users, Search, Mail, Phone, Star } from 'lucide-react'
import type { User } from '@/types'

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

export default function AdminGuests() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery<User[]>({
    queryKey: ['admin-guests'],
    queryFn: () => api.get('/auth/guests/').then(r => unwrapList(r.data)),
  })

  const filtered = (data || []).filter(g => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return g.full_name?.toLowerCase().includes(q) || g.email?.toLowerCase().includes(q) || g.phone?.toLowerCase().includes(q)
  })

  if (isLoading) return <PageSpinner />

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-enayi-text">Guests</h1>
        <p className="text-enayi-muted text-sm">{data?.length ?? 0} registered guests</p>
      </div>

      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-enayi-muted" />
        <Input
          placeholder="Search by name, email, or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center"><EmptyState icon={Users} title={search ? 'No matching guests' : 'No guests yet'} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(g => (
            <div key={g.id} className="card p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-enayi-text font-medium">{g.full_name}</div>
                  <div className="text-enayi-muted text-xs">Joined {formatDate(g.date_joined)}</div>
                </div>
                {g.is_verified
                  ? <Badge variant="green">Verified</Badge>
                  : <Badge variant="gray">Unverified</Badge>}
              </div>
              <div className="space-y-1 text-xs text-enayi-muted">
                <div className="flex items-center gap-1.5"><Mail size={12} className="flex-shrink-0" /> {g.email}</div>
                {g.phone && <div className="flex items-center gap-1.5"><Phone size={12} className="flex-shrink-0" /> {g.phone}</div>}
              </div>
              <div className="flex items-center gap-1.5 pt-1 border-t border-enayi-border text-enayi-gold text-sm font-semibold">
                <Star size={13} /> {g.loyalty_points} pts
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
