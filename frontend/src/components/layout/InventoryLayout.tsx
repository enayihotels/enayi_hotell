import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Package, User, LogOut, Menu, Utensils, BedDouble, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/utils/api'
import { useAuthStore } from '@/store/authStore'

const ROLE_LABEL: Record<string, string> = {
  store_keeper:  'Store Keeper',
  bar_staff:     'Bar Staff',
  kitchen_staff: 'Kitchen Staff',
  housekeeper:   'Housekeeper',
  manager:       'Manager',
  admin:         'Owner',
}

function SidebarContent({ onNavigate, onLogout, roleLabel, firstInitial, fullName, isHousekeeper, showMenuManager }: { onNavigate?: () => void; onLogout: () => void; roleLabel: string; firstInitial: string; fullName: string; isHousekeeper: boolean; showMenuManager: boolean }) {
  return (
    <>
      <div className="p-5 border-b border-enayi-border">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="w-8 h-8" />
          <div>
            <div className="font-display text-lg text-enayi-text leading-tight">Enayi Hotels</div>
            <div className="text-enayi-gold text-[11px] uppercase tracking-wide">{roleLabel}</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {isHousekeeper && (
          <NavLink to="/housekeeping" end onClick={onNavigate}
            className={({isActive}) => `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-enayi-gold/10 text-enayi-gold' : 'text-enayi-muted hover:text-enayi-text hover:bg-enayi-panel'}`}>
            <BedDouble size={16} /> Housekeeping
          </NavLink>
        )}
        <NavLink to="/inventory" end onClick={onNavigate}
          className={({isActive}) => `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-enayi-gold/10 text-enayi-gold' : 'text-enayi-muted hover:text-enayi-text hover:bg-enayi-panel'}`}>
          <Package size={16} /> Inventory
        </NavLink>
        {!isHousekeeper && (
          <>
            <NavLink to="/inventory/orders" onClick={onNavigate}
              className={({isActive}) => `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-enayi-gold/10 text-enayi-gold' : 'text-enayi-muted hover:text-enayi-text hover:bg-enayi-panel'}`}>
              <Utensils size={16} /> Orders
            </NavLink>
            {showMenuManager && (
              <NavLink to="/inventory/menu" onClick={onNavigate}
                className={({isActive}) => `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-enayi-gold/10 text-enayi-gold' : 'text-enayi-muted hover:text-enayi-text hover:bg-enayi-panel'}`}>
                <Camera size={16} /> Menu
              </NavLink>
            )}
          </>
        )}
      </nav>
      <div className="p-3 border-t border-enayi-border space-y-1.5">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-enayi-gold/20 flex items-center justify-center flex-shrink-0">
            <span className="text-enayi-gold font-semibold text-sm">{firstInitial}</span>
          </div>
          <div className="overflow-hidden">
            <div className="text-enayi-text text-sm font-medium truncate">{fullName}</div>
            <div className="text-enayi-muted text-xs">{roleLabel}</div>
          </div>
        </div>
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2 px-3 py-2 rounded-lg text-enayi-muted hover:text-enayi-text hover:bg-enayi-panel text-xs transition-all">
          <User size={14} /> My Account
        </Link>
        <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 text-xs transition-all">
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </>
  )
}

export default function InventoryLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const roleLabel = ROLE_LABEL[user?.role ?? ''] ?? 'Staff'
  const fullName = user?.full_name ?? ''
  const firstInitial = user?.first_name?.[0] ?? '?'
  const isHousekeeper = user?.role === 'housekeeper'
  // Store Keeper doesn't own menu items (mirrors backend
  // _can_manage_menu_item — only Bar/Kitchen Staff, Manager, Admin can
  // touch a MenuItem); Manager/Admin already have full access via the
  // main Admin panel, so this stays scoped to the two staff roles who
  // actually live in this inventory-only shell day to day.
  const showMenuManager = user?.role === 'bar_staff' || user?.role === 'kitchen_staff'

  const handleLogout = async () => {
    try { await api.post('/auth/logout/', { refresh: localStorage.getItem('refresh_token') }) } catch {}
    logout(); toast.success('Logged out.'); navigate('/login')
  }

  return (
    <div className="min-h-screen bg-enayi-bg flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-enayi-surface border-r border-enayi-border flex-shrink-0">
        <SidebarContent onLogout={handleLogout} roleLabel={roleLabel} firstInitial={firstInitial} fullName={fullName} isHousekeeper={isHousekeeper} showMenuManager={showMenuManager} />
      </aside>

      {/* Mobile drawer */}
      <div className={`md:hidden fixed inset-0 z-40 ${drawerOpen ? '' : 'pointer-events-none'}`}>
        <div onClick={() => setDrawerOpen(false)} className={`absolute inset-0 bg-black/60 transition-opacity ${drawerOpen ? 'opacity-100' : 'opacity-0'}`} />
        <aside className={`absolute left-0 top-0 bottom-0 w-64 bg-enayi-surface border-r border-enayi-border flex flex-col transition-transform ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <SidebarContent onNavigate={() => setDrawerOpen(false)} onLogout={handleLogout} roleLabel={roleLabel} firstInitial={firstInitial} fullName={fullName} isHousekeeper={isHousekeeper} showMenuManager={showMenuManager} />
        </aside>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-enayi-border bg-enayi-surface">
          <button onClick={() => setDrawerOpen(true)} className="text-enayi-text"><Menu size={22} /></button>
          <span className="text-enayi-gold text-xs uppercase tracking-wide">{roleLabel}</span>
          <button onClick={handleLogout} className="text-red-400"><LogOut size={18} /></button>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
