import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'
import { Calendar, ArrowRight } from 'lucide-react'
import api from '@/utils/api'
import { formatCurrency } from '@/utils/helpers'
import { PageSpinner } from '@/components/ui'
import type { EventHall } from '@/types'

export default function EventsPage() {
  const { data: halls, isLoading } = useQuery<EventHall[]>({
    queryKey: ['event-halls'],
    queryFn: () =>
      api.get('/events/halls/').then((r: AxiosResponse) => r.data.results),
  })

  if (isLoading) return <PageSpinner />

  return (
    <div className="bg-enayi-bg min-h-screen">

      {/* Hero Header */}
      <div className="section-sm bg-enayi-surface border-b border-enayi-border text-center">
        <div className="container-site">
          <div className="badge-gold inline-flex mb-4">
            <Calendar size={12} /> Event Halls
          </div>
          <h1 className="font-display text-5xl text-enayi-text mb-4">
            Host Your Event
          </h1>
          <div className="gold-line-center mb-5" />
          <p className="text-enayi-muted text-lg max-w-xl mx-auto">
            From intimate gatherings to grand celebrations — world-class venues in Jos.
          </p>
          <div className="flex gap-4 justify-center mt-6">
            <Link to="/events/book" className="btn-gold gap-2">
              Book Now <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Halls List */}
      <div className="container-site section space-y-6">
        {(halls ?? []).map((h) => (
          <div
            key={h.id}
            className="card-hover p-6 grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Hall Details */}
            <div className="md:col-span-2">
              <div className="flex justify-between mb-3">
                <h3 className="font-heading text-2xl text-enayi-text">{h.name}</h3>
                <span className="badge-gold text-xs">Floor {h.floor}</span>
              </div>

              <p className="text-enayi-muted text-sm mb-4">{h.description}</p>

              {/* Capacity Grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { l: 'Theatre',  v: h.capacity_seated   },
                  { l: 'Cocktail', v: h.capacity_cocktail },
                  { l: 'Banquet',  v: h.capacity_banquet  },
                ].map(({ l, v }) => (
                  <div key={l} className="card p-3 text-center">
                    <div className="text-enayi-gold font-display text-xl">{v}</div>
                    <div className="text-enayi-muted text-xs">{l}</div>
                  </div>
                ))}
              </div>  {/* ← closes Capacity Grid */}
            </div>  {/* ← closes md:col-span-2 */}

          {/* Pricing & CTA */}
            <div className="flex flex-col justify-between">
              <div className="card p-4 text-center mb-4">
                <div className="text-enayi-muted text-xs mb-1">Starting from</div>
                <div className="text-enayi-gold font-display text-2xl">
                  {formatCurrency(h.price_per_hour)}
                </div>
                <div className="text-enayi-muted text-xs">per hour</div>
              </div>
              <Link
                to={`/events/book?hall=${h.id}`}
                className="btn-gold w-full text-center gap-2"
              >
                Book This Hall <ArrowRight size={14} />
              </Link>
            </div>

          </div>
        ))}
      </div>

    </div>
  )
}