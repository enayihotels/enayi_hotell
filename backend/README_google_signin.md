# Google Sign-In for guests

## What it does

Adds a "Continue with Google" button to both the Login and Register
pages. Clicking it opens Google's own sign-in popup, and on success:
- If no account exists with that Google email, one is created
  automatically (as a Guest, already marked verified — Google itself
  guarantees the email is real, so there's no need to also send our own
  OTP verification email).
- If an account already exists with that email (including one made the
  normal way with a password), Google sign-in just logs into it — same
  email, same account, just a different way of proving it's them.
- Either way, they land on the right page for their role, exactly like
  a normal login.

## Backend

- **`settings.py`** — new `GOOGLE_OAUTH_CLIENT_ID` setting, reads from
  the `GOOGLE_OAUTH_CLIENT_ID` env var with your real Client ID as the
  fallback default (safe to have as a default — the Client ID isn't
  secret, it's sent to every browser as part of normal Google Sign-In;
  only the Client *Secret* would need to stay hidden, and this flow
  doesn't even need the secret).
- **`requirements.txt`** — added `google-auth==2.29.0` (needed to verify
  the token Google hands back).
- **`apps/accounts/views.py`** — new `GoogleAuthView`
  (`POST /api/v1/auth/google/`), verifies the Google ID token, finds or
  creates the user by email, returns the same response shape as normal
  login (so the frontend treats it identically).
- **`apps/accounts/urls.py`** — registers the new endpoint.

## Frontend

- **`GoogleSignInButton.tsx`** (new) — renders Google's actual button,
  handles the whole flow (get token → send to backend → log in →
  redirect). Used on both Login and Register. Renders nothing if the
  Client ID env var isn't set, so nothing breaks if it's ever missing.
- **`authRouting.ts`** (new) — pulled the "which page does this role
  land on after signing in" logic out of `LoginPage.tsx` into one shared
  place, since both the normal login and the new Google button need it.
- **`LoginPage.tsx`**, **`RegisterPage.tsx`** — added the button below
  the existing form, and switched to the shared routing helper.

## Install

1. Copy `settings.py` → `config/settings.py`
2. Copy `requirements.txt` → `requirements.txt`
3. Copy `accounts_views.py` → `apps/accounts/views.py`
4. Copy `accounts_urls.py` → `apps/accounts/urls.py`
5. Copy `GoogleSignInButton.tsx` → `frontend/src/components/GoogleSignInButton.tsx`
6. Copy `authRouting.ts` → `frontend/src/utils/authRouting.ts`
7. Copy `LoginPage.tsx` → `frontend/src/pages/auth/LoginPage.tsx`
8. Copy `RegisterPage.tsx` → `frontend/src/pages/auth/RegisterPage.tsx`

## ⚠️ One more thing needed before this works live

The frontend needs your Client ID as a **build-time environment
variable** — Vite bakes it into the build, it can't be added after the
fact like a backend env var can.

**Locally** — add this line to `frontend/.env`:
```
VITE_GOOGLE_CLIENT_ID=264010123117-5933786t6kt7d8tngn8rehn3156dutmu.apps.googleusercontent.com
```

**On Render** — go to your **frontend static site** (not the backend)
in the Render dashboard → Environment → add:
```
VITE_GOOGLE_CLIENT_ID = 264010123117-5933786t6kt7d8tngn8rehn3156dutmu.apps.googleusercontent.com
```
Then trigger a **manual redeploy** of the frontend — a normal git push
alone won't pick up a newly-added env var on a static site the same way
it does for the backend; Render needs to rebuild it.

(You don't strictly need to set `GOOGLE_OAUTH_CLIENT_ID` on the backend
service, since it already falls back to your real Client ID by default
— but feel free to add it there too for cleanliness.)

## Test

1. Locally or live, go to `/login`, click "Continue with Google", pick
   a Google account.
2. First time with that email: should create a new guest account and
   land on `/dashboard`.
3. Try it again with the same Google account: should log into the same
   account (not create a duplicate).
4. Same button, same flow, from `/register`.
