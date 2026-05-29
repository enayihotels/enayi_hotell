import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import type { MenuCategory, MenuItem, Order } from '@/types'

export const useMenuCategories = () =>
  useQuery<MenuCategory[]>({
    queryKey: ['menu-categories'],
    queryFn: () => api.get('/orders/menu/categories/').then(r => r.data?.results ?? r.data), // ← fixed
  })

export const useMenuItems = (categoryId?: string) =>
  useQuery<MenuItem[]>({
    queryKey: ['menu-items', categoryId],
    queryFn: () =>
      api.get('/orders/menu/items/', {
        params: categoryId ? { category: categoryId } : {},
      }).then(r => r.data?.results ?? r.data),
  })

export const useMyOrders = () =>
  useQuery<Order[]>({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/orders/my/').then(r => r.data?.results ?? r.data), // ← fixed
  })

export const usePlaceOrder = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      source: string
      items: { menu_item: string; quantity: number; customizations?: string }[]
      special_instructions?: string
      room_id?: string
    }) => api.post('/orders/', data).then(r => r.data),
    onSuccess: (order: Order) => {
      queryClient.invalidateQueries({ queryKey: ['my-orders'] })
      toast.success(`Order ${order.order_number} placed! 🍽️ Estimated delivery: 30 mins`)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status/`, { status }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })
      queryClient.invalidateQueries({ queryKey: ['bar-orders'] })
      toast.success('Order status updated.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export const useKitchenOrders = () =>
  useQuery<Order[]>({
    queryKey: ['kitchen-orders'],
    queryFn: () => api.get('/orders/kitchen/').then(r => r.data?.results ?? r.data), // ← fixed
    refetchInterval: 30_000,
  })

export const useBarOrders = () =>
  useQuery<Order[]>({
    queryKey: ['bar-orders'],
    queryFn: () => api.get('/orders/bar/').then(r => r.data?.results ?? r.data), // ← fixed
    refetchInterval: 30_000,
  })