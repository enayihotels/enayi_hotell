import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'
import api, { getErrorMessage } from '@/utils/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export default function VerifyEmailPage() {
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) { toast.error('Enter the 6-digit code'); return }
    setLoading(true)
    try {
      await api.post('/auth/verify-email/', { otp })
      updateUser({ is_verified: true })
      toast.success('Email verified successfully! ✅')
      navigate('/dashboard')
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  const handleResend = async () => {
    setResending(true)
    try { await api.post('/auth/resend-otp/'); toast.success('New code sent to your email!') }
    catch (err) { toast.error(getErrorMessage(err)) }
    finally { setResending(false) }
  }

  return (
    <div className="min-h-screen bg-enayi-bg flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-enayi-gold/10 border border-enayi-gold/20 flex items-center justify-center mx-auto mb-6"><Mail size={28} className="text-enayi-gold"/></div>
          <h1 className="font-display text-3xl text-enayi-text mb-2">Verify Your Email</h1>
          <p className="text-enayi-muted text-sm mb-2">We sent a 6-digit code to:</p>
          <p className="text-enayi-gold font-semibold mb-8">{user?.email}</p>
          <form onSubmit={handleVerify} className="flex flex-col gap-5">
            <input value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/,'').slice(0,6))} className="input text-center tracking-[0.6em] text-2xl font-mono" placeholder="000000" maxLength={6} autoFocus/>
            <button type="submit" disabled={loading||otp.length!==6} className="btn-gold w-full gap-2">
              {loading?<><Loader2 size={15} className="animate-spin"/>Verifying…</>:<><CheckCircle2 size={15}/>Verify Email</>}
            </button>
          </form>
          <button onClick={handleResend} disabled={resending} className="flex items-center justify-center gap-2 text-enayi-muted hover:text-enayi-gold text-sm transition-colors mx-auto mt-5">
            <RefreshCw size={13} className={resending?'animate-spin':''}/> {resending?'Sending…':'Resend code'}
          </button>
          <button onClick={()=>navigate('/dashboard')} className="block mt-4 text-xs text-enayi-muted hover:text-enayi-gold transition-colors mx-auto">Skip for now</button>
        </div>
      </motion.div>
    </div>
  )
}
