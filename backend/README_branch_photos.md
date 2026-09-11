# SchoolOS — Installable App (PWA)

Same approach used for Enayi Hotels and LogiSell — one build, installable
on both desktop and mobile, no separate app to maintain. Uses
`vite-plugin-pwa`.

## How "automatic" this actually is

One tap, not zero — browsers deliberately never install anything
silently.

- **Android / Chrome**: a banner (built here, not relying on Chrome's own
  inconsistent one) shows an **Install App** button. One tap installs
  it — no app store, no download screen.
- **iPhone / Safari**: Apple doesn't allow any install prompt at all,
  even a one-tap one — only Share → "Add to Home Screen" works, which is
  an Apple platform restriction, not something any web app can change.
  The banner shows those exact instructions on iOS instead of a button.
- **Desktop (Chrome/Edge)**: same banner, positioned as a small card in
  the corner, wording adapted to "Install it as a desktop app."

Once installed, opening it from the home screen/desktop is instant and
stays there — no more hunting through browser tabs.

## The one thing I was most careful about

This app's data (exam results, attendance, fees, an exam attempt reset
via a retake) changes constantly. A careless service worker will happily
cache an API response and show a stale result. Every `/api/` request is
configured `NetworkOnly` — confirmed in the `runtimeCaching` rule and
the `navigateFallbackDenylist`, matching the exact same fail-safe pattern
already used for Enayi Hotels and LogiSell. Only the app shell itself
(JS, CSS, fonts, icons) is cached — the *data* inside it is always live.

**Honest gap:** unlike the Enayi Hotels/LogiSell rounds, I didn't have
your full project tree here to run a real `vite build` and inspect the
actual compiled service worker output — only these 4 files. I
type-checked `App.tsx`/`InstallPrompt.tsx` and validated
`vite.config.ts`/`index.html` structurally, but **your own `npm run
build` below is the real verification step** this time, not something
I've already confirmed myself. Worth checking `dist/sw.js` afterward for
`NetworkOnly` the same way, if you want to double-check.

---

## Where each file goes

| File | Destination |
|---|---|
| `vite.config.ts` | `frontend\vite.config.ts` (overwrite) |
| `index.html` | `frontend\index.html` (overwrite) |
| `App.tsx` | `frontend\src\App.tsx` (overwrite) |
| `InstallPrompt.tsx` | `frontend\src\components\InstallPrompt.tsx` (**new** file) |
| `icons\pwa-192x192.png` | `frontend\public\pwa-192x192.png` |
| `icons\pwa-512x512.png` | `frontend\public\pwa-512x512.png` |
| `icons\maskable-icon-512x512.png` | `frontend\public\maskable-icon-512x512.png` |
| `icons\apple-touch-icon.png` | `frontend\public\apple-touch-icon.png` |

Icons were generated from your actual `favicon.svg` (the purple/blue
lightning mark) — `icons.svg` turned out to be an unrelated sprite sheet
of misc UI icons (Bluesky, Discord, etc.), not your app logo, so it was
left untouched.

## What changed and why

| File | Change |
|---|---|
| `vite.config.ts` | Added `vite-plugin-pwa` with the manifest (name, purple theme color matching your logo, icons) and the strict network-only rule for `/api/*`. |
| `index.html` | Added iOS-specific meta tags (Apple doesn't read the web manifest). Also fixed the browser tab title, which was still the placeholder `"frontend"` — now says `"SchoolOS"`. |
| `src/App.tsx` | Mounted `<InstallPrompt />` as a sibling to `<Routes>` (wrapped both in a fragment, since `App` previously returned `<Routes>` directly with no wrapper element) — shows app-wide, for every role. |
| `src/components/InstallPrompt.tsx` | **New file** — the custom install banner: Install App button on Android/Chrome/Desktop, Add-to-Home-Screen instructions on iOS. Dismissible, remembers the dismissal, never shows once actually installed. |

---

## Install and test

```powershell
cd C:\Users\ADRIAN\schoolos\frontend
npm install -D vite-plugin-pwa
npm run build
```

Then test the actual build (not the dev server — service workers need a
real production build to register):

```powershell
npx vite preview
```

Open the printed local URL in Chrome:
1. Confirm the install banner appears bottom-right (or bottom-of-screen
   on a narrow/mobile viewport)
2. Click **Install App** — should create a real shortcut/window
3. Open DevTools → Application tab → Service Workers — confirm one is
   registered and **active**
4. Application tab → Manifest — confirm name "SchoolOS," the purple
   theme color, and all three icons load without errors
5. On an actual phone, visit the deployed site in Chrome (Android) or
   Safari (iOS) and confirm the same banner/instructions appear there
6. **Most important**: after installing, use the app normally — check a
   result, an exam, attendance — refresh, confirm everything's still
   accurate. That's the one thing that must never regress with a PWA.

---

## Commit and push

```powershell
cd C:\Users\ADRIAN\schoolos

git add frontend/vite.config.ts frontend/index.html frontend/src/App.tsx frontend/src/components/InstallPrompt.tsx frontend/public/pwa-192x192.png frontend/public/pwa-512x512.png frontend/public/maskable-icon-512x512.png frontend/public/apple-touch-icon.png

git status   # confirm exactly these 8 files are staged before committing

git commit -m "Installable app (PWA): works on mobile and desktop alike, API always network-only

Same pattern as Enayi Hotels and LogiSell - vite-plugin-pwa with a
custom install banner (Android/Chrome/Desktop button, iOS Add-to-Home-
Screen instructions), generated from the real favicon.svg logo mark.
Every /api/ request is NetworkOnly - only the app shell is cached, so
exam results, attendance, and fee data are never served stale."

git push origin main
```

## Render deployment

Frontend-only change — Render auto-deploys the static site on push, no
backend/migration steps needed this time.
