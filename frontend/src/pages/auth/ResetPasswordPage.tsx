import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import api, { getErrorMessage } from '@/utils/api'
import toast from 'react-hot-toast'

const schema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'Enter the 6-digit code'),
  new_password: z.string().min(8, 'Minimum 8 characters'),
  new_password_confirm: z.string(),
}).refine(d => d.new_password === d.new_password_confirm, { message: 'Passwords do not match', path: ['new_password_confirm'] })
type Form = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [showPass, setShowPass] = useState(false)
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: Form) => {
    try {
      await api.post('/auth/reset-password/', data)
      toast.success('Password reset successful! Please sign in.')
      navigate('/login')
    } catch (err) { toast.error(getErrorMessage(err)) }
  }

  return (
    <div className="min-h-screen bg-enayi-bg flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl border border-enayi-gold/40 bg-enayi-gold/8 flex items-center justify-center"><span className="text-enayi-gold font-display font-bold">E</span></div>
          <span className="font-display font-semibold text-enayi-text">Enayi Hotels & Suites</span>
        </Link>
        <h1 className="font-display text-3xl text-enayi-text mb-2">Reset Password</h1>
        <p className="text-enayi-muted text-sm mb-8">Enter the code from your email and choose a new password.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="form-group"><label className="label">Email</label><div className="relative"><Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-enayi-muted"/><input {...register('email')} type="email" className="input pl-9" placeholder="your@email.com"/></div>{errors.email&&<p className="form-error">{errors.email.message}</p>}</div>
          <div className="form-group"><label className="label">6-Digit Code</label><input {...register('otp')} className="input text-center tracking-[0.5em] text-xl font-mono" placeholder="000000" maxLength={6}/>{errors.otp&&<p className="form-error">{errors.otp.message}</p>}</div>
          <div className="form-group"><label className="label">New Password</label><div className="relative"><Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-enayi-muted"/><input {...register('new_password')} type={showPass?'text':'password'} className="input pl-9 pr-9" placeholder="Min. 8 characters"/><button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-enayi-muted">{showPass?<EyeOff size={15}/>:<Eye size={15}/>}</button></div>{errors.new_password&&<p className="form-error">{errors.new_password.message}</p>}</div>
          <div className="form-group"><label className="label">Confirm Password</label><input {...register('new_password_confirm')} type={showPass?'text':'password'} className="input" placeholder="Repeat password"/>{errors.new_password_confirm&&<p className="form-error">{errors.new_password_confirm.message}</p>}</div>
          <button type="submit" disabled={isSubmitting} className="btn-gold w-full gap-2 mt-2">
            {isSubmitting?<><Loader2 size={15} className="animate-spin"/>Resetting…</>:<>Reset Password <ArrowRight size={15}/></>}
          </button>
          <Link to="/login" className="text-center text-sm text-enayi-muted hover:text-enayi-gold transition-colors">Back to Sign In</Link>
        </form>
      </motion.div>
    </div>
  )
}
