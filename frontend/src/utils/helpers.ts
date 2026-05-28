// import { type ClassValue, clsx } from 'clsx'
// import { twMerge } from 'tailwind-merge'
// import { format, parseISO, differenceInDays } from 'date-fns'

// export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

// export const formatCurrency = (amount: number, currency = 'NGN') =>
//   new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)

// export const formatDate = (dateStr: string, fmt = 'MMM d, yyyy') => {
//   try { return format(parseISO(dateStr), fmt) }
//   catch { return dateStr }
// }

// export const formatDateTime = (dateStr: string) => {
//   try { return format(parseISO(dateStr), 'MMM d, yyyy · h:mm a') }
//   catch { return dateStr }
// }

// export const nightsBetween = (checkIn: string, checkOut: string) =>
//   differenceInDays(parseISO(checkOut), parseISO(checkIn))

// export const getStatusBadge = (status: string) => {
//   const map: Record<string, string> = {
//     pending: 'badge-gold', confirmed: 'badge-blue', checked_in: 'badge-green',
//     checked_out: 'badge-green', cancelled: 'badge-red', no_show: 'badge-red',
//     success: 'badge-green', failed: 'badge-red', preparing: 'badge-gold',
//     delivered: 'badge-green', ready: 'badge-blue', available: 'badge-green',
//     occupied: 'badge-red', maintenance: 'badge-gold', deposit_paid: 'badge-blue',
//     fully_paid: 'badge-green', completed: 'badge-green',
//   }
//   return map[status] || 'badge-gold'
// }

// export const truncate = (str: string, max = 120) =>
//   str.length > max ? str.slice(0, max) + '…' : str

// export const today = () => new Date().toISOString().split('T')[0]

// export const tomorrow = () => {
//   const d = new Date()
//   d.setDate(d.getDate() + 1)
//   return d.toISOString().split('T')[0]
// }

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const formatCurrency = (amount: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount)

export const formatDate = (dateStr: string, fmt = 'short') => {
  try {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      year: 'numeric', month: 'short', day: 'numeric'
    })
  } catch { return dateStr }
}

export const formatDateTime = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleString('en-NG', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return dateStr }
}

export const today = () => new Date().toISOString().split('T')[0]

export const tomorrow = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export const getStatusBadge = (status: string): string => {
  const map: Record<string, string> = {
    pending:      'badge-gold',
    confirmed:    'badge-blue',
    checked_in:   'badge-green',
    checked_out:  'badge-gray',
    cancelled:    'badge-red',
    success:      'badge-green',
    failed:       'badge-red',
    preparing:    'badge-gold',
    delivered:    'badge-green',
    available:    'badge-green',
    occupied:     'badge-red',
  }
  return map[status] ?? 'badge-gold'
}

export const truncate = (str: string, max = 120) =>
  str.length > max ? str.slice(0, max) + '…' : str