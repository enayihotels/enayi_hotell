import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'
import api, { getErrorMessage } from '@/utils/api'
import { formatCurrency, today } from '@/utils/helpers'
import { useForm } from 'react-hook-form'
import { PageSpinner } from '@/components/ui'
import toast from 'react-hot-toast'
import type { EventHall } from '@/types'

export default function EventBookingPage() {
  const [selectedHall, setSelectedHall] = useState<string>('')

  const { data: halls, isLoading } = useQuery<EventHall[]>({
    queryKey: ['event-halls'],
    queryFn: () => api.get('/events/halls/').then(r => r.data?.results ?? r.data),
  })

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      event_name: '', event_type: 'corporate', event_date: '',
      start_time: '08:00', end_time: '18:00', setup_time: '07:00',
      expected_guests: 50, setup_style: 'theatre',
      catering_required: false, decoration_required: false,
      photography_required: false, special_requests: '',
      contact_phone: '', contact_email: '',
    },
  })

  const navigate = useNavigate()
  const qc = useQueryClient()

  const createEvent = useMutation({
    mutationFn: (data: any) =>
      api.post('/events/bookings/', { ...data, hall_id: selectedHall }).then(r => r.data),
    onSuccess: (ev) => {
      qc.invalidateQueries({ queryKey: ['my-events'] })
      toast.success(`Event ${ev.booking_reference} booked!`)
      navigate(`/payment/${ev.id}?purpose=event&amount=${ev.deposit_amount}`)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (isLoading) return <PageSpinner />

  const hall = (halls ?? []).find(h => h.id === selectedHall)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-enayi-text">Book an Event Hall</h1>
        <p className="text-enayi-muted text-sm mt-1">Enayi Hotels & Suites — Jos, Plateau State</p>
      </div>

      <form onSubmit={handleSubmit(d => createEvent.mutate(d))}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">

            {/* Hall Selection */}
            <div className="card p-5">
              <h2 className="font-heading text-lg text-enayi-text mb-4">Select Event Hall</h2>
              <div className="space-y-3">
                {(halls ?? []).map(h => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setSelectedHall(h.id)}
                    className={`w-full text-left card p-4 transition-all ${
                      selectedHall === h.id
                        ? 'border-enayi-gold bg-enayi-gold/5'
                        : 'hover:border-enayi-gold/30'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-enayi-text">{h.name}</div>
                        <div className="text-enayi-muted text-xs mt-1">
                          Up to {h.capacity_seated} seated · {h.size_sqm}m²
                        </div>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {h.has_projector    && <span className="badge-gold text-[10px]">Projector</span>}
                          {h.has_sound_system && <span className="badge-gold text-[10px]">Sound</span>}
                          {h.has_wifi         && <span className="badge-gold text-[10px]">Wi-Fi</span>}
                          {h.has_stage        && <span className="badge-gold text-[10px]">Stage</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-enayi-gold font-display text-lg">
                          {formatCurrency(h.price_full_day)}
                        </div>
                        <div className="text-enayi-muted text-xs">full day</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Event Details */}
            <div className="card p-5 space-y-4">
              <h2 className="font-heading text-lg text-enayi-text">Event Details</h2>
              <div className="form-group">
                <label className="label">Event Name *</label>
                <input {...register('event_name', { required: true })} className="input" placeholder="e.g. Annual Company Conference" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Event Type</label>
                  <select {...register('event_type')} className="input">
                    {['wedding','corporate','birthday','graduation','naming',
                      'burial','product_launch','concert','custom'].map(t => (
                      <option key={t} value={t} className="capitalize">
                        {t.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Expected Guests</label>
                  <input {...register('expected_guests', { required: true, min: 1 })} type="number" className="input" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="form-group">
                  <label className="label">Event Date</label>
                  <input {...register('event_date', { required: true })} type="date" className="input" min={today()} />
                </div>
                <div className="form-group">
                  <label className="label">Start Time</label>
                  <input {...register('start_time')} type="time" className="input" />
                </div>
                <div className="form-group">
                  <label className="label">End Time</label>
                  <input {...register('end_time')} type="time" className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Contact Phone</label>
                  <input {...register('contact_phone')} type="tel" className="input" placeholder="+234..." />
                </div>
                <div className="form-group">
                  <label className="label">Contact Email</label>
                  <input {...register('contact_email')} type="email" className="input" />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Special Requests</label>
                <textarea {...register('special_requests')} className="input" rows={3} placeholder="Theme, special arrangements, etc." />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { name: 'catering_required',    label: 'Catering'     },
                  { name: 'decoration_required',  label: 'Decoration'   },
                  { name: 'photography_required', label: 'Photography'  },
                  { name: 'mc_required',          label: 'MC'           },
                  { name: 'live_band_required',   label: 'Live Band'    },
                  { name: 'dj_required',          label: 'DJ'           },
                ].map(({ name, label }) => (
                  <label key={name} className="flex items-center gap-2 card p-3 cursor-pointer hover:border-enayi-gold/20">
                    <input {...register(name as any)} type="checkbox" className="accent-enayi-gold" />
                    <span className="text-enayi-text text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

          </div>

          {/* Summary Sidebar */}
          <div>
            <div className="card-gold p-5 rounded-2xl sticky top-4">
              <h2 className="font-heading text-lg text-enayi-text mb-4">Summary</h2>
              {hall ? (
                <div className="space-y-2 text-sm mb-5">
                  <div className="flex justify-between">
                    <span className="text-enayi-muted">Hall</span>
                    <span className="text-enayi-text">{hall.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-enayi-muted">Full Day Rate</span>
                    <span className="text-enayi-text">{formatCurrency(hall.price_full_day)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-enayi-muted">Deposit ({hall.deposit_percent}%)</span>
                    <span className="text-enayi-gold font-semibold">
                      {formatCurrency(hall.price_full_day * hall.deposit_percent / 100)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-enayi-muted text-sm text-center py-6">
                  Select a hall to see pricing
                </p>
              )}
              <button
                type="submit"
                disabled={isSubmitting || !selectedHall}
                className="btn-gold w-full gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? <><Loader2 size={14} className="animate-spin" />Processing…</>
                  : <>Confirm Booking <ArrowRight size={14} /></>}
              </button>
            </div>
          </div>

        </div>
      </form>
    </div>
  )
}