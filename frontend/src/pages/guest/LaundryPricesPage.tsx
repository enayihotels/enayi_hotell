import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/utils/api'
import { PageSpinner, EmptyState, Select } from '@/components/ui'
import { Shirt } from 'lucide-react'

interface HotelLite { id: string; name: string; branch: string; is_primary: boolean }
interface PriceItem { id: string; name: string; price: string; is_active: boolean }

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
