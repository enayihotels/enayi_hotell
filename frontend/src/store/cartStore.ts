import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, MenuItem } from '@/types'

interface CartState {
  items: CartItem[]
  source: string
  addItem: (item: MenuItem, qty?: number, customizations?: string) => void
  removeItem: (itemId: string) => void
  updateQty: (itemId: string, qty: number) => void
  clearCart: () => void
  setSource: (source: string) => void
  total: () => number
  itemCount: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      source: 'room_service',

      addItem: (menu_item, qty = 1, customizations = '') =>
        set(state => {
          const existing = state.items.find(i => i.menu_item.id === menu_item.id)
          if (existing) {
            return {
              items: state.items.map(i =>
                i.menu_item.id === menu_item.id
                  ? { ...i, quantity: i.quantity + qty }
                  : i
              ),
            }
          }
          return { items: [...state.items, { menu_item, quantity: qty, customizations }] }
        }),

      removeItem: (itemId) =>
        set(state => ({ items: state.items.filter(i => i.menu_item.id !== itemId) })),

      updateQty: (itemId, qty) =>
        set(state => ({
          items: qty <= 0
            ? state.items.filter(i => i.menu_item.id !== itemId)
            : state.items.map(i =>
                i.menu_item.id === itemId ? { ...i, quantity: qty } : i
              ),
        })),

      clearCart: () => set({ items: [] }),

      setSource: (source) => set({ source }),

      total: () =>
        get().items.reduce((sum, i) => sum + i.menu_item.price * i.quantity, 0),

      itemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'enayi-cart' }
  )
)
