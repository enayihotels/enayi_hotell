import { type ReactNode, forwardRef } from 'react'
import { Loader2, AlertCircle, CheckCircle2, Info, X, Inbox } from 'lucide-react'
import { cn } from '@/utils/helpers'

// ── Spinner ────────────────────────────────────────────
export const Spinner = ({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) => {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size]
  return <div className={cn('border-2 border-enayi-border border-t-enayi-gold rounded-full animate-spin', s, className)} />
}

export const PageSpinner = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <Spinner size="lg" className="mx-auto mb-3" />
      <p className="text-enayi-muted text-sm">Loading…</p>
    </div>
  </div>
)

// ── Button ─────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'outline' | 'ghost' | 'surface' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'gold', size = 'md', loading, className, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-300 disabled:opacity-40 disabled:pointer-events-none'
    const sizes = { sm: 'text-xs px-3 py-1.5', md: 'text-sm px-5 py-2.5', lg: 'text-base px-7 py-3.5' }
    const variants = {
      gold: 'bg-gradient-to-r from-enayi-gold via-enayi-gold2 to-enayi-gold3 text-enayi-bg hover:shadow-gold hover:scale-[1.02] active:scale-[0.98]',
      outline: 'border border-enayi-gold text-enayi-gold hover:bg-enayi-gold hover:text-enayi-bg',
      ghost: 'text-enayi-muted hover:text-enayi-text hover:bg-enayi-subtle',
      surface: 'bg-enayi-surface border border-enayi-border text-enayi-text hover:border-enayi-gold/30',
      danger: 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20',
    }
    return (
      <button ref={ref} className={cn(base, sizes[size], variants[variant], className)} disabled={disabled || loading} {...props}>
        {loading && <Loader2 size={14} className="animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

// ── Input ──────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="label">{label}</label>}
      <input ref={ref} className={cn('input', error && 'border-red-500/60 focus:border-red-500', className)} {...props} />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-enayi-muted">{hint}</p>}
    </div>
  )
)
Input.displayName = 'Input'

// ── Select ─────────────────────────────────────────────
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }>(
  ({ label, error, className, children, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="label">{label}</label>}
      <select ref={ref} className={cn('input', className)} {...props}>{children}</select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
)
Select.displayName = 'Select'

// ── Textarea ───────────────────────────────────────────
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="label">{label}</label>}
      <textarea ref={ref} className={cn('input min-h-[100px] resize-y', className)} {...props} />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'

// ── Badge ──────────────────────────────────────────────
export const Badge = ({ children, variant = 'gold', className = '' }: { children: ReactNode; variant?: 'gold' | 'green' | 'red' | 'blue' | 'gray'; className?: string }) => {
  const v = { gold: 'badge-gold', green: 'badge-green', red: 'badge-red', blue: 'badge-blue', gray: 'badge bg-enayi-subtle text-enayi-muted border border-enayi-border' }[variant]
  return <span className={cn(v, className)}>{children}</span>
}

// ── Status Badge ───────────────────────────────────────
export const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; variant: 'gold' | 'green' | 'red' | 'blue' | 'gray' }> = {
    pending:      { label: 'Pending',      variant: 'gold'  },
    confirmed:    { label: 'Confirmed',    variant: 'blue'  },
    checked_in:   { label: 'Checked In',  variant: 'green' },
    checked_out:  { label: 'Checked Out', variant: 'gray'  },
    cancelled:    { label: 'Cancelled',   variant: 'red'   },
    no_show:      { label: 'No Show',     variant: 'red'   },
    success:      { label: 'Paid',        variant: 'green' },
    failed:       { label: 'Failed',      variant: 'red'   },
    preparing:    { label: 'Preparing',   variant: 'gold'  },
    ready:        { label: 'Ready',       variant: 'blue'  },
    delivered:    { label: 'Delivered',   variant: 'green' },
    deposit_paid: { label: 'Deposit Paid',variant: 'blue'  },
    fully_paid:   { label: 'Fully Paid',  variant: 'green' },
    completed:    { label: 'Completed',   variant: 'green' },
    available:    { label: 'Available',   variant: 'green' },
    occupied:     { label: 'Occupied',    variant: 'red'   },
    maintenance:  { label: 'Maintenance', variant: 'gold'  },
  }
  const item = map[status] ?? { label: status, variant: 'gray' as const }
  return <Badge variant={item.variant}>{item.label}</Badge>
}

// ── Card ───────────────────────────────────────────────
export const Card = ({ children, className = '', gold = false, hover = false }: { children: ReactNode; className?: string; gold?: boolean; hover?: boolean }) => (
  <div className={cn(gold ? 'card-gold' : 'card', hover && 'card-hover', className)}>{children}</div>
)

// ── Modal ──────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, size = 'md' }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative z-10 card w-full', widths[size], 'max-h-[90vh] overflow-y-auto')}>
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-enayi-border">
            <h3 className="font-heading text-lg text-enayi-text">{title}</h3>
            <button onClick={onClose} className="text-enayi-muted hover:text-enayi-text transition-colors"><X size={18} /></button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ── Alert ──────────────────────────────────────────────
export const Alert = ({ type = 'info', children }: { type?: 'info' | 'success' | 'error' | 'warning'; children: ReactNode }) => {
  const config = {
    info:    { icon: Info,         cls: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
    success: { icon: CheckCircle2, cls: 'bg-green-500/10 border-green-500/30 text-green-400' },
    error:   { icon: AlertCircle,  cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
    warning: { icon: AlertCircle,  cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
  }[type]
  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-xl border text-sm', config.cls)}>
      <config.icon size={16} className="mt-0.5 flex-shrink-0" />
      <div>{children}</div>
    </div>
  )
}

// ── EmptyState ─────────────────────────────────────────
export const EmptyState = ({ icon: Icon = Inbox, title, desc, action }: { icon?: React.ElementType; title: string; desc?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-16 h-16 rounded-2xl bg-enayi-surface border border-enayi-border flex items-center justify-center mb-4">
      <Icon size={28} className="text-enayi-muted" />
    </div>
    <h3 className="font-heading text-lg text-enayi-text mb-2">{title}</h3>
    {desc && <p className="text-enayi-muted text-sm max-w-xs mb-5">{desc}</p>}
    {action}
  </div>
)

// ── Skeleton ───────────────────────────────────────────
export const SkeletonCard = () => (
  <div className="card p-5 space-y-3">
    <div className="skeleton h-5 w-2/3 rounded-lg" />
    <div className="skeleton h-4 w-full rounded-lg" />
    <div className="skeleton h-4 w-3/4 rounded-lg" />
    <div className="skeleton h-9 w-1/3 rounded-xl mt-4" />
  </div>
)

export const SkeletonList = ({ count = 4 }: { count?: number }) => (
  <div className="space-y-3">
    {[...Array(count)].map((_, i) => <SkeletonCard key={i} />)}
  </div>
)
