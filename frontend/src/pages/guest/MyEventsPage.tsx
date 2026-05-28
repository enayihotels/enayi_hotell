import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Calendar, ArrowRight } from 'lucide-react'
import api from '@/utils/api'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { StatusBadge, EmptyState, PageSpinner } from '@/components/ui'
import type { EventBooking } from '@/types'

export default function MyEventsPage() {
  const { data: events, isLoading } = useQuery<EventBooking[]>({
    queryKey: ['my-events'],
    queryFn: () => api.get('/events/bookings/my/').then(r => r.data?.results ?? r.data), // ← fixed
  })

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-enayi-text">My Events</h1>
          <p className="text-enayi-muted text-sm mt-1">{events?.length ?? 0} event bookings</p>
        </div>
        <Link to="/events/book" className="btn-gold gap-2 text-sm">
          New Event <ArrowRight size={14} />
        </Link>
      </div>

      {(!events || events.length === 0) ? (
        <EmptyState
          icon={Calendar}
          title="No events yet"
          desc="Book an event hall for your next occasion."
          action={
            <Link to="/events/book" className="btn-gold text-sm gap-2">
              Book Event Hall <ArrowRight size={14} />
            </Link>
          }
        />
      ) : (
        events.map(ev => (
          <div key={ev.id} className="card-hover p-5">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="font-heading text-lg text-enayi-text">{ev.event_name}</div>
                <div className="text-enayi-muted text-xs mt-1">
                  {ev.hall_name} · {formatDate(ev.event_date)} · Ref: {ev.booking_reference}
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span className="badge-gold text-xs capitalize">
                    {ev.event_type.replace('_', ' ')}
                  </span>
                  <span className="badge text-xs bg-enayi-subtle text-enayi-muted border-enayi-border">
                    {ev.expected_guests} guests
                  </span>
                  <span className="badge text-xs bg-enayi-subtle text-enayi-muted border-enayi-border">
                    {ev.start_time} – {ev.end_time}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-enayi-gold font-display text-xl">
                  {formatCurrency(ev.total_amount)}
                </div>
                <div className="text-enayi-muted text-xs">
                  Deposit: {formatCurrency(ev.deposit_amount)}
                </div>
                <StatusBadge status={ev.status} />
              </div>
            </div>

            {ev.balance_due > 0 && ['pending', 'confirmed', 'deposit_paid'].includes(ev.status) && (
              <div className="mt-4 pt-4 border-t border-enayi-border">
                <Link
                  to={`/payment/${ev.id}?purpose=event&amount=${ev.balance_due}`}
                  className="btn-gold text-xs gap-2 px-4 py-2"
                >
                  Pay {formatCurrency(ev.balance_due)}
                </Link>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}