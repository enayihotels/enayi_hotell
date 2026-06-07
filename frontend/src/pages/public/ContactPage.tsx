import { useState } from 'react'
import { MapPin, Phone, Mail, Clock, Send, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ContactPage() {
  const [form, setForm] = useState({name:'',email:'',phone:'',subject:'',message:''})
  const [sending, setSending] = useState(false)
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if(!form.name||!form.email||!form.message){toast.error('Fill all required fields');return}
    setSending(true); await new Promise(r=>setTimeout(r,800)); toast.success("Message sent! We'll respond within 24 hours."); setForm({name:'',email:'',phone:'',subject:'',message:''}); setSending(false)
  }
  return (
    <div className="bg-enayi-bg min-h-screen">
      <div className="section-sm bg-enayi-surface border-b border-enayi-border text-center"><div className="container-site"><div className="badge-gold inline-flex mb-4">📞 Contact</div><h1 className="font-display text-5xl text-enayi-text mb-4">Get in Touch</h1><div className="gold-line-center mb-5"/><p className="text-enayi-muted text-lg">We're available 24/7 to assist you.</p></div></div>
      <div className="container-site section grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-6">
          {[{icon:MapPin,t:'Address',v:['Rayfield Zarmaganda Road, Off Railway Crossing','Jos, Plateau State, Nigeria']},{icon:Phone,t:'Phone',v:['+234(0)9138943008','+234(0)901 5636764']},{icon:Mail,t:'Email',v:['info@enayihotels.com']},{icon:Clock,t:'Hours',v:['Front Desk: 24 hours','Check-in 2pm · Check-out 12pm']}].map(({icon:Icon,t,v})=>(
            <div key={t} className="flex items-start gap-4"><div className="w-10 h-10 rounded-xl bg-enayi-gold/10 border border-enayi-gold/20 flex items-center justify-center flex-shrink-0"><Icon size={16} className="text-enayi-gold"/></div><div><div className="text-enayi-gold text-xs font-semibold uppercase tracking-wider mb-1">{t}</div>{v.map(l=><p key={l} className="text-enayi-text text-sm">{l}</p>)}</div></div>
          ))}
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4"><div className="form-group"><label className="label">Name *</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="input" placeholder="Your name"/></div><div className="form-group"><label className="label">Email *</label><input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} className="input" placeholder="you@email.com"/></div></div>
          <div className="form-group"><label className="label">Phone</label><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className="input" placeholder="+234..."/></div>
          <div className="form-group"><label className="label">Message *</label><textarea value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} className="input" rows={5} placeholder="How can we help?"/></div>
          <button type="submit" disabled={sending} className="btn-gold w-full gap-2">{sending?<><Loader2 size={15} className="animate-spin"/>Sending…</>:<><Send size={15}/>Send Message</>}</button>
        </form>
      </div>
    </div>
  )
}
