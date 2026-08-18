import { useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, Loader2, X } from 'lucide-react'

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
  const [isUpdating, setIsUpdating] = useState(false)
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const handleReload = () => {
    setIsUpdating(true)
    // updateServiceWorker(true) normally reloads the page automatically
    // once the new version takes over (see clientsClaim note in
    // vite.config.ts — that was the main cause of this hanging at all).
    // This timeout is a second, independent safety net: if the page
    // somehow still hasn't reloaded on its own within 8s — a slow
    // connection still fetching the new files, or any other edge case
    // — force it manually rather than leave the button spinning
    // forever with no way out for the guest.
    fallbackTimer.current = setTimeout(() => {
      window.location.reload()
    }, 8_000)
    updateServiceWorker(true).catch(() => {
      // The update call itself failed (e.g. the network dropped mid-
      // fetch of the new service worker). Don't make them wait out the
      // full 8s for the fallback — reload right away; worst case it
      // just re-serves the current version and the update banner will
      // reappear on the next successful check.
      window.location.reload()
    })
  }

  if (!needRefresh) return null

  return (
    <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100] bg-enayi-surface border border-enayi-gold/30 rounded-2xl shadow-2xl p-4 flex items-start gap-3 overflow-hidden">
      <div className="w-10 h-10 rounded-xl bg-enayi-gold/10 flex items-center justify-center flex-shrink-0">
        {isUpdating
          ? <Loader2 size={18} className="text-enayi-gold animate-spin" />
          : <RefreshCw size={18} className="text-enayi-gold" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-enayi-text text-sm font-medium">{isUpdating ? 'Updating…' : 'Update available'}</div>
        <p className="text-enayi-muted text-xs mt-0.5">
          {isUpdating
            ? "Getting the latest version — this only takes a moment, the app will reload on its own."
            : 'A newer version of the app is ready. Reload to get the latest features and fixes.'}
        </p>
        {isUpdating ? (
          // Indeterminate on purpose — there's no real byte-level
          // download progress available from the service worker here,
          // so a bar sliding back and forth is an honest "something is
          // happening" signal rather than a fake percentage.
          <div className="w-full h-1.5 rounded-full bg-enayi-panel overflow-hidden mt-3 relative">
            <div className="absolute inset-y-0 w-1/3 bg-enayi-gold rounded-full animate-update-progress" />
          </div>
        ) : (
          <button onClick={handleReload} className="btn-gold text-xs px-3 py-1.5 mt-2">Reload Now</button>
        )}
      </div>
      {!isUpdating && (
        <button onClick={() => setNeedRefresh(false)} className="text-enayi-muted hover:text-enayi-text flex-shrink-0" aria-label="Dismiss">
          <X size={16} />
        </button>
      )}
    </div>
  )
}
