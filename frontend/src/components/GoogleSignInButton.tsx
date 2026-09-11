import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { useAuthStore } from '@/store/authStore'
import { getPostLoginRoute } from '@/utils/authRouting'

declare global {
  interface Window {
    google?: any
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

// The Google script is shared across the whole app (Login + Register both
// render this button) — load it once and reuse the same promise for every
// mount instead of injecting duplicate <script> tags.
let scriptLoadingPromise: Promise<void> | null = null
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptLoadingPromise) return scriptLoadingPromise
  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'))
    document.head.appendChild(script)
  })
  return scriptLoadingPromise
}

/**
 * Renders Google's own "Sign in with Google" button and handles the full
 * flow: gets an ID token from Google, sends it to our backend
 * (POST /auth/google/) to verify + find-or-create the account, then logs
 * the person in exactly like a normal email/password login.
 *
 * Used on both Login and Register — Google doesn't distinguish between
 * the two (a first-time Google sign-in just creates the account), so one
 * component covers both.
 *
 * Renders nothing if VITE_GOOGLE_CLIENT_ID isn't set, so the rest of the
 * page still works fine without it configured.
 */
export function GoogleSignInButton() {
  const buttonRef = useRef<HTMLDivElement>(null)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google) return

        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async (response: { credential: string }) => {
            try {
              const res = await api.post('/auth/google/', { credential: response.credential })
              const user = res.data.user
              login(user, res.data.access, res.data.refresh)
              toast.success(res.data.message || `Welcome, ${user.first_name}! 🏨`)
              navigate(getPostLoginRoute(user.role), { replace: true })
            } catch (err) {
              toast.error(getErrorMessage(err))
            }
          },
        })

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
          shape: 'pill',
        })
      })
      .catch(() => {
        // Silently no-op — the rest of the form still works fine without
        // Google Sign-In if the script fails to load (offline, blocked
        // by an ad blocker, etc).
      })

    return () => { cancelled = true }
  }, [])

  if (!CLIENT_ID) return null

  return <div className="flex justify-center" ref={buttonRef} />
}
