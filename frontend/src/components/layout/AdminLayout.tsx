import { Outlet, Link, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { LayoutDashboard, BedDouble, CalendarDays, Utensils, Users, Image, CreditCard, Calendar, ShieldCheck, ShieldAlert, Menu } from 'lucide-react'
import { cn } from '@/utils/helpers'
import { useAuthStore } from '@/store/authStore'

const ADMIN_NAV = [
  {href:'/admin',icon:LayoutDashboard,label:'Dashboard'},
  {href:'/admin/rooms',icon:BedDouble,label:'Rooms'},
  {href:'/admin/bookings',icon:CalendarDays,label:'Bookings'},
  {href:'/admin/checkout-approvals',icon:ShieldCheck,label:'Checkout Approvals',managerOnly:true},
  {href:'/admin/fraud-reports',icon:ShieldAlert,label:'Fraud Audit',managerOnly:true},
  {href:'/admin/orders',icon:Utensils,label:'Orders'},
  {href:'/admin/events',icon:Calendar,label:'Events'},
  {href:'/admin/guests',icon:Users,label:'Guests'},
  {href:'/admin/gallery',icon:Image,label:'Gallery'},
  {href:'/admin/payments',icon:CreditCard,label:'Payments'},
]

// Defined outside AdminLayout on purpose — a stable, module-level component
// so React never treats it as a brand-new type on re-render.
function AdminSidebarContent({ visibleNav, onNavigate }: {
  visibleNav: typeof ADMIN_NAV
  onNavigate: () => void
}) {
  return (
    <aside className="w-56 flex-shrink-0 flex flex-col h-full bg-enayi-surface border-r border-enayi-border">
      <div className="p-4 border-b border-enayi-border flex items-center gap-2.5">
        <img src="/logo.png" alt="Enayi" className="w-8 h-8 object-contain flex-shrink-0" />
        <div>
          <div className="font-display font-semibold text-enayi-text text-sm">Enayi Admin</div>
          <div className="text-enayi-gold text-xs">Hotel Management System</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
        {visibleNav.map(({href,icon:Icon,label}) => (
          <NavLink key={href} to={href} end={href === '/admin'} onClick={onNavigate}
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
  )
}

export default function AdminLayout() {
  const { user } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'
  const visibleNav = ADMIN_NAV.filter(item => !item.managerOnly || isManagerOrAdmin)
  const closeDrawer = () => setMobileOpen(false)

  return (
    <div className="flex h-screen bg-enayi-bg overflow-hidden">
      {/* Desktop sidebar — always visible md and up */}
      <div className="hidden md:flex flex-shrink-0 h-full">
        <AdminSidebarContent visibleNav={visibleNav} onNavigate={closeDrawer} />
      </div>

      {/* Mobile sidebar — ALWAYS rendered in the DOM below md, visibility
          toggled purely with CSS classes (no mount/unmount, no exit-animation
          race with route changes). A previous version used Framer Motion's
          AnimatePresence to mount/unmount this on open/close — when a route
          change landed in the same render pass as the drawer's exit
          animation, the animation could get interrupted and never actually
          finish, leaving the drawer stuck open forever even though the
          underlying page had already updated correctly. Plain CSS
          transitions driven directly by `mobileOpen` can't race like that. */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 md:hidden transition-opacity duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeDrawer}
      />
      <div
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 md:hidden transition-transform duration-300 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <AdminSidebarContent visibleNav={visibleNav} onNavigate={closeDrawer} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile-only top bar with hamburger — desktop has no header, sidebar is always visible */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 bg-enayi-surface border-b border-enayi-border flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 text-enayi-muted hover:text-enayi-gold transition-colors">
            <Menu size={20} />
          </button>
          <img src="/logo.png" alt="Enayi" className="w-6 h-6 object-contain flex-shrink-0" />
          <span className="font-display font-semibold text-enayi-text text-sm">Enayi Admin</span>
        </header>
        <main className="flex-1 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  )
}
