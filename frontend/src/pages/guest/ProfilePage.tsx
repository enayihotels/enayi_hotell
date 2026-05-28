import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { User, Mail, Phone, Star, Shield, Loader2, Camera } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api, { getErrorMessage } from '@/utils/api'
import { Alert } from '@/components/ui'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const { register, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm({
    defaultValues: { first_name: '', last_name: '', phone: '', nationality: 'nigerian', newsletter: true }
  })
  useEffect(() => {
  if (user) reset({
    first_name: user.first_name ?? '',
    last_name:  user.last_name  ?? '',
    phone:       user.phone       ?? '',
    nationality: user.nationality ?? 'nigerian',
    newsletter:  user.newsletter  ?? true,   // ← was missing fallback; boolean | undefined → boolean
  })
}, [user])

  const onSave = async (data: any) => {
    try { const res = await api.patch('/auth/profile/', data); updateUser(res.data); toast.success('Profile updated!') }
    catch (err) { toast.error(getErrorMessage(err)) }
  }

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const form = new FormData(); form.append('avatar', file)
    try { const res = await api.post('/auth/avatar/', form, { headers: { 'Content-Type': 'multipart/form-data' } }); updateUser({ avatar: res.data.avatar_url }); toast.success('Avatar updated!') }
    catch (err) { toast.error(getErrorMessage(err)) }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div><h1 className="font-display text-3xl text-enayi-text">My Profile</h1><p className="text-enayi-muted text-sm mt-1">Manage your account and preferences</p></div>
      {!user?.is_verified && <Alert type="warning">Your email is not verified. <a href="/verify-email" className="text-enayi-gold underline">Verify now</a></Alert>}
      {/* Avatar */}
      <div className="card p-5 flex items-center gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-enayi-gold/10 border-2 border-enayi-gold/30 flex items-center justify-center overflow-hidden">
            {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover"/> : <span className="font-display text-3xl text-enayi-gold">{user?.first_name?.[0]}</span>}
          </div>
          <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-enayi-gold flex items-center justify-center cursor-pointer hover:bg-enayi-gold2 transition-colors">
            <Camera size={13} className="text-enayi-bg"/><input type="file" accept="image/*" className="hidden" onChange={handleAvatar}/>
          </label>
        </div>
        <div>
          <div className="font-heading text-xl text-enayi-text">{user?.full_name}</div>
          <div className="text-enayi-muted text-sm flex items-center gap-1.5 mt-1"><Mail size={12}/>{user?.email}</div>
          <div className="flex items-center gap-3 mt-2">
            <span className="badge-gold text-xs capitalize">{user?.role}</span>
            <span className="flex items-center gap-1 text-enayi-gold text-xs"><Star size={11} fill="currentColor"/>{user?.loyalty_points ?? 0} pts</span>
            {user?.is_verified && <span className="badge-green text-xs"><Shield size={9}/> Verified</span>}
          </div>
        </div>
      </div>
      {/* Form */}
      <form onSubmit={handleSubmit(onSave)} className="card p-5 space-y-4">
        <h2 className="font-heading text-lg text-enayi-text">Personal Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group"><label className="label">First Name</label><input {...register('first_name',{required:true})} className="input"/></div>
          <div className="form-group"><label className="label">Last Name</label><input {...register('last_name',{required:true})} className="input"/></div>
        </div>
        <div className="form-group"><label className="label">Phone</label><input {...register('phone')} type="tel" className="input" placeholder="+234..."/></div>
        <div className="form-group"><label className="label">Nationality</label>
          <select {...register('nationality')} className="input">
            {['nigerian','ghanaian','kenyan','other'].map(n=><option key={n} value={n} className="capitalize">{n.charAt(0).toUpperCase()+n.slice(1)}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input {...register('newsletter')} type="checkbox" className="w-4 h-4 accent-enayi-gold"/>
          <span className="text-enayi-text text-sm">Receive special offers and hotel news</span>
        </label>
        <button type="submit" disabled={isSubmitting||!isDirty} className="btn-gold gap-2">
          {isSubmitting?<><Loader2 size={14} className="animate-spin"/>Saving…</>:'Save Changes'}
        </button>
      </form>
    </div>
  )
}
