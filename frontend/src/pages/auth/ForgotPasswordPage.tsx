import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Mail, ArrowRight, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import api, { getErrorMessage } from '@/utils/api'
import toast from 'react-hot-toast'

const schema = z.object({ email: z.string().email('Enter a valid email') })
type Form = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: Form) => {
    try { await api.post('/auth/forgot-password/', data); setSent(true) }
    catch (err) { toast.error(getErrorMessage(err)) }
  }

  return (
    <div className="min-h-screen bg-enayi-bg flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl border border-enayi-gold/40 bg-enayi-gold/8 flex items-center justify-center"><span className="text-enayi-gold font-display font-bold">E</span></div>
          <span className="font-display font-semibold text-enayi-text">Enayi Hotels & Suites</span>
        </Link>
        {sent ? (
          <div className="card p-8 text-center">
            <CheckCircle2 size={48} className="text-green-400 mx-auto mb-4" />
            <h2 className="font-display text-2xl text-enayi-text mb-3">Check Your Email</h2>
            <p className="text-enayi-muted text-sm mb-6">We've sent a 6-digit reset code to your email. Check your inbox and spam folder.</p>
            <Link to="/reset-password" className="btn-gold w-full gap-2 inline-flex justify-center">Enter Reset Code <ArrowRight size={15}/></Link>
          </div>
        ) : (
          <div>
            <h1 className="font-display text-3xl text-enayi-text mb-2">Forgot Password?</h1>
            <p className="text-enayi-muted text-sm mb-8">Enter your email and we'll send you a reset code.</p>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
              <div className="form-group">
                <label className="label">Email Address</label>
                <div className="relative"><Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-enayi-muted"/><input {...register('email')} type="email" placeholder="you@example.com" className="input pl-10"/></div>
                {errors.email && <p className="form-error">{errors.email.message}</p>}
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-gold w-full gap-2">
                {isSubmitting ? <><Loader2 size={15} className="animate-spin"/>Sending…</> : <>Send Reset Code <ArrowRight size={15}/></>}
              </button>
              <Link to="/login" className="flex items-center justify-center gap-2 text-enayi-muted hover:text-enayi-gold text-sm transition-colors"><ArrowLeft size={14}/> Back to Sign In</Link>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  )
}
