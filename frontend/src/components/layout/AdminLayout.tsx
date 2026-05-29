import { Outlet, Link, NavLink } from 'react-router-dom'
import { LayoutDashboard, BedDouble, CalendarDays, Utensils, Users, Image, CreditCard, Calendar } from 'lucide-react'
import { cn } from '@/utils/helpers'

const ADMIN_NAV = [
  {href:'/admin',icon:LayoutDashboard,label:'Dashboard'},
  {href:'/admin/rooms',icon:BedDouble,label:'Rooms'},
  {href:'/admin/bookings',icon:CalendarDays,label:'Bookings'},
  {href:'/admin/orders',icon:Utensils,label:'Orders'},
  {href:'/admin/events',icon:Calendar,label:'Events'},
  {href:'/admin/guests',icon:Users,label:'Guests'},
  {href:'/admin/gallery',icon:Image,label:'Gallery'},
  {href:'/admin/payments',icon:CreditCard,label:'Payments'},
]

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-enayi-bg overflow-hidden">
      <aside className="w-56 flex-shrink-0 flex flex-col bg-enayi-surface border-r border-enayi-border">
        <div className="p-4 border-b border-enayi-border flex items-center gap-2.5">
          <img src="/logo.jpg" alt="Enayi" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
          <div>
            <div className="font-display font-semibold text-enayi-text text-sm">Enayi Admin</div>
            <div className="text-enayi-gold text-xs">Hotel Management System</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
          {ADMIN_NAV.map(({href,icon:Icon,label}) => (
            <NavLink key={href} to={href} end={href === '/admin'}
              className={({isActive}) => cn('flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all',
                isActive ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text hover:bg-enayi-panel'
              )}>
              <Icon size={16} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-enayi-border">
          <Link to="/" className="btn-ghost w-full text-xs">← Main Website</Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto"><Outlet /></main>
    </div>
  )
}
