import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BedDouble, Utensils, CalendarDays, Bot, Star, ArrowRight, Clock, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api from '@/utils/api'
import { formatCurrency, formatDate, getStatusBadge } from '@/utils/helpers'
import { StatusBadge, EmptyState } from '@/components/ui'
import type { Booking, Order } from '@/types'

const QUICK_ACTIONS = [
  { icon: BedDouble,    label: 'Book a Room',       href: '/book',       color: 'text-blue-400' },
  { icon: Utensils,     label: 'Order Food & Drinks',href: '/orders',     color: 'text-green-400' },
  { icon: CalendarDays, label: 'Book Event Hall',    href: '/events/book',color: 'text-purple-400' },
  { icon: Bot,          label: 'Chat with ARIA',     href: '/concierge',  color: 'text-enayi-gold' },
]

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { data: bookings } = useQuery<Booking[]>({
  queryKey: ['my-bookings'],
  queryFn: () => api.get('/bookings/my/').then(r => {
    const data = r.data
    return Array.isArray(data) ? data : (data?.results ?? [])
  })
})
  const { data: orders } = useQuery<Order[]>({
  queryKey: ['my-orders'],
  queryFn: () => api.get('/orders/my/').then(r => {
    const data = r.data
    return Array.isArray(data) ? data : (data?.results ?? [])
  })
})

  const activeBooking = bookings?.find(b => b.status === 'checked_in')
  const upcomingBookings = bookings?.filter(b => b.status === 'confirmed').slice(0, 2) ?? []
  const recentOrders = orders?.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').slice(0, 3) ?? []

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-gold p-6 rounded-2xl relative overflow-hidden">
        <div className="glow-orb w-64 h-64 -top-16 -right-16 opacity-20" />
        <div className="relative z-10">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-enayi-muted text-sm mb-1">Welcome back,</p>
              <h1 className="font-display text-3xl text-enayi-text">{user?.first_name} 👋</h1>
              <p className="text-enayi-muted text-sm mt-2">Enayi Hotels & Suites · Jos, Plateau State</p>
            </div>
            <div className="card px-5 py-3 text-center">
              <div className="flex items-center gap-1.5 mb-1"><Star size={14} className="text-enayi-gold fill-enayi-gold"/><span className="text-enayi-gold text-xs font-semibold">Loyalty Points</span></div>
              <div className="font-display text-2xl text-enayi-text">{user?.loyalty_points?.toLocaleString() ?? 0}</div>
            </div>
          </div>
          {activeBooking && (
            <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />
              <div>
                <p className="text-green-400 text-sm font-semibold">Currently Checked In — Room {activeBooking.room_detail?.room_number}</p>
                <p className="text-enayi-muted text-xs">Check-out: {formatDate(activeBooking.check_out)}</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map((a, i) => (
          <motion.div key={a.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Link to={a.href} className="card-hover p-5 flex flex-col items-center text-center gap-3 group block">
              <div className="w-12 h-12 rounded-xl bg-enayi-panel border border-enayi-border flex items-center justify-center group-hover:border-enayi-gold/30 transition-colors">
                <a.icon size={22} className={a.color} />
              </div>
              <span className="text-enayi-text text-sm font-medium leading-tight">{a.label}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Bookings */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading text-lg text-enayi-text flex items-center gap-2"><BedDouble size={18} className="text-enayi-gold"/> Upcoming Stays</h2>
            <Link to="/my-bookings" className="text-enayi-gold text-xs hover:underline">View all</Link>
          </div>
          {upcomingBookings.length === 0
            ? <EmptyState icon={BedDouble} title="No upcoming bookings" desc="Book a room for your next stay." action={<Link to="/book" className="btn-gold text-sm gap-2">Book Now <ArrowRight size={14}/></Link>} />
            : upcomingBookings.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-enayi-panel transition-colors mb-2">
                <div>
                  <p className="text-enayi-text text-sm font-semibold">{b.room_detail?.category_name ?? 'Room'}</p>
                  <p className="text-enayi-muted text-xs flex items-center gap-1 mt-0.5"><Clock size={10}/>{formatDate(b.check_in)} → {formatDate(b.check_out)}</p>
                  <p className="text-enayi-muted text-xs">{b.booking_reference}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={b.status} />
                  <p className="text-enayi-gold text-xs font-semibold mt-1">{formatCurrency(b.total_amount)}</p>
                </div>
              </div>
            ))
          }
        </div>

        {/* Recent Orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading text-lg text-enayi-text flex items-center gap-2"><Utensils size={18} className="text-enayi-gold"/> Active Orders</h2>
            <Link to="/orders" className="text-enayi-gold text-xs hover:underline">Order food</Link>
          </div>
          {recentOrders.length === 0
            ? <EmptyState icon={Utensils} title="No active orders" desc="Order food or drinks to your room." action={<Link to="/orders" className="btn-gold text-sm gap-2">Browse Menu <ArrowRight size={14}/></Link>} />
            : recentOrders.map(o => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-enayi-panel transition-colors mb-2">
                <div>
                  <p className="text-enayi-text text-sm font-semibold">{o.order_number}</p>
                  <p className="text-enayi-muted text-xs capitalize">{o.source.replace('_', ' ')} · {o.items.length} item{o.items.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={o.status} />
                  <p className="text-enayi-gold text-xs font-semibold mt-1">{formatCurrency(o.total_amount)}</p>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
