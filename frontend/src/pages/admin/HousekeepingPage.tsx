import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { formatDateTime } from '@/utils/helpers'
import { PageSpinner, EmptyState, Button, Badge } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { Sparkles, Check, Utensils } from 'lucide-react'
import type { Room, Order } from '@/types'

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

const STATUS_FLOW: Record<string, string> = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'delivered' }

export default function HousekeepingPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const { data: cleaningRooms, isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ['housekeeping-rooms', user?.hotel],
    queryFn: () => api.get('/rooms/list/', { params: { hotel: user?.hotel, status: 'cleaning' } }).then(r => unwrapList(r.data)),
    refetchInterval: 30_000,
  })

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ['housekeeping-orders'],
    queryFn: () => api.get('/orders/housekeeping/').then(r => unwrapList(r.data)),
    refetchInterval: 20_000,
  })

  const markCleaned = useMutation({
    mutationFn: (roomId: string) => api.post(`/rooms/list/${roomId}/mark-cleaned/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeeping-rooms'] })
      toast.success('Room marked available.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const updateOrderStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/orders/${id}/status/`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeeping-orders'] })
      toast.success('Order status updated.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (roomsLoading || ordersLoading) return <PageSpinner />

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-enayi-text">Housekeeping</h1>
        <p className="text-enayi-muted text-sm">Rooms to clean and room service deliveries — all in one place.</p>
      </div>

      <div>
        <h2 className="font-heading text-lg text-enayi-text mb-3 flex items-center gap-2">
          <Sparkles size={18} className="text-enayi-gold" /> Rooms Awaiting Cleaning
          <span className="text-enayi-muted text-sm font-normal">({(cleaningRooms || []).length})</span>
        </h2>
        {(cleaningRooms || []).length === 0 ? (
          <div className="card p-8 text-center"><EmptyState icon={Sparkles} title="All caught up" desc="No rooms are waiting on cleaning right now." /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cleaningRooms!.map(room => (
              <div key={room.id} className="card p-4 flex items-center justify-between">
                <div>
                  <div className="text-enayi-text font-medium">Room {room.room_number}</div>
                  <div className="text-enayi-muted text-xs">{room.category_name} · Floor {room.floor}</div>
                </div>
                <Button size="sm" variant="gold" loading={markCleaned.isPending} onClick={() => markCleaned.mutate(room.id)}>
                  <Check size={12} /> Mark Cleaned
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-heading text-lg text-enayi-text mb-3 flex items-center gap-2">
          <Utensils size={18} className="text-enayi-gold" /> Room Service to Deliver
          <span className="text-enayi-muted text-sm font-normal">({(orders || []).length})</span>
        </h2>
        {(orders || []).length === 0 ? (
          <div className="card p-8 text-center"><EmptyState icon={Utensils} title="Nothing to deliver" desc="No room service orders are waiting right now." /></div>
        ) : (
          <div className="space-y-2.5">
            {orders!.map(o => (
              <div key={o.id} className="card p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-enayi-text font-medium">Room {o.room_number || '—'}</span>
                    <Badge variant="gold">{o.status.toUpperCase()}</Badge>
                  </div>
                  <div className="text-enayi-muted text-xs mt-1">{formatDateTime(o.created_at)}</div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {o.items.map(i => <span key={i.id} className="badge-gold text-xs">{i.quantity}× {i.menu_item_name}</span>)}
                  </div>
                </div>
                {STATUS_FLOW[o.status] && (
                  <Button size="sm" variant="gold" loading={updateOrderStatus.isPending}
                    onClick={() => updateOrderStatus.mutate({ id: o.id, status: STATUS_FLOW[o.status] })}>
                    → {STATUS_FLOW[o.status].toUpperCase()}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
