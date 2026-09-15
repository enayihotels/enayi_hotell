import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, ArrowRight, Loader2, CheckCircle2, Star, ShieldQuestion, ShieldOff, Send } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api, { getErrorMessage } from '@/utils/api'
import { getPostLoginRoute } from '@/utils/authRouting'
import { GoogleSignInButton } from '@/components/GoogleSignInButton'
import { Modal, Button } from '@/components/ui'
import toast from 'react-hot-toast'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type Form = z.infer<typeof schema>

const FEATURES = [
  'Book rooms online 24/7',
  'Order food & drinks to your room',
  'Book our event halls for any occasion',
  'Access AI concierge ENAYI anytime',
  'Earn loyalty points on every stay',
]

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuthStore()
  const navigate  = useNavigate()

  // Front Desk/Bar/Kitchen/Housekeeper credentials check out, but the
  // backend wants a quick "are you actually on duty?" confirmation
  // before it'll issue tokens — holds the already-verified credentials
  // so we can resubmit with confirm_on_duty once they answer.
  const [shiftPrompt, setShiftPrompt] = useState<Form | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Off-duty block — a dedicated screen instead of a generic error toast,
  // since the only thing to do from here is ask a Manager to switch them
  // back on, not "try the password again".
  const [offDutyEmail, setOffDutyEmail] = useState<string | null>(null)
  const [requestingAccess, setRequestingAccess] = useState(false)
  const [accessRequested, setAccessRequested] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const completeLogin = (res: any) => {
    const user = res.data.user
    login(user, res.data.access, res.data.refresh)
    toast.success(res.data.message || `Welcome back, ${user.first_name}! 🏨`)
    // Route to the right landing page based on role — staff roles
    // that live in the inventory shell should never land in the guest
    // portal, and front desk/manager who have both the admin panel and
    // their own entry points need to go to the right one too.
    navigate(getPostLoginRoute(user.role), { replace: true })
  }

  const onSubmit = async (data: Form) => {
    try {
      const res = await api.post('/auth/login/', data)
      if (res.data?.requires_shift_confirmation) {
        setShiftPrompt(data)
        return
      }
      completeLogin(res)
    } catch (err: any) {
      if (err?.response?.data?.code === 'off_duty') {
        setOffDutyEmail(data.email)
        setAccessRequested(false)
        return
      }
      toast.error(getErrorMessage(err))
    }
  }

  const requestAccess = async () => {
    if (!offDutyEmail) return
    setRequestingAccess(true)
    try {
      await api.post('/auth/request-access/', { email: offDutyEmail })
      setAccessRequested(true)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setRequestingAccess(false)
    }
  }

  const confirmOnDuty = async () => {
    if (!shiftPrompt) return
    setConfirming(true)
    try {
      const res = await api.post('/auth/login/', { ...shiftPrompt, confirm_on_duty: true })
      completeLogin(res)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setConfirming(false)
      setShiftPrompt(null)
    }
  }

  return (
    <div className="min-h-screen flex bg-enayi-bg">
      {/* ── Left Panel ── */}
      <div className="hidden lg:flex lg:w-5/12 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-enayi-panel via-enayi-surface to-enayi-bg" />
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="glow-orb w-96 h-96 -top-32 -left-20 opacity-40" />
        <div className="glow-orb w-64 h-64 bottom-20 right-8 opacity-30" />

        {/* Logo */}
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Enayi Hotels & Suites" className="h-12 w-auto object-contain" />
            <div>
              <div className="font-display font-semibold text-enayi-text text-lg">Enayi Hotels & Suites</div>
              <div className="text-enayi-muted text-xs">Rayfield Road, Jos — Plateau State</div>
            </div>
          </Link>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <div className="gold-line mb-6" />
          <h2 className="font-display text-4xl text-enayi-text leading-tight mb-4">
            Your Extraordinary<br /><span className="text-gold">Stay Awaits</span>
          </h2>
          <p className="text-enayi-muted text-base leading-relaxed mb-8">
            Sign in to access your bookings, order room service, book event halls,
            and enjoy the full luxury experience of Enayi Hotels & Suites.
          </p>
          <div className="flex flex-col gap-3">
            {FEATURES.map(f => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle2 size={15} className="text-enayi-gold flex-shrink-0" />
                <span className="text-enayi-text text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 card-gold p-5 rounded-2xl">
          <div className="flex items-center gap-1 mb-3">
            {[...Array(5)].map((_, i) => <Star key={i} size={12} className="text-enayi-gold" fill="currentColor" />)}
            <span className="text-enayi-muted text-xs ml-2">5.0 / 5.0</span>
          </div>
          <p className="text-enayi-text text-sm italic leading-relaxed mb-3">
            "Enayi Hotels is absolutely world-class. The service, the food, the rooms — everything exceeded every expectation.
            Jos has a true gem right here on Rayfield Road!"
          </p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-enayi-gold/20 flex items-center justify-center">
              <span className="text-enayi-gold text-sm font-bold">C</span>
            </div>
            <div>
              <div className="text-enayi-text text-sm font-semibold">Chidinma Okafor</div>
              <div className="text-enayi-muted text-xs">Lagos, Nigeria</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel (Form) ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-2.5 mb-10 lg:hidden">
            <img src="/logo.png" alt="Enayi Hotels" className="h-9 w-auto object-contain" />
            <span className="font-display font-semibold text-enayi-text">Enayi Hotels & Suites</span>
          </Link>

          <div className="mb-8">
            <h1 className="font-display text-3xl text-enayi-text mb-2">
              {offDutyEmail ? 'Off Duty' : 'Welcome Back'}
            </h1>
            <p className="text-enayi-muted text-sm">
              {offDutyEmail ? 'Your account is switched off duty right now.' : 'Sign in to manage your bookings, orders and more'}
            </p>
          </div>

          {offDutyEmail ? (
            <div className="flex flex-col gap-5">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-enayi-surface border border-enayi-border">
                <ShieldOff size={22} className="text-enayi-gold flex-shrink-0 mt-0.5" />
                <p className="text-enayi-text text-sm leading-relaxed">
                  A Manager switched this account off duty — you can't sign in until they switch you back on.
                  If you're covering a shift or this was a mistake, request access below and your Manager will be notified.
                </p>
              </div>

              {accessRequested ? (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                  <CheckCircle2 size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-enayi-text text-sm leading-relaxed">
                    Request sent. Your Manager has been emailed — try signing in again once they've approved it.
                  </p>
                </div>
              ) : (
                <Button variant="gold" className="w-full" loading={requestingAccess} onClick={requestAccess}>
                  <Send size={15} /> Request Access
                </Button>
              )}

              <button
                type="button"
                onClick={() => { setOffDutyEmail(null); setAccessRequested(false) }}
                className="text-enayi-muted text-sm hover:text-enayi-text transition-colors text-center"
              >
                Back to sign in
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {/* Email */}
            <div className="form-group">
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-enayi-muted" />
                <input {...register('email')} type="email" placeholder="you@example.com"
                  className="input pl-10" autoComplete="email" />
              </div>
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="form-group">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Password</label>
                <Link to="/forgot-password" className="text-xs text-enayi-gold hover:text-enayi-gold2 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-enayi-muted" />
                <input {...register('password')} type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password" className="input pl-10 pr-10" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-enayi-muted hover:text-enayi-text transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="form-error">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-gold w-full mt-2">
              {isSubmitting
                ? <><Loader2 size={16} className="animate-spin" /> Signing in…</>
                : <>Sign In <ArrowRight size={16} /></>
              }
            </button>

            <div className="relative flex items-center gap-4">
              <div className="flex-1 h-px bg-enayi-border" />
              <span className="text-enayi-muted text-xs">or</span>
              <div className="flex-1 h-px bg-enayi-border" />
            </div>

            <GoogleSignInButton />

            <p className="text-center text-sm text-enayi-muted">
              Don't have an account?{' '}
              <Link to="/register" className="text-enayi-gold font-medium hover:text-enayi-gold2 transition-colors">
                Create one free
              </Link>
            </p>
          </form>
          )}

          <div className="flex items-center gap-2 mt-8 p-3.5 rounded-xl bg-enayi-surface border border-enayi-border">
            <span className="text-enayi-gold">🔒</span>
            <p className="text-enayi-muted text-xs leading-relaxed">
              Your data is protected with end-to-end encryption. We never share your information.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Self-attestation for shift-based roles — a reminder, not a hard
          control (the real enforcement is the Manager's on/off toggle). */}
      <Modal open={!!shiftPrompt} onClose={() => setShiftPrompt(null)} title="Quick check" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <ShieldQuestion size={22} className="text-enayi-gold flex-shrink-0 mt-0.5" />
            <p className="text-enayi-text text-sm leading-relaxed">
              Are you on duty right now? Only sign in if you're actually working this shift.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShiftPrompt(null)}>Not right now</Button>
            <Button variant="gold" loading={confirming} onClick={confirmOnDuty}>Yes, I'm on duty</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
