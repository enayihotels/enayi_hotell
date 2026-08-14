import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

// This is the permanent fix for the exact problem that keeps coming up:
// the installed app (or a browser tab left open) can silently keep
// running the JS from before a deploy, since a service worker's whole
// job is to serve cached files instantly instead of re-fetching them
// every time. Closing and reopening the app isn't a reliable way to
// force a refresh — this banner is. It detects the moment a new
// version has finished downloading in the background and shows a
// one-click "Update" button, rather than updating silently and
// unpredictably (which is what caused the confusion before).
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version every 60s while the app is open — the
      // default only checks on a fresh page load, which an installed
      // app or a long-lived open tab might not get for days.
      if (registration) {
        setInterval(() => { registration.update() }, 60_000)
      }
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100] bg-enayi-surface border border-enayi-gold/30 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-enayi-gold/10 flex items-center justify-center flex-shrink-0">
        <RefreshCw size={18} className="text-enayi-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-enayi-text text-sm font-medium">Update available</div>
        <p className="text-enayi-muted text-xs mt-0.5">A newer version of the app is ready. Reload to get the latest features and fixes.</p>
        <button onClick={() => updateServiceWorker(true)} className="btn-gold text-xs px-3 py-1.5 mt-2">Reload Now</button>
      </div>
      <button onClick={() => setNeedRefresh(false)} className="text-enayi-muted hover:text-enayi-text flex-shrink-0" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  )
}
