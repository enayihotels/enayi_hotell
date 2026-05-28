/**
 * PaymentCallback.tsx — Enayi Hotels & Suites
 *
 * Drop-in replacement for frontend/src/pages/guest/PaymentCallback.tsx
 *
 * CHANGES FROM ORIGINAL:
 *  1. Handles Monnify callback params (paymentReference, transactionReference)
 *  2. Detects which gateway returned the callback from query params
 *  3. Shows gateway name in UI during verification
 *  4. Handles 'cancelled' status from Flutterwave
 *  5. Deeper status polling with visual countdown
 */

import { useEffect, useState, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'
import api from '@/utils/api'

// ─────────────────────────────────────────────────────────────────────────────
// Gateway detection — each gateway sends different query params on return
// ─────────────────────────────────────────────────────────────────────────────
function detectGatewayReturn(params: URLSearchParams): {
  reference: string
  gateway:   string
  cancelled: boolean
} {
  const gateway = params.get('gateway') ?? ''

  // Flutterwave: ?tx_ref=...&status=cancelled|successful
  const flwRef    = params.get('tx_ref') ?? ''
  const flwStatus = params.get('status') ?? ''

  // Paystack: ?trxref=...&reference=...
  const psRef = params.get('reference') ?? params.get('trxref') ?? ''

  // Stripe: ?session_id=...
  const stripeSession = params.get('session_id') ?? ''

  // Monnify: ?paymentReference=...&transactionReference=...
  const monnifyRef = params.get('paymentReference') ?? ''

  // Determine reference — prefer explicit gateway param, fallback to sniffing
  if (monnifyRef) {
    return { reference: monnifyRef, gateway: 'Monnify', cancelled: false }
  }
  if (stripeSession) {
    return { reference: stripeSession, gateway: 'Stripe', cancelled: false }
  }
  if (flwRef) {
    return {
      reference: flwRef,
      gateway:   'Flutterwave',
      cancelled: flwStatus === 'cancelled',
    }
  }
  if (psRef) {
    return { reference: psRef, gateway: 'Paystack', cancelled: false }
  }

  // Fallback — gateway param was passed explicitly in our redirect URLs
  return { reference: '', gateway, cancelled: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function PaymentCallback() {
  const [search] = useSearchParams()
  const [status, setStatus]   = useState<'loading' | 'success' | 'failed' | 'cancelled'>('loading')
  const [gateway, setGateway] = useState('')
  const [attempts, setAttempts] = useState(0)
  const maxAttempts = 6             // poll up to 6 times (30 s)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const { reference, gateway: gw, cancelled } = detectGatewayReturn(search)
    setGateway(gw)

    if (cancelled) { setStatus('cancelled'); return }
    if (!reference) { setStatus('failed');   return }

    let attempt = 0

    const verify = async () => {
      try {
        const r = await api.get(`/payments/verify/${reference}/`)
        const s = r.data?.status ?? r.data?.payment?.status ?? ''

        if (s === 'success') {
          setStatus('success')
          return
        }
        if (s === 'failed' || s === 'abandoned') {
          setStatus('failed')
          return
        }
      } catch {
        // network error — keep polling
      }

      attempt++
      setAttempts(attempt)

      if (attempt < maxAttempts) {
        timerRef.current = setTimeout(verify, 5000)
      } else {
        // Max retries hit — treat as pending/failed
        setStatus('failed')
      }
    }

    verify()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <Screen>
        <div className="w-16 h-16 rounded-2xl bg-enayi-gold/10 border border-enayi-gold/20 flex items-center justify-center mx-auto mb-6">
          <Loader2 size={28} className="text-enayi-gold animate-spin" />
        </div>
        <h2 className="font-display text-2xl text-enayi-text mb-2">Verifying Payment…</h2>
        {gateway && (
          <p className="text-enayi-muted text-sm mb-4">Checking with {gateway}</p>
        )}
        <p className="text-enayi-muted text-xs">
          Please keep this page open. {attempts > 0 && `Check ${attempts} of ${maxAttempts}…`}
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {Array.from({ length: maxAttempts }).map((_, i) => (
            <div
              key={i}
              className={[
                'h-1 rounded-full transition-all duration-500',
                i < attempts ? 'w-4 bg-enayi-gold' : i === attempts ? 'w-4 bg-enayi-gold/50 animate-pulse' : 'w-2 bg-enayi-border',
              ].join(' ')}
            />
          ))}
        </div>
      </Screen>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <Screen>
        <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={28} className="text-green-400" />
        </div>
        <h2 className="font-display text-2xl text-enayi-text mb-2">Payment Successful! 🎉</h2>
        {gateway && <p className="text-enayi-muted text-sm mb-1">Processed via {gateway}</p>}
        <p className="text-enayi-muted text-sm mb-8">
          Your payment has been confirmed. Your booking is now active.
        </p>
        <div className="flex flex-col gap-3 w-full">
          <Link to="/my-bookings" className="btn-gold gap-2 flex justify-center">
            View My Bookings
          </Link>
          <Link to="/dashboard" className="btn-surface gap-2 flex justify-center">
            Back to Dashboard
          </Link>
        </div>
      </Screen>
    )
  }

  // ── Cancelled ─────────────────────────────────────────────────────────────
  if (status === 'cancelled') {
    return (
      <Screen>
        <div className="w-16 h-16 rounded-full bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center mx-auto mb-6">
          <Clock size={28} className="text-yellow-400" />
        </div>
        <h2 className="font-display text-2xl text-enayi-text mb-2">Payment Cancelled</h2>
        <p className="text-enayi-muted text-sm mb-8">
          You cancelled the payment. Your booking is still pending — you can complete payment from your bookings page.
        </p>
        <div className="flex flex-col gap-3 w-full">
          <Link to="/my-bookings" className="btn-gold gap-2 flex justify-center">
            My Bookings
          </Link>
          <Link to="/dashboard" className="btn-surface gap-2 flex justify-center">
            Back to Dashboard
          </Link>
        </div>
      </Screen>
    )
  }

  // ── Failed ───────────────────────────────────────────────────────────────
  return (
    <Screen>
      <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
        <XCircle size={28} className="text-red-400" />
      </div>
      <h2 className="font-display text-2xl text-enayi-text mb-2">Payment Failed</h2>
      <p className="text-enayi-muted text-sm mb-8">
        We couldn't confirm your payment. Please try again or contact the front desk.
      </p>
      <div className="flex flex-col gap-3 w-full">
        <Link to="/my-bookings" className="btn-gold gap-2 flex justify-center">
          Try Again
        </Link>
        <a href="tel:+2348000000000" className="btn-surface gap-2 flex justify-center">
          📞 Call Front Desk
        </a>
      </div>
    </Screen>
  )
}

/** Reusable centred card wrapper */
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-enayi-bg flex items-center justify-center p-6">
      <div className="card-gold p-10 rounded-3xl text-center max-w-md w-full">
        {children}
      </div>
    </div>
  )
}
