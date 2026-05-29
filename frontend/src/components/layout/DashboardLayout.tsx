import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, BedDouble, Utensils, CalendarDays, Bot, User, LogOut, Menu, Home, CreditCard } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import { cn } from '@/utils/helpers'

const NAV = [
  { href:'/dashboard',    icon:LayoutDashboard, label:'Dashboard' },
  { href:'/my-bookings',  icon:BedDouble,       label:'My Bookings' },
  { href:'/orders',       icon:Utensils,        label:'Food & Bar' },
  { href:'/events/book',  icon:CalendarDays,    label:'Book Event' },
  { href:'/events/my',    icon:CalendarDays,    label:'My Events' },
  { href:'/payment/callback', icon:CreditCard,  label:'Payments' },
  { href:'/concierge',    icon:Bot,             label:'ARIA Concierge' },
  { href:'/profile',      icon:User,            label:'My Profile' },
]

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await api.post('/auth/logout/', { refresh: localStorage.getItem('refresh_token') }) } catch {}
    logout(); toast.success('Logged out.'); navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-enayi-surface border-r border-enayi-border">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-enayi-border">
        <img src="/logo.jpg" alt="Enayi Hotels" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
        {!collapsed && <div><div className="font-display font-semibold text-enayi-text text-sm">Enayi Hotels</div><div className="text-enayi-muted text-[10px]">Guest Portal</div></div>}
      </div>
      <nav className="flex-1 py-4 px-2 flex flex-col gap-0.5 overflow-y-auto scrollbar-hide">
        {NAV.map(({href,icon:Icon,label}) => (
          <NavLink key={href} to={href} onClick={() => setMobileOpen(false)}
            className={({isActive}) => cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              isActive ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text hover:bg-enayi-panel',
              collapsed && 'justify-center'
            )}>
            <Icon size={17} className="flex-shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-enayi-border">
        {!collapsed && <div className="flex items-center gap-3 px-3 py-2 mb-1"><div className="w-8 h-8 rounded-full bg-enayi-gold/20 flex items-center justify-center flex-shrink-0"><span className="text-enayi-gold font-semibold text-sm">{user?.first_name?.[0]}</span></div><div className="overflow-hidden"><div className="text-enayi-text text-sm font-medium truncate">{user?.full_name}</div><div className="text-enayi-muted text-xs capitalize">{user?.role}</div></div></div>}
        <Link to="/" className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-enayi-muted hover:text-enayi-text hover:bg-enayi-panel text-xs transition-all', collapsed && 'justify-center')}><Home size={14} />{!collapsed && 'Main Site'}</Link>
        <button onClick={handleLogout} className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 text-xs transition-all', collapsed && 'justify-center')}><LogOut size={14} />{!collapsed && 'Sign Out'}</button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-enayi-bg overflow-hidden">
      <div className={cn('hidden md:flex flex-col flex-shrink-0 h-full transition-all duration-300', collapsed ? 'w-16' : 'w-60')}>
        <SidebarContent />
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{x:'-100%'}} animate={{x:0}} exit={{x:'-100%'}} transition={{type:'spring',damping:25,stiffness:300}} className="fixed left-0 top-0 bottom-0 z-50 w-72 md:hidden flex flex-col">
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-4 md:px-8 h-16 bg-enayi-surface border-b border-enayi-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="md:hidden p-1.5 text-enayi-muted"><Menu size={20} /></button>
            <button onClick={() => setCollapsed(!collapsed)} className="hidden md:block p-1.5 text-enayi-muted hover:text-enayi-gold transition-colors"><Menu size={18} /></button>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-enayi-gold/10 border border-enayi-gold/20">
              <span className="text-enayi-gold text-xs">✦</span><span className="text-enayi-gold text-xs font-semibold">{user?.loyalty_points ?? 0} pts</span>
            </div>
            <Link to="/book" className="btn-gold text-xs px-4 py-2">Book Room</Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  )
}
