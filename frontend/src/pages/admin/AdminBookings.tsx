import { useQuery } from '@tanstack/react-query'
import api from '@/utils/api'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { StatusBadge, PageSpinner, EmptyState } from '@/components/ui'
import { BedDouble } from 'lucide-react'
import type { Booking } from '@/types'

export default function AdminBookings() {
  const { data, isLoading } = useQuery<Booking[]>({ queryKey:['admin-bookings'], queryFn:()=>api.get('/bookings/').then(r=>r.data) })
  if (isLoading) return <PageSpinner />
  return (
    <div className="p-6 space-y-5">
      <div><h1 className="font-display text-3xl text-enayi-text">All Bookings</h1><p className="text-enayi-muted text-sm">{data?.length??0} total</p></div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-enayi-panel border-b border-enayi-border"><tr>{['Reference','Guest','Room','Check-in','Check-out','Amount','Status'].map(h=><th key={h} className="text-left px-4 py-3 text-enayi-muted text-xs font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-enayi-border">
            {(data||[]).length===0 ? <tr><td colSpan={7} className="text-center py-12 text-enayi-muted">No bookings found</td></tr>
            : (data||[]).map(b=>(
              <tr key={b.id} className="hover:bg-enayi-panel transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-enayi-gold">{b.booking_reference}</td>
                <td className="px-4 py-3 text-enayi-text">{b.guest_name}</td>
                <td className="px-4 py-3 text-enayi-muted">{b.room_detail?.room_number ?? '—'}</td>
                <td className="px-4 py-3 text-enayi-muted">{formatDate(b.check_in)}</td>
                <td className="px-4 py-3 text-enayi-muted">{formatDate(b.check_out)}</td>
                <td className="px-4 py-3 text-enayi-gold font-semibold">{formatCurrency(b.total_amount)}</td>
                <td className="px-4 py-3"><StatusBadge status={b.status}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
