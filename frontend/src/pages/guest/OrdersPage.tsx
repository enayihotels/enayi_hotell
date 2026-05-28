import { useState } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Plus, Minus, Trash2, Send, Loader2, UtensilsCrossed, Wine } from 'lucide-react'
import { useMenuCategories, useMenuItems, usePlaceOrder, useMyOrders } from '@/hooks/useOrders'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency, formatDateTime } from '@/utils/helpers'
import { StatusBadge, EmptyState, PageSpinner } from '@/components/ui'
import toast from 'react-hot-toast'
import type { MenuItem } from '@/types'

export default function OrdersPage() {
  const [view, setView] = useState<'menu'|'orders'>('menu')
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [source, setSource] = useState('room_service')
  const { data: cats, isLoading: catsLoading } = useMenuCategories()
  const { data: items, isLoading: itemsLoading } = useMenuItems(activeCategory || undefined)
  const { data: myOrders, isLoading: ordersLoading } = useMyOrders()
  const { items: cartItems, addItem, removeItem, updateQty, clearCart, total, itemCount } = useCartStore()
  const placeOrder = usePlaceOrder()

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) { toast.error('Your cart is empty'); return }
    await placeOrder.mutateAsync({
      source,
      items: cartItems.map(i => ({ menu_item: i.menu_item.id, quantity: i.quantity, customizations: i.customizations })),
    })
    clearCart()
  }

  if (catsLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="font-display text-3xl text-enayi-text">Food & Bar</h1><p className="text-enayi-muted text-sm mt-1">Order from our kitchen and bar — delivered to you</p></div>
        <div className="flex gap-2">
          <button onClick={()=>setView('menu')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${view==='menu'?'bg-enayi-gold text-enayi-bg':'card text-enayi-muted'}`}>Menu</button>
          <button onClick={()=>setView('orders')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${view==='orders'?'bg-enayi-gold text-enayi-bg':'card text-enayi-muted'}`}>My Orders</button>
        </div>
      </div>

      {view === 'menu' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Categories */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={()=>setActiveCategory('')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${!activeCategory?'bg-enayi-gold text-enayi-bg':'card text-enayi-muted'}`}>All</button>
              {(cats||[]).map(c=><button key={c.id} onClick={()=>setActiveCategory(c.id)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${activeCategory===c.id?'bg-enayi-gold text-enayi-bg':'card text-enayi-muted'}`}>{c.name}</button>)}
            </div>
            {/* Source */}
            <div className="card p-4 flex items-center gap-4">
              <span className="text-enayi-muted text-sm">Order from:</span>
              {['room_service','kitchen','bar','restaurant'].map(s=>(
                <button key={s} onClick={()=>setSource(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${source===s?'bg-enayi-gold text-enayi-bg':'card text-enayi-muted hover:text-enayi-gold'}`}>{s.replace('_',' ')}</button>
              ))}
            </div>
            {/* Items */}
            {itemsLoading ? <div className="grid grid-cols-2 gap-4">{[...Array(6)].map((_,i)=><div key={i} className="skeleton h-40 rounded-2xl"/>)}</div> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(items||[]).map((item:MenuItem,i)=>{
                  const inCart = cartItems.find(c=>c.menu_item.id===item.id)
                  return (
                    <motion.div key={item.id} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}} className="card-hover p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 pr-2">
                          <div className="font-semibold text-enayi-text text-sm">{item.name}</div>
                          <p className="text-enayi-muted text-xs mt-1 line-clamp-2">{item.description}</p>
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            {item.is_halal&&<span className="badge-green text-[10px]">Halal</span>}
                            {item.is_vegetarian&&<span className="badge-gold text-[10px]">Veg</span>}
                            {item.is_spicy&&<span className="badge-red text-[10px]">Spicy 🌶️</span>}
                          </div>
                        </div>
                        {item.image_url&&<img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0"/>}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-enayi-gold font-display text-lg">{formatCurrency(item.price)}</span>
                        {inCart ? (
                          <div className="flex items-center gap-2">
                            <button onClick={()=>updateQty(item.id,inCart.quantity-1)} className="w-7 h-7 rounded-lg bg-enayi-panel border border-enayi-border flex items-center justify-center text-enayi-text hover:border-enayi-gold transition-colors"><Minus size={12}/></button>
                            <span className="text-enayi-text font-semibold text-sm w-5 text-center">{inCart.quantity}</span>
                            <button onClick={()=>updateQty(item.id,inCart.quantity+1)} className="w-7 h-7 rounded-lg bg-enayi-gold flex items-center justify-center text-enayi-bg"><Plus size={12}/></button>
                          </div>
                        ) : (
                          <button onClick={()=>addItem(item)} className="btn-outline text-xs px-3 py-1.5 gap-1"><Plus size={12}/> Add</button>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
          {/* Cart */}
          <div>
            <div className="card-gold p-5 rounded-2xl sticky top-4">
              <h2 className="font-heading text-lg text-enayi-text mb-4 flex items-center gap-2"><ShoppingCart size={18} className="text-enayi-gold"/> Cart ({itemCount()})</h2>
              {cartItems.length===0 ? <p className="text-enayi-muted text-sm text-center py-8">Your cart is empty</p> : (
                <>
                  <div className="space-y-3 mb-5">
                    {cartItems.map(ci=>(
                      <div key={ci.menu_item.id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0"><p className="text-enayi-text text-sm font-medium truncate">{ci.menu_item.name}</p><p className="text-enayi-gold text-xs">{formatCurrency(ci.menu_item.price * ci.quantity)}</p></div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={()=>updateQty(ci.menu_item.id,ci.quantity-1)} className="w-6 h-6 rounded-lg bg-enayi-panel border border-enayi-border flex items-center justify-center"><Minus size={10}/></button>
                          <span className="text-enayi-text text-sm w-4 text-center">{ci.quantity}</span>
                          <button onClick={()=>updateQty(ci.menu_item.id,ci.quantity+1)} className="w-6 h-6 rounded-lg bg-enayi-gold flex items-center justify-center text-enayi-bg"><Plus size={10}/></button>
                          <button onClick={()=>removeItem(ci.menu_item.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 ml-1"><Trash2 size={10}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-enayi-border pt-3 mb-4">
                    <div className="flex justify-between text-sm mb-1"><span className="text-enayi-muted">Subtotal</span><span className="text-enayi-text">{formatCurrency(total())}</span></div>
                    <div className="flex justify-between text-sm font-semibold"><span className="text-enayi-text">Total</span><span className="text-enayi-gold font-display text-lg">{formatCurrency(total()*1.075)}</span></div>
                  </div>
                  <button onClick={handlePlaceOrder} disabled={placeOrder.isPending} className="btn-gold w-full gap-2">
                    {placeOrder.isPending?<><Loader2 size={14} className="animate-spin"/>Placing…</>:<><Send size={14}/>Place Order</>}
                  </button>
                  <button onClick={clearCart} className="btn-ghost w-full text-xs mt-2">Clear Cart</button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {ordersLoading ? <PageSpinner /> : (myOrders||[]).length===0
            ? <EmptyState icon={UtensilsCrossed} title="No orders yet" desc="Place your first order from the menu." action={<button onClick={()=>setView('menu')} className="btn-gold text-sm">Browse Menu</button>} />
            : (myOrders||[]).map(o=>(
              <div key={o.id} className="card-hover p-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div><div className="font-heading text-lg text-enayi-text">{o.order_number}</div><div className="text-enayi-muted text-xs mt-0.5 capitalize">{o.source.replace('_',' ')} · {o.items.length} items · {formatDateTime(o.created_at)}</div></div>
                  <div className="flex items-center gap-3"><span className="text-enayi-gold font-display text-lg">{formatCurrency(o.total_amount)}</span><StatusBadge status={o.status}/></div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">{o.items.map(i=><span key={i.id} className="badge-gold text-xs">{i.quantity}× {i.menu_item_name}</span>)}</div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}
