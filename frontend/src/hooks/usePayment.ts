/**
 * usePayment.ts — Enayi Hotels & Suites
 * Location: frontend/src/hooks/usePayment.ts
 */

import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface USSDBankItem {
  code:      string
  name:      string
  ussd_code: string
}

export interface AlsoAccepted {
  bank:    string
  account: string
  name:    string
}

export interface PaymentInitResponse {
  success:               boolean
  gateway:               string
  transaction_reference: string
  payment_id:            string

  // Redirect gateways
  payment_link?:         string
  session_id?:           string          // Stripe
  access_code?:          string          // Paystack
  monnify_ref?:          string          // Monnify

  // USSD
  ussd_code?:            string
  bank_name?:            string
  instructions?:         string[]
  available_banks?:      USSDBankItem[]
  expires_at?:           string
  expires_in_minutes?:   number

  // Bank Transfer
  account_number?:       string
  account_name?:         string
  sort_code?:            string
  bank_code?:            string
  amount?:               string
  narration?:            string
  also_accepted?:        AlsoAccepted[]
  important?:            string

  // Cash / POS
  message?:              string
  front_desk?:           string
  phone?:                string

  // Error
  error?:                string
}

export interface Payment {
  id:                      string
  transaction_reference:   string
  purpose:                 string
  method:                  string
  gateway:                 string
  amount:                  string
  currency:                string
  status:                  'pending' | 'success' | 'failed' | 'refunded' | 'abandoned'
  narration:               string
  flw_ref:                 string
  paystack_ref:            string
  stripe_session_id:       string
  paypal_order_id:         string
  monnify_transaction_ref: string
  ussd_code:               string
  ussd_bank:               string
  virtual_acct_num:        string
  virtual_acct_bk:         string
  verified_at:             string | null
  created_at:              string
}

export interface InitiatePaymentInput {
  purpose:    string
  method:     string
  amount:     number
  currency?:  string
  narration?: string
  bank_code?: string
  metadata?:  Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Full payment history for the current user */
export const usePaymentHistory = () =>
  useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn:  () => api.get('/payments/history/').then(r => r.data),
  })

/** Initiate a payment — returns gateway-specific response */
export const useInitiatePayment = () =>
  useMutation<PaymentInitResponse, Error, InitiatePaymentInput>({
    mutationFn: (data) =>
      api.post('/payments/initiate/', data).then(r => r.data),
    onError: (err) => toast.error(getErrorMessage(err)),
  })

/** Poll a payment reference until it reaches a terminal state */
export const useVerifyPayment = (reference: string) =>
  useQuery<{ status: string; payment: Payment }>({
    queryKey: ['payment-verify', reference],
    queryFn:  () => api.get(`/payments/verify/${reference}/`).then(r => r.data),
    enabled:  !!reference,
    refetchInterval: (query) => {
      const s = query.state.data?.status ?? query.state.data?.payment?.status
      if (s === 'success' || s === 'failed' || s === 'abandoned') return false
      return 5000
    },
  })

/** Supported USSD banks list — cached indefinitely (static data) */
export const useUSSDBanks = () =>
  useQuery<USSDBankItem[]>({
    queryKey: ['ussd-banks'],
    queryFn:  () => api.get('/payments/ussd-banks/').then(r => r.data),
    staleTime: Infinity,
  })