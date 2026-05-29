/**
 * PaymentComponents.tsx — Enayi Hotels & Suites
 *
 * New file: frontend/src/components/payment/PaymentComponents.tsx
 *
 * Reusable components used across the app wherever payment info is displayed:
 *   - PaymentStatusBadge  — coloured badge for pending/success/failed etc.
 *   - PaymentMethodIcon   — icon + colour for each gateway
 *   - PaymentCard         — compact card for payment history rows
 *   - RetryPaymentButton  — navigates to /payment/:id with pre-filled params
 */

import { useNavigate } from 'react-router-dom'
import {
  CreditCard, Smartphone, Building2, Banknote,
  Zap, Globe, Landmark, CheckCircle2, XCircle,
  Clock, RefreshCw, AlertCircle,
} from 'lucide-react'
import type { Payment } from '@/hooks/usePayment'

// ─────────────────────────────────────────────────────────────────────────────
// PaymentStatusBadge
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  pending:   { label: 'Pending',    icon: Clock,         cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  success:   { label: 'Paid',       icon: CheckCircle2,  cls: 'bg-green-500/10  text-green-400  border-green-500/20'  },
  failed:    { label: 'Failed',     icon: XCircle,       cls: 'bg-red-500/10    text-red-400    border-red-500/20'    },
  refunded:  { label: 'Refunded',   icon: RefreshCw,     cls: 'bg-blue-500/10   text-blue-400   border-blue-500/20'   },
  abandoned: { label: 'Abandoned',  icon: AlertCircle,   cls: 'bg-enayi-panel   text-enayi-muted border-enayi-border' },
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.abandoned
  return (
    <span className={`badge border ${cfg.cls}`}>
      <cfg.icon size={10} />
      {cfg.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PaymentMethodIcon
// ─────────────────────────────────────────────────────────────────────────────
const METHOD_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  flutterwave:   { icon: Zap,       color: 'text-orange-400', bg: 'bg-orange-400/10'  },
  paystack:      { icon: CreditCard,color: 'text-blue-400',   bg: 'bg-blue-400/10'    },
  stripe:        { icon: Globe,     color: 'text-violet-400', bg: 'bg-violet-400/10'  },
  monnify:       { icon: Landmark,  color: 'text-emerald-400',bg: 'bg-emerald-400/10' },
  ussd:          { icon: Smartphone,color: 'text-yellow-400', bg: 'bg-yellow-400/10'  },
  bank_transfer: { icon: Building2, color: 'text-enayi-gold', bg: 'bg-enayi-gold/10'  },
  cash:          { icon: Banknote,  color: 'text-green-400',  bg: 'bg-green-400/10'   },
  pos:           { icon: Banknote,  color: 'text-green-400',  bg: 'bg-green-400/10'   },
  paypal:        { icon: Globe,     color: 'text-blue-300',   bg: 'bg-blue-300/10'    },
}

export function PaymentMethodIcon({ method, size = 14 }: { method: string; size?: number }) {
  const cfg = METHOD_CONFIG[method] ?? METHOD_CONFIG.cash
  return (
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.bg}`}>
      <cfg.icon size={size} className={cfg.color} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PaymentCard  (used in payment history lists)
// ─────────────────────────────────────────────────────────────────────────────
export function PaymentCard({ payment }: { payment: Payment }) {
  const navigate = useNavigate()

  const formatAmount = (v: string | number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(Number(v))

  return (
    <div className="card p-4 flex items-center gap-4">
      <PaymentMethodIcon method={payment.method} size={14} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-enayi-text text-sm font-medium capitalize">
            {payment.method.replace('_', ' ')}
          </span>
          <PaymentStatusBadge status={payment.status} />
        </div>
        <div className="text-enayi-muted text-xs mt-0.5 font-mono truncate">
          {payment.transaction_reference}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-enayi-text text-sm font-semibold">{formatAmount(payment.amount)}</div>
        <div className="text-enayi-muted text-xs capitalize">{payment.purpose}</div>
      </div>

      {payment.status === 'pending' && (
        <button
          onClick={() => navigate(`/payment/${payment.id}?purpose=${payment.purpose}&amount=${payment.amount}`)}
          className="ml-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20 hover:bg-enayi-gold/20 transition-colors flex-shrink-0"
        >
          Pay Now
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RetryPaymentButton  (use in MyBookingsPage for pending bookings)
// ─────────────────────────────────────────────────────────────────────────────
export function RetryPaymentButton({
  bookingId,
  amount,
  purpose = 'booking',
}: {
  bookingId: string
  amount:    number | string
  purpose?:  string
}) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/payment/${bookingId}?purpose=${purpose}&amount=${amount}`)}
      className="btn-gold gap-1.5 text-xs px-4 py-2"
    >
      Complete Payment
    </button>
  )
}
