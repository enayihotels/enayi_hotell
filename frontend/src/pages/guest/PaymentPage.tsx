/**
 * PaymentPage.tsx — Enayi Hotels & Suites
 *
 * Drop-in replacement for frontend/src/pages/guest/PaymentPage.tsx
 *
 * CHANGES FROM ORIGINAL:
 *  1. Monnify gateway added (was missing)
 *  2. Each gateway has a distinct brand colour, real icon, and description
 *  3. Redirect gateways (Flutterwave/Paystack/Stripe/Monnify) show a loading
 *     overlay while the API call is in-flight instead of nothing
 *  4. Bank-Transfer section shows all three hotel accounts with copy buttons
 *  5. USSD section includes step-by-step instructions inline
 *  6. Cash/POS section includes a WhatsApp link to front desk
 *  7. Proper TypeScript (no `any`)
 */

import { useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  CreditCard, Smartphone, Building2, Banknote,
  ArrowRight, Loader2, Copy, CheckCircle2,
  Zap, Globe, Landmark, Phone, ChevronRight,
} from 'lucide-react'
import { useInitiatePayment, useUSSDBanks } from '@/hooks/usePayment'
import { formatCurrency } from '@/utils/helpers'
import toast from 'react-hot-toast'
import type { PaymentInitResponse } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type PaymentMethodId =
  | 'flutterwave' | 'paystack' | 'stripe' | 'monnify'
  | 'ussd' | 'bank_transfer' | 'cash' | 'pos'

interface MethodConfig {
  id:        PaymentMethodId
  label:     string
  tagline:   string
  icon:      React.ElementType
  color:     string          // Tailwind text colour
  bg:        string          // Tailwind bg colour (10% opacity ring)
  dot:       string          // solid dot colour
  badge?:    string          // optional badge text
}

