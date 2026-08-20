import { useState } from 'react'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import { Download, Printer } from 'lucide-react'

interface Props {
  type: 'booking' | 'order'
  id: string
  reference: string   // booking_reference or order_number — used in filename
  size?: 'sm' | 'md'
  variant?: 'download' | 'print'
}

export function ReceiptButton({ type, id, reference, size = 'sm', variant = 'download' }: Props) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const url    = `/reports/receipt/${type}/${id}/`
      const response = await api.get(url, { responseType: 'blob' })
      const blob   = new Blob([response.data], { type: 'application/pdf' })
      const blobUrl = window.URL.createObjectURL(blob)

      if (variant === 'print') {
        // Open in new tab so user can use browser's print dialog
        const w = window.open(blobUrl, '_blank')
        if (w) {
          w.onload = () => {
            w.focus()
            w.print()
          }
        }
      } else {
        // Download directly
        const link = document.createElement('a')
        link.href  = blobUrl
        link.setAttribute('download', `${type === 'booking' ? 'booking' : 'order'}-receipt-${reference}.pdf`)
        document.body.appendChild(link)
        link.click()
        link.remove()
      }
      window.URL.revokeObjectURL(blobUrl)
      toast.success(`Receipt ${variant === 'print' ? 'opened' : 'downloaded'}!`)
    } catch {
      toast.error('Could not load receipt. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const sizeClass = size === 'sm'
    ? 'px-3 py-1.5 text-xs gap-1.5'
    : 'px-4 py-2 text-sm gap-2'

  const Icon = variant === 'print' ? Printer : Download

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center ${sizeClass} rounded-lg border border-enayi-gold/40 text-enayi-gold hover:bg-enayi-gold/10 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <Icon size={size === 'sm' ? 12 : 14} className={loading ? 'animate-pulse' : ''} />
      {loading ? 'Loading…' : variant === 'print' ? 'Print' : 'Receipt'}
    </button>
  )
}
