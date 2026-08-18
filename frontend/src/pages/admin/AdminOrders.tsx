import { useKitchenOrders, useBarOrders, useUpdateOrderStatus } from '@/hooks/useOrders'
import { formatCurrency, formatDateTime } from '@/utils/helpers'
import { StatusBadge, PageSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'

const STATUS_FLOW: Record<string,string> = { pending:'confirmed', confirmed:'preparing', preparing:'ready', ready:'delivered' }

export default function AdminOrders() {
  const { user } = useAuthStore()
  // Kitchen Staff only cares about food orders, Bar Staff only about
  // drink orders — showing both sections to a scoped role is the same
  // cross-department noise problem fixed on the Inventory stock page
  // (a Kitchen Staff account seeing Bar's orders every time she opens
  // this page). Store Keeper, Manager, and Admin keep the full view
  // since they aren't scoped to a single department.
  const showKitchen = user?.role !== 'bar_staff'
  const showBar = user?.role !== 'kitchen_staff'

  const { data: kitchen, isLoading: kl } = useKitchenOrders(showKitchen)
  const { data: bar,     isLoading: bl } = useBarOrders(showBar)
  const updateStatus = useUpdateOrderStatus()

  const Section = ({ title, orders, loading }: any) => (
    <div>
      <h2 className="font-heading text-xl text-enayi-text mb-4 flex items-center gap-2">{title} <span className="badge-gold text-xs">{orders?.length??0}</span></h2>
      {loading ? <PageSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(orders||[]).map((o:any)=>(
            <div key={o.id} className="card p-4 space-y-3">
              <div className="flex justify-between items-start"><span className="font-mono text-enayi-gold text-sm">{o.order_number}</span><StatusBadge status={o.status}/></div>
              <div className="text-enayi-muted text-xs">{formatDateTime(o.created_at)}{o.room_number && ` · Room ${o.room_number}`}</div>
              <div className="space-y-1">{o.items.map((i:any)=><div key={i.id} className="text-enayi-text text-sm">{i.quantity}× {i.menu_item_name}</div>)}</div>
              <div className="flex justify-between items-center pt-2 border-t border-enayi-border">
                <span className="text-enayi-gold font-semibold">{formatCurrency(o.total_amount)}</span>
                {STATUS_FLOW[o.status] && <button onClick={()=>updateStatus.mutate({id:o.id,status:STATUS_FLOW[o.status]})} className="btn-gold text-xs px-3 py-1.5">→ {STATUS_FLOW[o.status]}</button>}
              </div>
            </div>
          ))}
          {(!orders||orders.length===0) && <div className="col-span-3 text-center py-12 text-enayi-muted">No active orders</div>}
        </div>
      )}
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-8">
      <h1 className="font-display text-3xl text-enayi-text">
        {showKitchen && showBar ? 'Kitchen & Bar Orders' : showKitchen ? 'Kitchen Orders' : 'Bar Orders'}
      </h1>
      {showKitchen && <Section title="🍳 Kitchen" orders={kitchen} loading={kl} />}
      {showBar && <Section title="🍸 Bar" orders={bar} loading={bl} />}
    </div>
  )
}
