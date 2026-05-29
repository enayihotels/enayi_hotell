import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import type { EventHall, EventBooking } from '@/types'

// ── Fetch all event halls ─────────────────────────────────────
export const useEventHalls = () =>
  useQuery<EventHall[]>({
    queryKey: ['event-halls'],
    queryFn: () =>
      api.get('/events/halls/').then(r => r.data?.results ?? r.data),
  })

// ── Fetch a single hall by ID ─────────────────────────────────
export const useEventHall = (id?: string) =>
  useQuery<EventHall>({
    queryKey: ['event-hall', id],
    queryFn: () => api.get(`/events/halls/${id}/`).then(r => r.data),
    enabled: !!id,
  })

// ── Fetch the pre-selected hall from ?hall=<id> URL param ─────
export const useSelectedHall = () => {
  const [params] = useSearchParams()
  const hallId   = params.get('hall') ?? undefined
  return useEventHall(hallId)
}

// ── Fetch current user's event bookings ──────────────────────
export const useMyEventBookings = () =>
  useQuery<EventBooking[]>({
    queryKey: ['my-event-bookings'],
    queryFn: () =>
      api.get('/events/bookings/my/').then(r => r.data?.results ?? r.data),
  })

// ── Fetch all event bookings (staff/admin) ───────────────────
export const useAllEventBookings = () =>
  useQuery<EventBooking[]>({queryKey: ['all-event-bookings'],queryFn: () =>api.get('/events/bookings/').then(r => r.data?.results ?? r.data),
  })

// ── Book an event hall ────────────────────────────────────────
export const useBookEvent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      hall: string
      event_name: string
      event_type: string
      start_datetime: string
      end_datetime: string
      guest_count: number
      special_requests?: string
      contact_phone?: string
    }) => api.post<EventBooking>('/events/bookings/', data).then(r => r.data), // ← type the Axios call
    onSuccess: (booking) => {   // ← remove explicit `: EventBooking` annotation; inferred from above
      queryClient.invalidateQueries({ queryKey: ['my-event-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['all-event-bookings'] })
      toast.success(`Event booking confirmed! Ref: ${booking.booking_reference} 🎉`)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ── Cancel an event booking ───────────────────────────────────
export const useCancelEventBooking = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/events/bookings/${id}/cancel/`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-event-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['all-event-bookings'] })
      toast.success('Event booking cancelled.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ── Update event booking status (staff/admin) ─────────────────
export const useUpdateEventBookingStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/events/bookings/${id}/status/`, { status }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-event-bookings'] })
      toast.success('Booking status updated.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}