import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Lock } from 'lucide-react'
import api, { getErrorMessage } from '@/utils/api'
import { Modal, Button } from '@/components/ui'

const schema = z.object({
  current_password: z.string().min(1, 'Enter your current password'),
  new_password: z.string().min(8, 'Minimum 8 characters'),
  new_password_confirm: z.string(),
}).refine(d => d.new_password === d.new_password_confirm, {
  message: 'Passwords do not match', path: ['new_password_confirm'],
})
type Form = z.infer<typeof schema>

/**
 * Change-your-own-password, for whoever is currently logged in —
 * any role. The backend endpoint (POST /auth/change-password/) has
 * existed since early on; this is just the first UI anywhere in the
 * app that actually calls it. Doesn't log the person out or require
 * re-login — the current session keeps working after a successful
 * change.
 */
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })

  const close = () => { reset(); onClose() }

  const onSubmit = async (data: Form) => {
    try {
      const res = await api.post('/auth/change-password/', data)
      toast.success(res.data?.message || 'Password changed.')
      close()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <Modal open={open} onClose={close} title="Change Password" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="form-group">
          <label className="label">Current Password</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-enayi-muted" />
            <input {...register('current_password')} type={showCurrent ? 'text' : 'password'} autoComplete="current-password"
              className="input pl-9 pr-9" placeholder="Your current password" />
            <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-enayi-muted hover:text-enayi-text">
              {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.current_password && <p className="form-error">{errors.current_password.message}</p>}
        </div>

        <div className="form-group">
          <label className="label">New Password</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-enayi-muted" />
            <input {...register('new_password')} type={showNew ? 'text' : 'password'} autoComplete="new-password"
              className="input pl-9 pr-9" placeholder="Min. 8 characters" />
            <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-enayi-muted hover:text-enayi-text">
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.new_password && <p className="form-error">{errors.new_password.message}</p>}
        </div>

        <div className="form-group">
          <label className="label">Confirm New Password</label>
          <input {...register('new_password_confirm')} type={showNew ? 'text' : 'password'} autoComplete="new-password"
            className="input" placeholder="Re-type the new password" />
          {errors.new_password_confirm && <p className="form-error">{errors.new_password_confirm.message}</p>}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          <Button type="submit" variant="gold" loading={isSubmitting}>Change Password</Button>
        </div>
      </form>
    </Modal>
  )
}
