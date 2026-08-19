import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UtensilsCrossed, Clock, ArrowRight } from 'lucide-react'
import { useMyOrders } from '@/hooks/useOrders'
import { formatCurrency, formatDateTime } from '@/utils/helpers'
import { StatusBadge, EmptyState, PageSpinner } from '@/components/ui'

const TABS = ['all', 'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'] as const

// A guest's order moves pending -> confirmed -> preparing -> ready ->
// delivered. This maps each status to what it actually means for a
// guest waiting on food/drinks, since "Preparing" alone doesn't tell
// them whether to expect it any minute or not for a while yet.
const STATUS_HINT: Record<string, string> = {
  pending:    'Just placed — the kitchen/bar hasn\'t started yet.',
  confirmed:  'Confirmed and queued up.',
  preparing:  'Being prepared right now.',
  ready:      'Ready — on its way to you.',
  delivered:  'Delivered.',
  cancelled:  'This order was cancelled.',
}

export default function MyOrdersPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('all')
  const { data: orders, isLoading } = useMyOrders()

  const filtered = tab === 'all' ? orders ?? [] : (orders ?? []).filter(o => o.status === tab)

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-enayi-text">My Orders</h1>
          <p className="text-enayi-muted text-sm mt-1">{orders?.length ?? 0} total orders</p>
        </div>
        <Link to="/orders" className="btn-gold gap-2 text-sm w-full sm:w-auto text-center">Order Food & Drinks <ArrowRight size={14}/></Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${tab===t?'bg-enayi-gold text-enayi-bg':'card text-enayi-muted hover:text-enayi-gold'}`}>
            {t === 'all' ? 'All' : t}
          </button>
        ))}
      </div>

      {filtered.length === 0
        ? <EmptyState icon={UtensilsCrossed} title="No orders found" desc="You have no orders in this category." action={<Link to="/orders" className="btn-gold gap-2 text-sm">Browse Menu <ArrowRight size={14}/></Link>} />
        : (
          <div className="space-y-4">
            {filtered.map(o => (
              <div key={o.id} className="card-hover p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-enayi-panel border border-enayi-border flex items-center justify-center flex-shrink-0"><UtensilsCrossed size={16} className="text-enayi-gold"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="font-heading text-base text-enayi-text">{o.order_number}</div>
                        <div className="text-enayi-muted text-xs mt-0.5 capitalize">{o.source.replace('_',' ')}{o.room_number && ` · Room ${o.room_number}`} · {formatDateTime(o.created_at)}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-enayi-gold font-semibold">{formatCurrency(o.total_amount)}</div>
                          <div className="text-xs text-enayi-muted">{o.is_paid ? '✅ Paid' : 'Pending'}</div>
                        </div>
                        <StatusBadge status={o.status} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {o.items.map(i => <span key={i.id} className="badge-gold text-xs">{i.quantity}× {i.menu_item_name}</span>)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-enayi-border text-enayi-muted text-xs">
                      <Clock size={11}/> {STATUS_HINT[o.status] ?? ''}
                    </div>
                    {o.special_instructions && (
                      <div className="text-enayi-muted text-xs italic mt-1">"{o.special_instructions}"</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
