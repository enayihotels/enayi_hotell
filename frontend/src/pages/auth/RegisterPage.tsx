import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api, { getErrorMessage } from '@/utils/api'
import toast from 'react-hot-toast'

const schema = z.object({
  first_name:       z.string().min(2, 'Minimum 2 characters'),
  last_name:        z.string().min(2, 'Minimum 2 characters'),
  email:            z.string().email('Enter a valid email'),
  phone:            z.string().optional(),
  password:         z.string().min(8, 'Minimum 8 characters'),
  password_confirm: z.string(),
}).refine(d => d.password === d.password_confirm, {
  message: 'Passwords do not match', path: ['password_confirm'],
})
type Form = z.infer<typeof schema>

const PERKS = [
  'Exclusive member-only room rates',
  'Priority booking confirmation',
  'Loyalty points on every stay',
  'AI Concierge ARIA access 24/7',
  'Early check-in privileges',
  'Birthday & anniversary surprises',
]

export default function RegisterPage() {
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuthStore()
  const navigate  = useNavigate()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    try {
      const res = await api.post('/auth/register/', data)
      login(res.data.user, res.data.access, res.data.refresh)
      toast.success('Account created! Welcome to Enayi Hotels 🎉')
      navigate('/verify-email')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="min-h-screen flex bg-enayi-bg">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-5/12 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-enayi-panel via-enayi-surface to-enayi-bg" />
        <div className="absolute inset-0 bg-grid opacity-25" />
        <div className="glow-orb w-80 h-80 top-0 right-0 opacity-40" />

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border border-enayi-gold/40 bg-enayi-gold/8 flex items-center justify-center">
              <span className="text-enayi-gold font-display font-bold text-lg">E</span>
            </div>
            <div className="font-display font-semibold text-enayi-text text-lg">Enayi Hotels & Suites</div>
          </Link>
        </div>

        <div className="relative z-10">
          <div className="gold-line mb-6" />
          <h2 className="font-display text-4xl text-enayi-text mb-4">
            Join Our<br /><span className="text-gold">Exclusive Circle</span>
          </h2>
          <p className="text-enayi-muted text-base leading-relaxed mb-8">
            Become a member and unlock a world of privileges, personalised service,
            and unforgettable experiences at Enayi Hotels & Suites.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {PERKS.map(p => (
              <div key={p} className="flex items-center gap-3">
                <CheckCircle2 size={15} className="text-enayi-gold flex-shrink-0" />
                <span className="text-enayi-text text-sm">{p}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 card-gold p-5 rounded-2xl">
          <div className="flex items-center gap-1 mb-2">
            {[...Array(5)].map((_,i) => <span key={i} className="text-enayi-gold text-xs">★</span>)}
            <span className="text-enayi-muted text-xs ml-2">4.9 from 2,400+ guests</span>
          </div>
          <p className="text-enayi-muted text-xs italic">
            "Best hotel experience in all of Plateau State. Couldn't have asked for more!"
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md py-8"
        >
          <Link to="/" className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl border border-enayi-gold/40 bg-enayi-gold/8 flex items-center justify-center">
              <span className="text-enayi-gold font-display font-bold">E</span>
            </div>
            <span className="font-display font-semibold text-enayi-text">Enayi Hotels & Suites</span>
          </Link>

          <div className="mb-8">
            <h1 className="font-display text-3xl text-enayi-text mb-2">Create Account</h1>
            <p className="text-enayi-muted text-sm">Join thousands of happy guests at Enayi Hotels</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">First Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-enayi-muted" />
                  <input {...register('first_name')} placeholder="Ada" className="input pl-8 text-sm" />
                </div>
                {errors.first_name && <p className="form-error">{errors.first_name.message}</p>}
              </div>
              <div className="form-group">
                <label className="label">Last Name</label>
                <input {...register('last_name')} placeholder="Okafor" className="input text-sm" />
                {errors.last_name && <p className="form-error">{errors.last_name.message}</p>}
              </div>
            </div>

            <div className="form-group">
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-enayi-muted" />
                <input {...register('email')} type="email" placeholder="ada@example.com" className="input pl-8 text-sm" />
              </div>
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>

            <div className="form-group">
              <label className="label">Phone <span className="text-enayi-muted">(optional)</span></label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-enayi-muted" />
                <input {...register('phone')} type="tel" placeholder="+234 800 000 0000" className="input pl-8 text-sm" />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-enayi-muted" />
                <input {...register('password')} type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters"
                  className="input pl-8 pr-9 text-sm" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-enayi-muted hover:text-enayi-text transition-colors">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.password && <p className="form-error">{errors.password.message}</p>}
            </div>

            <div className="form-group">
              <label className="label">Confirm Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-enayi-muted" />
                <input {...register('password_confirm')} type={showPass ? 'text' : 'password'}
                  placeholder="Repeat your password" className="input pl-8 text-sm" />
              </div>
              {errors.password_confirm && <p className="form-error">{errors.password_confirm.message}</p>}
            </div>

            <p className="text-xs text-enayi-muted">
              By creating an account you agree to our{' '}
              <Link to="/terms" className="text-enayi-gold hover:underline">Terms</Link>{' '}and{' '}
              <Link to="/privacy" className="text-enayi-gold hover:underline">Privacy Policy</Link>.
            </p>

            <button type="submit" disabled={isSubmitting} className="btn-gold w-full">
              {isSubmitting
                ? <><Loader2 size={16} className="animate-spin" /> Creating account…</>
                : <>Create Account <ArrowRight size={16} /></>
              }
            </button>

            <p className="text-center text-sm text-enayi-muted">
              Already have an account?{' '}
              <Link to="/login" className="text-enayi-gold font-medium hover:text-enayi-gold2 transition-colors">Sign in</Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  )
}
