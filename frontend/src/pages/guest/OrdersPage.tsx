import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Plus, Minus, Trash2, Send, Loader2, UtensilsCrossed, CheckCircle2, Clock, X, ChevronDown } from 'lucide-react'
import { useMenuCategories, useMenuItems, usePlaceOrder, useMyOrders } from '@/hooks/useOrders'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency, formatDateTime } from '@/utils/helpers'
import { StatusBadge, EmptyState, PageSpinner } from '@/components/ui'
import toast from 'react-hot-toast'
import type { MenuItem, Order } from '@/types'

export default function OrdersPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<'menu'|'orders'>('menu')
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [source, setSource] = useState('room_service')
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null)
  const [cartOpen, setCartOpen] = useState(false)

  const { data: cats, isLoading: catsLoading } = useMenuCategories()
  const { data: items, isLoading: itemsLoading } = useMenuItems(activeCategory || undefined)
  const { data: myOrders, isLoading: ordersLoading } = useMyOrders()
  const { items: cartItems, addItem, removeItem, updateQty, clearCart, total, itemCount } = useCartStore()
  const placeOrder = usePlaceOrder()

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) { toast.error('Your cart is empty'); return }
    const order = await placeOrder.mutateAsync({
      source,
      items: cartItems.map(i => ({ menu_item: i.menu_item.id, quantity: i.quantity, customizations: i.customizations })),
    })
    clearCart()
    setCartOpen(false)
    setConfirmedOrder(order)
  }

  if (catsLoading) return <PageSpinner />

  const CartPanel = () => (
    <div className="card-gold p-4 rounded-2xl">
      <h2 className="font-heading text-base text-enayi-text mb-3 flex items-center gap-2">
        <ShoppingCart size={16} className="text-enayi-gold"/> Cart ({itemCount()})
      </h2>
      {cartItems.length === 0 ? (
        <p className="text-enayi-muted text-sm text-center py-6">Your cart is empty</p>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {cartItems.map(ci => (
              <div key={ci.menu_item.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-enayi-text text-xs font-medium truncate">{ci.menu_item.name}</p>
                  <p className="text-enayi-gold text-xs">{formatCurrency(ci.menu_item.price * ci.quantity)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => updateQty(ci.menu_item.id, ci.quantity - 1)} className="w-6 h-6 rounded-lg bg-enayi-panel border border-enayi-border flex items-center justify-center"><Minus size={10}/></button>
                  <span className="text-enayi-text text-xs w-4 text-center">{ci.quantity}</span>
                  <button onClick={() => updateQty(ci.menu_item.id, ci.quantity + 1)} className="w-6 h-6 rounded-lg bg-enayi-gold flex items-center justify-center text-enayi-bg"><Plus size={10}/></button>
                  <button onClick={() => removeItem(ci.menu_item.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 ml-0.5"><Trash2 size={10}/></button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-enayi-border pt-3 mb-3">
            <div className="flex justify-between text-xs mb-1"><span className="text-enayi-muted">Subtotal</span><span className="text-enayi-text">{formatCurrency(total())}</span></div>
            <div className="flex justify-between text-sm font-semibold"><span className="text-enayi-text">Total (incl. VAT)</span><span className="text-enayi-gold font-display text-base">{formatCurrency(total() * 1.075)}</span></div>
          </div>
          <button onClick={handlePlaceOrder} disabled={placeOrder.isPending} className="btn-gold w-full gap-2 text-sm">
            {placeOrder.isPending ? <><Loader2 size={13} className="animate-spin"/>Placing…</> : <><Send size={13}/>Place Order</>}
          </button>
          <button onClick={clearCart} className="btn-ghost w-full text-xs mt-2">Clear Cart</button>
        </>
      )}
    </div>
  )

  return (
    <div className="space-y-4 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-2xl text-enayi-text">Food & Bar</h1>
          <p className="text-enayi-muted text-xs mt-0.5">Delivered to you</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('menu')} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${view==='menu' ? 'bg-enayi-gold text-enayi-bg' : 'card text-enayi-muted'}`}>Menu</button>
          <button onClick={() => setView('orders')} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${view==='orders' ? 'bg-enayi-gold text-enayi-bg' : 'card text-enayi-muted'}`}>My Orders</button>
        </div>
      </div>

      {view === 'menu' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">

            {/* Category chips — single horizontal scroll row on mobile */}
            <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
              <button onClick={() => setActiveCategory('')}
                className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${!activeCategory ? 'bg-enayi-gold text-enayi-bg' : 'card text-enayi-muted'}`}>
                All
              </button>
              {(cats || []).map(c => (
                <button key={c.id} onClick={() => setActiveCategory(c.id)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap capitalize ${activeCategory === c.id ? 'bg-enayi-gold text-enayi-bg' : 'card text-enayi-muted'}`}>
                  {c.name}
                </button>
              ))}
            </div>

            {/* Source chips — horizontal scroll */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
              <span className="text-enayi-muted text-xs flex-shrink-0">Order from:</span>
              {['room_service', 'kitchen', 'bar', 'restaurant'].map(s => (
                <button key={s} onClick={() => setSource(s)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize whitespace-nowrap ${source === s ? 'bg-enayi-gold text-enayi-bg' : 'card text-enayi-muted hover:text-enayi-gold'}`}>
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Menu items */}
            {itemsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl"/>)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                {(items || []).map((item: MenuItem, i) => {
                  const inCart = cartItems.find(c => c.menu_item.id === item.id)
                  return (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`card-hover p-3 flex flex-col justify-between ${!item.is_available ? 'opacity-60' : ''}`}>
                      {/* Image */}
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} className="w-full h-24 object-cover rounded-xl mb-2" />
                      )}
                      <div className="flex-1">
                        <div className="font-semibold text-enayi-text text-sm leading-tight">{item.name}</div>
                        <p className="text-enayi-muted text-[11px] mt-0.5 line-clamp-2">{item.description}</p>
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {!item.is_available && <span className="badge-red text-[10px]">Unavailable</span>}
                          {item.is_halal && <span className="badge-green text-[10px]">Halal</span>}
                          {item.is_vegetarian && <span className="badge-gold text-[10px]">Veg</span>}
                          {item.is_spicy && <span className="badge-red text-[10px]">Spicy 🌶️</span>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="text-enayi-gold font-semibold text-sm">{formatCurrency(item.price)}</span>
                        {!item.is_available ? (
                          <span className="text-enayi-muted text-[10px]">—</span>
                        ) : inCart ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => updateQty(item.id, inCart.quantity - 1)} className="w-7 h-7 rounded-lg bg-enayi-panel border border-enayi-border flex items-center justify-center"><Minus size={11}/></button>
                            <span className="text-enayi-text text-sm font-semibold w-4 text-center">{inCart.quantity}</span>
                            <button onClick={() => updateQty(item.id, inCart.quantity + 1)} className="w-7 h-7 rounded-lg bg-enayi-gold flex items-center justify-center text-enayi-bg"><Plus size={11}/></button>
                          </div>
                        ) : (
                          <button onClick={() => addItem(item)} className="flex items-center gap-1 text-[11px] font-medium border border-enayi-gold/50 text-enayi-gold hover:bg-enayi-gold/10 px-2.5 py-1.5 rounded-lg transition-all">
                            <Plus size={11}/> Add
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Cart — desktop: sidebar; mobile: hidden (floating button below) */}
          <div className="hidden lg:block">
            <div className="sticky top-4">
              <CartPanel />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {ordersLoading ? <PageSpinner /> : (myOrders || []).length === 0
            ? <EmptyState icon={UtensilsCrossed} title="No orders yet" desc="Place your first order from the menu."
                action={<button onClick={() => setView('menu')} className="btn-gold text-sm">Browse Menu</button>} />
            : (myOrders || []).map(o => (
              <div key={o.id} className="card-hover p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-heading text-base text-enayi-text">{o.order_number}</div>
                    <div className="text-enayi-muted text-xs mt-0.5 capitalize">{o.source.replace('_',' ')} · {o.items.length} items · {formatDateTime(o.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-enayi-gold font-display text-base">{formatCurrency(o.total_amount)}</span>
                    <StatusBadge status={o.status}/>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {o.items.map(i => <span key={i.id} className="badge-gold text-xs">{i.quantity}× {i.menu_item_name}</span>)}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── Mobile floating cart button + drawer ────────────────────── */}
      {view === 'menu' && (
        <>
          {/* Sticky bottom bar — always visible on mobile */}
          <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden p-3 safe-area-bottom"
            style={{ background: 'linear-gradient(to top, rgba(10,15,30,0.98) 60%, transparent)' }}>
            <button onClick={() => setCartOpen(true)}
              className="w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl font-semibold text-sm transition-all"
              style={{ background: itemCount() > 0 ? '#C9A227' : 'rgba(255,255,255,0.06)', color: itemCount() > 0 ? '#0A0F1E' : 'rgba(255,255,255,0.4)', border: itemCount() > 0 ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-2">
                <ShoppingCart size={16}/>
                <span>{itemCount() > 0 ? `${itemCount()} item${itemCount() > 1 ? 's' : ''} in cart` : 'Your cart is empty'}</span>
              </div>
              {itemCount() > 0 && (
                <span className="font-bold">{formatCurrency(total() * 1.075)}</span>
              )}
            </button>
          </div>

          {/* Cart drawer — slides up from bottom on mobile */}
          <AnimatePresence>
            {cartOpen && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setCartOpen(false)} />
                <motion.div
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  className="fixed bottom-0 left-0 right-0 z-50 lg:hidden rounded-t-3xl overflow-hidden max-h-[85vh] overflow-y-auto"
                  style={{ background: '#0A0F1E', borderTop: '1px solid rgba(201,162,39,0.3)' }}>
                  <div className="flex items-center justify-between px-5 pt-4 pb-2">
                    <h2 className="font-heading text-base text-enayi-text flex items-center gap-2">
                      <ShoppingCart size={16} className="text-enayi-gold"/> Your Cart
                    </h2>
                    <button onClick={() => setCartOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-enayi-muted hover:text-enayi-text hover:bg-white/10">
                      <ChevronDown size={18}/>
                    </button>
                  </div>
                  <div className="px-4 pb-6">
                    <CartPanel />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Order confirmation modal */}
      {confirmedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4" onClick={() => setConfirmedOrder(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
            className="card-gold rounded-2xl p-6 max-w-sm w-full text-center relative">
            <button onClick={() => setConfirmedOrder(null)} className="absolute top-3 right-3 text-enayi-muted hover:text-enayi-text"><X size={18}/></button>
            <div className="w-14 h-14 rounded-full bg-enayi-gold/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={28} className="text-enayi-gold" />
            </div>
            <h2 className="font-display text-xl text-enayi-text mb-1">Order Confirmed!</h2>
            <p className="text-enayi-muted text-xs mb-4">{confirmedOrder.order_number}</p>
            <p className="text-enayi-text text-sm mb-5">{confirmedOrder.friendly_message}</p>
            <div className="flex items-center justify-center gap-6 mb-5">
              <div>
                <div className="text-enayi-muted text-xs">Total</div>
                <div className="text-enayi-gold font-display text-2xl">{formatCurrency(confirmedOrder.total_amount)}</div>
              </div>
              <div className="w-px h-10 bg-enayi-border"/>
              <div>
                <div className="text-enayi-muted text-xs flex items-center gap-1 justify-center"><Clock size={11}/> Ready in about</div>
                <div className="text-enayi-gold font-display text-2xl">{confirmedOrder.estimated_minutes} min</div>
              </div>
            </div>
            <button onClick={() => { setConfirmedOrder(null); navigate('/my-orders') }} className="btn-gold w-full">Track My Order</button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
