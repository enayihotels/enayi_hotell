import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/utils/api'
import { Button, Select, PageSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { FileText, Download, Calendar, TrendingUp, Users, ShoppingBag, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

export default function DailyReportPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [hotelFilter, setHotelFilter]   = useState('')
  const [downloading, setDownloading]   = useState(false)

  const { data: hotels } = useQuery<any[]>({
    queryKey: ['hotels-for-report'],
    queryFn: () => api.get('/hotels/').then(r => unwrapList(r.data)),
    enabled: isAdmin,
  })

  // Preview stats (from existing dashboard/payment endpoints) for the selected date
  const { data: preview, isLoading } = useQuery({
    queryKey: ['report-preview', selectedDate, hotelFilter],
    queryFn: async () => {
      const params: any = { date: selectedDate }
      if (hotelFilter) params.hotel = hotelFilter
      // We just fetch the first few payments to build a quick preview
      const [pay, bk, ord] = await Promise.allSettled([
        api.get('/payments/admin/', { params: { ...params, limit: 200 } }),
        api.get('/bookings/admin/', { params: { created_date: selectedDate, hotel: hotelFilter || undefined, limit: 200 } }),
        api.get('/orders/admin/',   { params: { date: selectedDate, hotel: hotelFilter || undefined, limit: 200 } }),
      ])
      return {
        payments: pay.status === 'fulfilled' ? unwrapList(pay.value.data) : [],
        bookings: bk.status === 'fulfilled'  ? unwrapList(bk.value.data)  : [],
        orders:   ord.status === 'fulfilled' ? unwrapList(ord.value.data) : [],
      }
    },
  })

  const totalRevenue = (preview?.payments || [])
    .filter((p: any) => p.status === 'success' && p.created_at?.startsWith(selectedDate))
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)

  const downloadReport = async () => {
    setDownloading(true)
    try {
      const params: any = { date: selectedDate }
      if (hotelFilter) params.hotel = hotelFilter
      const response = await api.get('/reports/daily/', {
        params,
        responseType: 'blob',
      })
      const url  = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href  = url
      link.setAttribute('download', `enayi-daily-report-${selectedDate}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Daily report downloaded!')
    } catch {
      toast.error('Failed to generate report. Try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-enayi-text flex items-center gap-2">
            <FileText size={26} className="text-enayi-gold" /> Daily Sales Report
          </h1>
          <p className="text-enayi-muted text-sm mt-1">
            Generate a comprehensive PDF sales report for any day — includes all bookings, orders, and payments.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-5 space-y-4">
        <h2 className="font-heading text-base text-enayi-text">Report Settings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-enayi-muted text-xs font-medium uppercase tracking-wider block mb-1.5">Report Date</label>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full bg-enayi-panel border border-enayi-border rounded-xl px-3 py-2.5 text-enayi-text text-sm outline-none focus:border-enayi-gold/50 transition-colors"
            />
          </div>
          {isAdmin && hotels && (
            <div>
              <label className="text-enayi-muted text-xs font-medium uppercase tracking-wider block mb-1.5">Branch</label>
              <Select value={hotelFilter} onChange={e => setHotelFilter(e.target.value)}>
                <option value="">All Branches</option>
                {hotels.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </Select>
            </div>
          )}
        </div>

        <Button variant="gold" onClick={downloadReport} loading={downloading} className="w-full sm:w-auto">
          <Download size={16} /> Download PDF Report for {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}
        </Button>
      </div>

      {/* Quick preview stats */}
      {isLoading ? <PageSpinner /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: TrendingUp, label: 'Revenue',   value: `₦${totalRevenue.toLocaleString()}`, color: 'text-enayi-gold' },
            { icon: Building2,  label: 'Bookings',  value: String((preview?.bookings || []).filter((b:any)=>b.created_at?.startsWith(selectedDate)).length), color: 'text-blue-400' },
            { icon: Users,      label: 'Orders',    value: String((preview?.orders || []).filter((o:any)=>o.created_at?.startsWith(selectedDate)).length), color: 'text-green-400' },
            { icon: Calendar,   label: 'Date',      value: new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' }), color: 'text-purple-400' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card p-4 space-y-2">
              <div className="flex items-center gap-2 text-enayi-muted text-xs uppercase tracking-wider">
                <Icon size={14} className={color} /> {label}
              </div>
              <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* What's included */}
      <div className="card p-5">
        <h2 className="font-heading text-base text-enayi-text mb-4">What's included in the report</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-enayi-muted">
          {[
            '📊 Daily summary — total revenue, bookings, check-ins, check-outs',
            '💳 Revenue breakdown by payment method (Cash, POS, Monnify, etc.)',
            '🛏️ All booking transactions with status and balance due',
            '🍽️ All food & bar orders with items and payment status',
            '💰 Full payment history with references',
            '📋 Outstanding balances highlighted for follow-up',
          ].map(item => (
            <div key={item} className="flex items-start gap-2">
              <span className="text-enayi-gold mt-0.5">▸</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-enayi-gold/5 border border-enayi-gold/20 rounded-xl text-xs text-enayi-muted">
          💡 <strong className="text-enayi-text">Tip:</strong> Download this report each evening and forward it to the Owner or keep it on file as your daily audit record. The PDF can be printed or shared via email/WhatsApp.
        </div>
      </div>
    </div>
  )
}
