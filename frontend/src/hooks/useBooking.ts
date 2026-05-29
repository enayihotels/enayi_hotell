import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api, { getErrorMessage, unwrap } from '@/utils/api'
import type { Booking } from '@/types'

queryFn: () => api.get('/bookings/my/').then(r => unwrap<Booking>(r.data))

// ── Fetch all my bookings ──────────────────────────────
export const useMyBookings = () =>
  useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: () => api.get('/bookings/my/').then(r => {
      const data = r.data
      return Array.isArray(data) ? data : (data?.results ?? [])
    }),
  })

// ── Fetch single booking ───────────────────────────────
export const useBooking = (id: string) =>
  useQuery<Booking>({
    queryKey: ['booking', id],
    queryFn: () => api.get(`/bookings/${id}/`).then(r => r.data),
    enabled: !!id,
  })

// ── Create a booking ───────────────────────────────────
export const useCreateBooking = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (data: {
      category_id: string
      hotel_id?: string
      check_in: string
      check_out: string
      adults: number
      children: number
      special_requests?: string
      breakfast_included?: boolean
      airport_pickup?: boolean
      late_checkout?: boolean
      early_checkin?: boolean
    }) => api.post('/bookings/', data).then(r => r.data),
    onSuccess: (booking: Booking) => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      toast.success(`Booking ${booking.booking_reference} created! 🎉`)
      navigate(`/payment/${booking.id}?purpose=booking&amount=${booking.total_amount}`)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ── Cancel a booking ───────────────────────────────────
export const useCancelBooking = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post(`/bookings/${id}/cancel/`, { reason }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      toast.success('Booking cancelled successfully.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ── Check room availability ────────────────────────────
export const useRoomAvailability = (params: {
  check_in: string
  check_out: string
  adults: number
} | null) =>
  useQuery({
    queryKey: ['availability', params],
    queryFn: () => api.post('/rooms/availability/', params).then(r => r.data),
    enabled: !!(params?.check_in && params?.check_out),
  })
