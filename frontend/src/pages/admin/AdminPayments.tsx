import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/utils/api'
import { formatCurrency, formatDateTime } from '@/utils/helpers'
import { PageSpinner, EmptyState, Badge, Select } from '@/components/ui'
import { CreditCard } from 'lucide-react'
import type { AdminPayment, PaymentStatus, PaymentMethod } from '@/types'

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

const STATUS_BADGE: Record<PaymentStatus, 'green'|'red'|'gold'|'blue'|'gray'> = {
  success: 'green', failed: 'red', pending: 'gold', refunded: 'blue', abandoned: 'gray',
}

export default function AdminPayments() {
  const [statusFilter, setStatusFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')

  const { data, isLoading } = useQuery<AdminPayment[]>({
    queryKey: ['admin-payments', statusFilter, methodFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (methodFilter) params.set('method', methodFilter)
      return api.get(`/payments/admin/?${params.toString()}`).then(r => unwrapList(r.data))
    },
  })

  const totalSuccess = (data || []).filter(p => p.status === 'success').reduce((s, p) => s + Number(p.amount), 0)

  if (isLoading) return <PageSpinner />

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-enayi-text">Payments</h1>
        <p className="text-enayi-muted text-sm">{data?.length ?? 0} transactions · {formatCurrency(totalSuccess)} successful</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="max-w-[160px]">
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="abandoned">Abandoned</option>
        </Select>
        <Select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} className="max-w-[160px]">
          <option value="">All methods</option>
          <option value="paystack">Paystack</option>
          <option value="monnify">Monnify</option>
          <option value="flutterwave">Flutterwave</option>
          <option value="cash">Cash</option>
          <option value="pos">POS</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="ussd">USSD</option>
        </Select>
      </div>

      {(data || []).length === 0 ? (
        <div className="card p-12 text-center"><EmptyState icon={CreditCard} title="No payments found" /></div>
      ) : (
        <div className="space-y-2.5">
          {data!.map(p => (
            <div key={p.id} className="card p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6 justify-between">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-enayi-gold truncate">{p.transaction_reference}</span>
                  <Badge variant={STATUS_BADGE[p.status]}>{p.status}</Badge>
                </div>
                <div className="text-enayi-text text-sm font-medium">{p.guest_name}</div>
                <div className="text-enayi-muted text-xs">{p.guest_email}</div>
              </div>
              <div className="flex items-center justify-between md:justify-end gap-4 md:gap-8 flex-shrink-0">
                <div className="text-right">
                  <div className="text-enayi-muted text-xs capitalize">{p.method.replace('_', ' ')} · {p.purpose}</div>
                  <div className="text-enayi-muted text-xs">{formatDateTime(p.created_at)}</div>
                </div>
                <div className="text-enayi-gold font-semibold text-right whitespace-nowrap">{formatCurrency(p.amount)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
