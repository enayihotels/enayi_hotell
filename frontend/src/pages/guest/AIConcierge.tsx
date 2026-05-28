import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, Bot, User, Sparkles, Trash2 } from 'lucide-react'
import api, { getErrorMessage } from '@/utils/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { ChatMessage } from '@/types'

const SUGGESTIONS = ['What rooms are available?','What\'s on the menu tonight?','How do I book an event hall?','Tell me about Enayi Hotels','What payment methods do you accept?','What time is check-in?']

export default function AIConcierge() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string|null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { user } = useAuthStore()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text.trim(), created_at: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res = await api.post('/ai/chat/', { message: text.trim(), ...(sessionId && { session_id: sessionId }) })
      if (res.data.session_id) setSessionId(res.data.session_id)
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'assistant', content: res.data.reply, created_at: new Date().toISOString() }])
    } catch (err) {
      toast.error(getErrorMessage(err))
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'assistant', content: 'Sorry, I\'m temporarily unavailable. Please call us at +234-800-000-0000.', created_at: new Date().toISOString() }])
    } finally { setLoading(false) }
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="card-gold p-4 rounded-2xl mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-enayi-gold/10 border border-enayi-gold/30 flex items-center justify-center"><Bot size={24} className="text-enayi-gold"/></div>
          <div><div className="font-heading text-lg text-enayi-text">ARIA</div><div className="flex items-center gap-1.5 text-xs"><div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/><span className="text-green-400">Online 24/7</span></div></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="badge-gold text-xs"><Sparkles size={10}/> AI Powered</div>
          {messages.length > 0 && <button onClick={()=>{setMessages([]);setSessionId(null)}} className="p-2 text-enayi-muted hover:text-red-400 transition-colors"><Trash2 size={14}/></button>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot size={48} className="text-enayi-gold/30 mx-auto mb-4"/>
            <h2 className="font-heading text-xl text-enayi-text mb-2">Hello, {user?.first_name}! 👋</h2>
            <p className="text-enayi-muted text-sm mb-8 max-w-sm mx-auto">I'm ARIA, your personal concierge. Ask me anything about Enayi Hotels & Suites.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map(s=><button key={s} onClick={()=>sendMessage(s)} className="badge-gold text-xs cursor-pointer hover:bg-enayi-gold hover:text-enayi-bg transition-all px-3 py-2">{s}</button>)}
            </div>
          </div>
        )}
        <AnimatePresence>
          {messages.map(msg => (
            <motion.div key={msg.id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className={`flex gap-3 ${msg.role==='user'?'flex-row-reverse':''}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role==='user'?'bg-enayi-gold':'bg-enayi-gold/10 border border-enayi-gold/20'}`}>
                {msg.role==='user'?<User size={14} className="text-enayi-bg"/>:<Bot size={14} className="text-enayi-gold"/>}
              </div>
              <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role==='user'?'bg-enayi-gold text-enayi-bg rounded-tr-sm':'card rounded-tl-sm text-enayi-text'}`}>
                {msg.content.split('\n').map((line,i)=><p key={i}>{line}</p>)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-enayi-gold/10 border border-enayi-gold/20 flex items-center justify-center"><Bot size={14} className="text-enayi-gold"/></div>
            <div className="card px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2"><div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full bg-enayi-gold animate-bounce" style={{animationDelay:`${i*0.2}s`}}/>)}</div></div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div className="card p-3 mt-4 flex gap-3">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),sendMessage(input))} placeholder="Ask ARIA anything…" className="flex-1 bg-transparent text-enayi-text placeholder:text-enayi-muted outline-none text-sm"/>
        <button onClick={()=>sendMessage(input)} disabled={loading||!input.trim()} className="btn-gold px-4 py-2 text-sm gap-2 disabled:opacity-40">
          {loading?<Loader2 size={15} className="animate-spin"/>:<Send size={15}/>}
        </button>
      </div>
    </div>
  )
}
