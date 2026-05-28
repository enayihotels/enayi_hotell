import { useQuery } from '@tanstack/react-query'
import { BedDouble, Users, CreditCard, TrendingUp, ShoppingBag, Calendar, ArrowUp, ArrowDown } from 'lucide-react'
import api from '@/utils/api'
import { formatCurrency } from '@/utils/helpers'
import { PageSpinner } from '@/components/ui'
import type { DashboardStats } from '@/types'

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({ queryKey:['dashboard-stats'], queryFn:()=>api.get('/dashboard/stats/').then(r=>r.data), refetchInterval:60000 })
  if (isLoading) return <PageSpinner />
  if (!stats) return <div className="p-8 text-enayi-muted">Unable to load stats.</div>
  const statCards = [
    {label:'Occupancy Rate',value:`${stats.rooms.occupancy_rate}%`,sub:`${stats.rooms.occupied}/${stats.rooms.total} rooms`,icon:BedDouble,color:'text-blue-400'},
    {label:'Revenue (Month)',value:formatCurrency(stats.revenue.this_month),sub:`${stats.revenue.growth_pct>=0?'+':''}${stats.revenue.growth_pct}% vs last month`,icon:CreditCard,color:'text-enayi-gold'},
    {label:'Active Guests',value:stats.bookings.active_guests,sub:`${stats.bookings.today_checkins} check-ins today`,icon:Users,color:'text-green-400'},
    {label:'Pending Orders',value:stats.orders.pending,sub:`${stats.orders.this_month} this month`,icon:ShoppingBag,color:'text-purple-400'},
    {label:'Today Revenue',value:formatCurrency(stats.revenue.today),sub:`${stats.bookings.today_checkouts} check-outs`,icon:TrendingUp,color:'text-enayi-gold'},
    {label:'Upcoming Events',value:stats.events.upcoming,sub:`${stats.guests.new_this_month} new guests`,icon:Calendar,color:'text-pink-400'},
  ]
  return (
    <div className="p-6 space-y-6">
      <div><h1 className="font-display text-3xl text-enayi-text">Dashboard</h1><p className="text-enayi-muted text-sm mt-1">Enayi Hotels & Suites · Live Overview</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map(s=>(
          <div key={s.label} className="card-hover p-5">
            <div className="flex items-center justify-between mb-3"><span className="text-enayi-muted text-xs">{s.label}</span><div className={`w-8 h-8 rounded-lg bg-enayi-panel flex items-center justify-center`}><s.icon size={16} className={s.color}/></div></div>
            <div className={`font-display text-3xl ${s.color} mb-1`}>{s.value}</div>
            <div className="text-enayi-muted text-xs">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[{label:'Available',v:stats.rooms.available,c:'text-green-400'},{label:'Occupied',v:stats.rooms.occupied,c:'text-red-400'},{label:'Maintenance',v:stats.rooms.maintenance,c:'text-yellow-400'},{label:'Pending Bookings',v:stats.bookings.pending,c:'text-enayi-gold'}].map(r=>(
          <div key={r.label} className="card p-4 text-center"><div className={`font-display text-2xl ${r.c}`}>{r.v}</div><div className="text-enayi-muted text-xs mt-1">{r.label}</div></div>
        ))}
      </div>
    </div>
  )
}
