import { useEffect, useState } from 'react'
import { X, Download, Share } from 'lucide-react'

const DISMISS_KEY = 'enayi-install-prompt-dismissed'

// Chrome/Edge/Android fire this when the site meets install criteria.
// It's not on the default lib.dom.d.ts typings, so it's typed loosely here.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's own non-standard flag for "already added to home screen"
    (window.navigator as any).standalone === true
  )
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isMobileDevice() {
  return /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent)
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === 'true')

  useEffect(() => {
    if (isStandalone() || dismissed) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS has no beforeinstallprompt at all — Safari only supports
    // installing via the manual Share -> Add to Home Screen flow, so we
    // show instructions instead of a button there.
    if (isIOS()) setShowIOSHint(true)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [dismissed])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
    dismiss()
  }

  if (dismissed || isStandalone()) return null
  if (!deferredPrompt && !showIOSHint) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100] bg-enayi-surface border border-enayi-gold/30 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-enayi-gold/10 flex items-center justify-center flex-shrink-0">
        {deferredPrompt ? <Download size={18} className="text-enayi-gold" /> : <Share size={18} className="text-enayi-gold" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-enayi-text text-sm font-medium">Install Enayi Hotels</div>
        {deferredPrompt ? (
          <>
            <p className="text-enayi-muted text-xs mt-0.5">
              {isMobileDevice()
                ? 'Add it to your home screen for quick, one-tap access — no browser tabs to hunt through.'
                : 'Install it as a desktop app for one-click access — opens in its own window, no browser tabs to hunt through.'}
            </p>
            <button onClick={install} className="btn-gold text-xs px-3 py-1.5 mt-2">Install App</button>
          </>
        ) : (
          <p className="text-enayi-muted text-xs mt-0.5">
            Tap <Share size={11} className="inline -mt-0.5" /> Share, then "Add to Home Screen" for quick, one-tap access.
          </p>
        )}
      </div>
      <button onClick={dismiss} className="text-enayi-muted hover:text-enayi-text flex-shrink-0" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  )
}
