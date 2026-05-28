import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, ArrowRight, Loader2, CheckCircle2, Star } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api, { getErrorMessage } from '@/utils/api'
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
  'Access AI concierge ARIA anytime',
  'Earn loyalty points on every stay',
]

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuthStore()
  const navigate  = useNavigate()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    try {
      const res = await api.post('/auth/login/', data)
      login(res.data.user, res.data.access, res.data.refresh)
      toast.success(res.data.message || `Welcome back, ${res.data.user.first_name}! 🏨`)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err))
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
            <div className="w-10 h-10 rounded-xl border border-enayi-gold/40 bg-enayi-gold/8 flex items-center justify-center">
              <span className="text-enayi-gold font-display font-bold text-lg">E</span>
            </div>
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
            <div className="w-9 h-9 rounded-xl border border-enayi-gold/40 bg-enayi-gold/8 flex items-center justify-center">
              <span className="text-enayi-gold font-display font-bold">E</span>
            </div>
            <span className="font-display font-semibold text-enayi-text">Enayi Hotels & Suites</span>
          </Link>

          <div className="mb-8">
            <h1 className="font-display text-3xl text-enayi-text mb-2">Welcome Back</h1>
            <p className="text-enayi-muted text-sm">Sign in to manage your bookings, orders and more</p>
          </div>

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

            <p className="text-center text-sm text-enayi-muted">
              Don't have an account?{' '}
              <Link to="/register" className="text-enayi-gold font-medium hover:text-enayi-gold2 transition-colors">
                Create one free
              </Link>
            </p>
          </form>

          <div className="flex items-center gap-2 mt-8 p-3.5 rounded-xl bg-enayi-surface border border-enayi-border">
            <span className="text-enayi-gold">🔒</span>
            <p className="text-enayi-muted text-xs leading-relaxed">
              Your data is protected with end-to-end encryption. We never share your information.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
