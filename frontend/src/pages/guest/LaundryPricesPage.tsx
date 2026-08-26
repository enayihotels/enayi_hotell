import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '@/utils/api'
import { PageSpinner, EmptyState, Select, Badge, Button } from '@/components/ui'
import { Shirt, CreditCard } from 'lucide-react'

interface HotelLite { id: string; name: string; branch: string; is_primary: boolean }
interface PriceItem { id: string; name: string; price: string; is_active: boolean }
interface TicketLine { id: string; item_name: string; quantity: number; line_total: string }
interface MyTicket {
  id: string; room_number: string | null; total_price: string
  status: 'pending' | 'ready'; status_display: string; is_paid: boolean
  line_items: TicketLine[]; created_at: string
}

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

export default function LaundryPricesPage() {
  const [branchId, setBranchId] = useState<string>('')

  const { data: hotels } = useQuery<HotelLite[]>({
    queryKey: ['hotels'],
    queryFn: () => api.get('/hotels/').then(r => unwrapList(r.data)),
  })

  // Default to the flagship / first branch, same pattern as the room
  // booking page — guest accounts aren't tied to one branch, so
  // something has to pick a starting point.
  useEffect(() => {
    if (!branchId && hotels?.length) {
      setBranchId((hotels.find(h => h.is_primary) ?? hotels[0]).id)
    }
  }, [hotels, branchId])

  const { data: prices, isLoading } = useQuery<PriceItem[]>({
    queryKey: ['laundry-prices', branchId],
    queryFn: () => api.get(`/laundry/prices/?hotel=${branchId}`).then(r => unwrapList(r.data)),
    enabled: !!branchId,
  })

  const { data: myTickets } = useQuery<MyTicket[]>({
    queryKey: ['my-laundry-tickets'],
    queryFn: () => api.get('/laundry/my-tickets/').then(r => unwrapList(r.data)),
  })

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-enayi-text flex items-center gap-2">
          <Shirt size={22} className="text-enayi-gold" /> Laundry Service
        </h1>
        <p className="text-enayi-muted text-sm mt-1">
          Hand your items to Front Desk or Laundry Staff, and let them know what you're dropping off —
          there's no need to submit anything here. Prices below are so you know what to expect.
          Turnaround is typically about a day.
        </p>
      </div>

      {myTickets && myTickets.length > 0 && (
        <div>
          <h2 className="text-enayi-text font-medium text-sm mb-2">My Laundry</h2>
          <div className="space-y-2">
            {myTickets.map(t => (
              <div key={t.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-enayi-muted">{t.room_number ? `Room ${t.room_number}` : ''}</div>
                  <div className="flex gap-1.5">
                    <Badge variant={t.status === 'ready' ? 'green' : 'gold'}>{t.status_display}</Badge>
                    <Badge variant={t.is_paid ? 'green' : 'red'}>{t.is_paid ? 'Paid' : 'Unpaid'}</Badge>
                  </div>
                </div>
                <div className="text-xs text-enayi-muted space-y-0.5">
                  {t.line_items.map(l => (
                    <div key={l.id} className="flex justify-between">
                      <span>{l.quantity}x {l.item_name}</span>
                      <span>₦{Number(l.line_total).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="text-enayi-text text-sm font-semibold">Total: ₦{Number(t.total_price).toLocaleString()}</div>
                {!t.is_paid && (
                  <Link to={`/payment/${t.id}?purpose=laundry&amount=${t.total_price}&narration=${encodeURIComponent('Laundry Service')}`}>
                    <Button size="sm" variant="gold"><CreditCard size={12} /> Pay Now</Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {hotels && hotels.length > 1 && (
        <Select label="Branch" value={branchId} onChange={e => setBranchId(e.target.value)}>
          {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </Select>
      )}

      {isLoading ? (
        <PageSpinner />
      ) : !prices || prices.length === 0 ? (
        <div className="card p-8 text-center">
          <EmptyState icon={Shirt} title="No price list yet" desc="Check back soon, or ask Front Desk for current laundry pricing." />
        </div>
      ) : (
        <div className="card divide-y divide-enayi-border">
          {prices.map(p => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-enayi-text text-sm">{p.name}</span>
              <span className="text-enayi-gold font-medium text-sm">₦{Number(p.price).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