// ─────────────────────────────────────────────────────────────────────────────
// Gateway configuration
// ─────────────────────────────────────────────────────────────────────────────
const METHODS: MethodConfig[] = [
  {
    id:      'flutterwave',
    label:   'Flutterwave',
    tagline: 'Card · Bank · USSD · Mobile money',
    icon:    Zap,
    color:   'text-orange-400',
    bg:      'bg-orange-400/10',
    dot:     'bg-orange-400',
    badge:   'Most popular',
  },
  {
    id:      'paystack',
    label:   'Paystack',
    tagline: 'Card · Bank · USSD · Bank Transfer',
    icon:    CreditCard,
    color:   'text-blue-400',
    bg:      'bg-blue-400/10',
    dot:     'bg-blue-400',
  },
  {
    id:      'stripe',
    label:   'Stripe',
    tagline: 'International cards · Apple/Google Pay',
    icon:    Globe,
    color:   'text-violet-400',
    bg:      'bg-violet-400/10',
    dot:     'bg-violet-400',
    badge:   'International',
  },
  {
    id:      'monnify',
    label:   'Monnify',
    tagline: 'Card · Bank Transfer · USSD',
    icon:    Landmark,
    color:   'text-emerald-400',
    bg:      'bg-emerald-400/10',
    dot:     'bg-emerald-400',
  },
  {
    id:      'ussd',
    label:   'USSD',
    tagline: 'Dial from any phone — no internet needed',
    icon:    Smartphone,
    color:   'text-yellow-400',
    bg:      'bg-yellow-400/10',
    dot:     'bg-yellow-400',
  },
  {
    id:      'bank_transfer',
    label:   'Bank Transfer',
    tagline: 'Transfer directly to our account',
    icon:    Building2,
    color:   'text-enayi-gold',
    bg:      'bg-enayi-gold/10',
    dot:     'bg-enayi-gold',
  },
  {
    id:      'cash',
    label:   'Cash / POS',
    tagline: 'Pay at the front desk — 24 / 7',
    icon:    Banknote,
    color:   'text-green-400',
    bg:      'bg-green-400/10',
    dot:     'bg-green-400',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function copyToClipboard(text: string, label = 'Copied!') {
  navigator.clipboard.writeText(text)
  toast.success(label)
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Single copy-row used in bank transfer + USSD instructions */
function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-enayi-panel border border-enayi-border">
      <div>
        <div className="text-enayi-muted text-xs">{label}</div>
        <div className="text-enayi-text text-sm font-semibold font-mono">{value}</div>
      </div>
      <button
        onClick={() => copyToClipboard(value, `${label} copied`)}
        className="p-2 rounded-lg text-enayi-muted hover:text-enayi-gold hover:bg-enayi-gold/10 transition-all"
        title="Copy"
      >
        <Copy size={13} />
      </button>
    </div>
  )
}

/** Redirect-gateway loading overlay */
function RedirectOverlay({ gateway }: { gateway: string }) {
  return (
    <div className="card-gold p-8 rounded-2xl text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-enayi-gold/10 border border-enayi-gold/20 flex items-center justify-center mx-auto">
        <Loader2 size={24} className="text-enayi-gold animate-spin" />
      </div>
      <div>
        <h3 className="font-display text-xl text-enayi-text">Redirecting to {gateway}</h3>
        <p className="text-enayi-muted text-sm mt-1">
          You'll be taken to a secure checkout page. Do not close this tab.
        </p>
      </div>
      <div className="flex items-center gap-2 justify-center text-xs text-enayi-muted">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        Secure · Encrypted · PCI-DSS compliant
      </div>
    </div>
  )
}

/** Bank Transfer result panel */
function BankTransferPanel({ result, amount, reference }: {
  result:    PaymentInitResponse
  amount:    number
  reference: string
}) {
  const accounts = [
    { bank: result.bank_name ?? 'GTB',         acct: result.account_number ?? '',         name: result.account_name ?? 'ENAYI HOTELS & SUITES LTD' },
    ...((result.also_accepted ?? []) as { bank: string; account: string; name: string }[])
      .map(a => ({ bank: a.bank, acct: a.account, name: a.name })),
  ]

  return (
    <div className="space-y-3">
      <p className="text-enayi-muted text-sm text-center">
        Transfer <span className="text-enayi-gold font-semibold">{result.amount ?? formatCurrency(amount)}</span> to
        any of the accounts below.
      </p>

      {accounts.map((a, i) => (
        <div key={i} className="card p-4 space-y-2">
          <div className="text-xs font-semibold text-enayi-gold mb-2">{a.bank}</div>
          <CopyRow label="Account Number" value={a.acct} />
          <CopyRow label="Account Name"   value={a.name} />
        </div>
      ))}

      <div className="card p-3 space-y-2">
        <div className="text-xs font-semibold text-enayi-muted uppercase tracking-wider mb-1">Transfer Narration</div>
        <CopyRow label="Use this exact narration" value={`REF: ${reference}`} />
      </div>

      <div className="flex items-start gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-xs text-yellow-300">
        <span className="text-base leading-none">⚠️</span>
        <span>{result.important ?? 'Always include the reference as your transfer narration for automatic matching.'}</span>
      </div>
    </div>
  )
}

/** USSD result panel */
function USSDPanel({ result }: { result: PaymentInitResponse }) {
  return (
    <div className="space-y-4">
      <div className="card-gold p-6 text-center rounded-2xl">
        <div className="font-display text-5xl text-enayi-gold mb-1 tracking-wide">
          {result.ussd_code}
        </div>
        <div className="text-enayi-muted text-sm">{result.bank_name}</div>
      </div>

      <div className="card p-4 space-y-2">
        {(result.instructions ?? []).map((ins, i) => (
          <div key={i} className="flex gap-3 text-sm items-start py-1.5 border-b border-enayi-border last:border-0">
            <span className="w-5 h-5 rounded-full bg-enayi-gold/15 text-enayi-gold text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">
              {i + 1}
            </span>
            <span className="text-enayi-muted">{ins}</span>
          </div>
        ))}
      </div>

      <CopyRow label="Payment Reference" value={result.transaction_reference} />

      <div className="text-center text-xs text-enayi-muted">
        Session expires in <span className="text-enayi-gold font-semibold">30 minutes</span>
      </div>
    </div>
  )
}

/** Cash / POS result panel */
function CashPOSPanel({ result, method }: { result: PaymentInitResponse; method: string }) {
  const waLink = `https://wa.me/${(result.phone ?? '').replace(/[^0-9]/g, '')}?text=Hi, I'd like to pay for my booking. Reference: ${result.transaction_reference}`
  return (
    <div className="space-y-4">
      <div className="card p-6 text-center space-y-2">
        <div className="text-4xl mb-3">{method === 'pos' ? '🖥️' : '💵'}</div>
        <p className="text-enayi-text font-medium">{result.message}</p>
        <p className="text-enayi-muted text-sm">{result.front_desk}</p>
      </div>
      <CopyRow label="Your Reference" value={result.transaction_reference} />
      {result.phone && (
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          className="btn-gold w-full gap-2 flex justify-center"
        >
          <Phone size={14} /> WhatsApp Front Desk
        </a>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function PaymentPage() {
  const { id }          = useParams<{ id: string }>()
  const [search]        = useSearchParams()
  const purpose         = search.get('purpose') ?? 'booking'
  const amount          = Number(search.get('amount') ?? 0)
  const narration       = search.get('narration') ?? `${purpose} — Enayi Hotels`

  const [method, setMethod]     = useState<PaymentMethodId>('flutterwave')
  const [bankCode, setBankCode] = useState('058')
  const [result, setResult]     = useState<PaymentInitResponse | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const [activeGateway, setActiveGateway] = useState('')

  const initiate         = useInitiatePayment()
  const { data: banks }  = useUSSDBanks()

  const selectedConfig = METHODS.find(m => m.id === method)!

  const handlePay = async () => {
    try {
      const data = await initiate.mutateAsync({
        purpose,
        method,
        amount,
        narration,
        bank_code:  method === 'ussd' ? bankCode : undefined,
        metadata:   { booking_id: id },
      })
      if (!data) return
      setResult(data)

      // Redirect gateways: go to hosted checkout
      if (data.payment_link) {
        setRedirecting(true)
        setActiveGateway(selectedConfig.label)
        setTimeout(() => { window.location.href = data.payment_link! }, 800)
      }
    } catch {
      // error toasted by the hook
    }
  }

  // ── Redirect overlay ──────────────────────────────────────────────────────
  if (redirecting) {
    return (
      <div className="max-w-lg mx-auto pt-8 space-y-6">
        <RedirectOverlay gateway={activeGateway} />
      </div>
    )
  }

  // ── Post-payment result (USSD, Bank Transfer, Cash/POS) ───────────────────
  if (result && !result.payment_link) {
    return (
      <div className="max-w-lg mx-auto pt-4 space-y-6">
        {/* Header */}
        <div className="card-gold p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-400/15 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-green-400" />
            </div>
            <div>
              <h2 className="font-display text-xl text-enayi-text">Payment Initiated</h2>
              <p className="text-enayi-muted text-xs capitalize">{purpose.replace('_', ' ')} · {formatCurrency(amount)}</p>
            </div>
          </div>
          <CopyRow label="Transaction Reference" value={result.transaction_reference} />
        </div>

        {/* Gateway-specific panel */}
        {method === 'ussd'          && <USSDPanel result={result} />}
        {method === 'bank_transfer' && <BankTransferPanel result={result} amount={amount} reference={result.transaction_reference} />}
        {(method === 'cash' || method === 'pos') && <CashPOSPanel result={result} method={method} />}

        <Link to="/my-bookings" className="btn-gold w-full gap-2 flex justify-center">
          View My Bookings <ArrowRight size={15} />
        </Link>
      </div>
    )
  }

  // ── Main selection UI ─────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto pt-4 space-y-6">

      {/* Page title */}
      <div>
        <h1 className="font-display text-3xl text-enayi-text">Complete Payment</h1>
        <p className="text-enayi-muted text-sm mt-1 capitalize">
          {purpose.replace('_', ' ')}
          {id ? <span className="text-enayi-muted/50 ml-2 text-xs font-mono">#{id.slice(0, 8)}</span> : null}
        </p>
      </div>

      {/* Amount card */}
      <div className="card-gold p-5 rounded-2xl flex items-center justify-between">
        <div>
          <p className="text-enayi-muted text-xs uppercase tracking-widest mb-1">Amount Due</p>
          <p className="font-display text-4xl text-enayi-gold">{formatCurrency(amount)}</p>
        </div>
        <div className="text-right">
          <span className="badge-gold text-xs">NGN</span>
          <p className="text-enayi-muted text-xs mt-1">Secure checkout</p>
        </div>
      </div>

      {/* Method selector */}
      <div className="card p-5">
        <h2 className="font-heading text-base text-enayi-text mb-4 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-enayi-gold inline-block" />
          Choose Payment Method
        </h2>

        <div className="space-y-2">
          {METHODS.map(m => {
            const active = method === m.id
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={[
                  'w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all duration-200',
                  active
                    ? 'border border-enayi-gold/50 bg-enayi-gold/5 shadow-[0_0_0_1px_rgba(201,168,76,0.15)]'
                    : 'card hover:border-enayi-gold/20 hover:bg-enayi-gold/[0.02]',
                ].join(' ')}
              >
                {/* Icon */}
                <div className={[
                  'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                  active ? `${m.bg} ${m.color}` : 'bg-enayi-panel text-enayi-muted',
                ].join(' ')}>
                  <m.icon size={16} />
                </div>

                {/* Label + tagline */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium transition-colors ${active ? 'text-enayi-text' : 'text-enayi-muted'}`}>
                      {m.label}
                    </span>
                    {m.badge && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-enayi-gold/15 text-enayi-gold border border-enayi-gold/20">
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-enayi-muted text-xs mt-0.5 truncate">{m.tagline}</p>
                </div>

                {/* Selection indicator */}
                <div className={[
                  'w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-all',
                  active ? 'border-enayi-gold' : 'border-enayi-border',
                ].join(' ')}>
                  {active && <div className="w-2 h-2 rounded-full bg-enayi-gold" />}
                </div>
              </button>
            )
          })}
        </div>

        {/* USSD bank picker */}
        {method === 'ussd' && (
          <div className="mt-4 form-group animate-[fadeUp_0.2s_ease_forwards]">
            <label className="label">Select Your Bank</label>
            <select
              value={bankCode}
              onChange={e => setBankCode(e.target.value)}
              className="input"
            >
              {((banks ?? []) as { code: string; name: string; ussd_code: string }[]).map(b => (
                <option key={b.code} value={b.code}>
                  {b.name}  —  {b.ussd_code}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Info strip for redirect gateways */}
        {['flutterwave', 'paystack', 'stripe', 'monnify'].includes(method) && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-enayi-panel text-xs text-enayi-muted">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedConfig.dot}`} />
            You'll be redirected to <span className="text-enayi-text font-medium mx-1">{selectedConfig.label}</span> to complete payment securely.
          </div>
        )}
      </div>

      {/* Pay button */}
      <button
        onClick={handlePay}
        disabled={initiate.isPending}
        className="btn-gold w-full gap-2 text-base py-4"
      >
        {initiate.isPending ? (
          <><Loader2 size={16} className="animate-spin" />Processing…</>
        ) : (
          <>
            Pay {formatCurrency(amount)}
            <ChevronRight size={16} />
          </>
        )}
      </button>

      {/* Trust badge */}
      <div className="flex items-center justify-center gap-4 text-xs text-enayi-muted/60 pb-4">
        {['🔒 SSL Encrypted', '✓ PCI-DSS', '🏦 Bank-grade Security'].map(t => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  )
}
