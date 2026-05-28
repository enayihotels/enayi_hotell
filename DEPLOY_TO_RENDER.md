# 🚀 Deploying Enayi Hotels to Render — Complete Guide

This guide takes you from your local code to a live, working website on Render,
with **no errors** and within a **~$7/month** budget for your 2–4 week test.

Everything in this guide assumes you are using the **fixed** version of the project
(the one this guide ships inside).

---

## 0. What you're deploying & what it costs

| Service | What it is | Render plan | Cost |
|---|---|---|---|
| `enayi-backend` | Django API + Admin | **Starter** | **$7 / month** |
| `enayi-db` | PostgreSQL database | **Free** (≈30 days) | **$0** |
| `enayi-frontend` | React site (the build) | **Static Site** | **$0** |
| Redis | _Not needed_ — your code doesn't use Celery/Channels/cache | — | **$0** |

**Total ≈ $7/month.** You have ~$14 of buffer. When the free database nears its
~30‑day expiry, upgrade it to **Basic‑256mb (~$6/mo)** *before* it's deleted so you
keep your data.

> 💡 Why pay $7 for the backend instead of using the free web service?
> The free tier "spins down" after 15 minutes idle and takes ~50 seconds to wake.
> During a demo that looks like the site is broken. The $7 Starter plan stays
> always‑on, which is what you want for testing with real people.

---

## 1. Prerequisites (one‑time)

1. A **GitHub account** — https://github.com/signup
2. **Git** installed on your computer — https://git-scm.com/downloads
3. A **Render account** — https://render.com (sign up with your GitHub — no card needed to start)

---

## 2. Push your code to GitHub

Open a terminal **inside the project folder** (the folder that contains
`render.yaml`, `backend/`, and `frontend/`).

```bash
# 1. Start a fresh git repo
git init
git branch -M main

# 2. Stage everything (the .gitignore already excludes venv, node_modules, .env, etc.)
git add .

# 3. IMPORTANT: make sure your seed images are included (they're un-ignored now)
git add backend/media

# 4. Commit
git commit -m "Enayi Hotels — production-ready for Render"
```

Now create an **empty** repository on GitHub (no README, no .gitignore) named e.g.
`enayi-hotels`. GitHub shows you a URL like `https://github.com/YOURNAME/enayi-hotels.git`.
Connect and push:

```bash
git remote add origin https://github.com/YOURNAME/enayi-hotels.git
git push -u origin main
```

> ⚠️ Your real `.env` files are **not** pushed (the `.gitignore` blocks them on
> purpose). You'll set those values inside Render instead — see Step 4.

---

## 3. Create everything on Render with the Blueprint

The repo includes a `render.yaml` that creates all three services at once.

1. Go to the Render Dashboard → click **New +** (top right) → **Blueprint**.
2. Click **Connect** next to your `enayi-hotels` GitHub repo
   (authorize Render to access GitHub if it asks).
3. Render reads `render.yaml` and shows a plan: **enayi-db**, **enayi-backend**,
   **enayi-frontend**. Give the blueprint a name (e.g. `enayi`) and click
   **Apply** / **Create Resources**.
4. Render now builds all three. The backend build takes ~3–5 minutes
   (installing Python packages). Watch the **Logs** tab of `enayi-backend`.

You'll know it worked when the backend log ends with lines like:
```
Booting worker with pid ...
Listening at: http://0.0.0.0:10000
```

> If `SECRET_KEY` is asked for, Render auto‑generates it (the blueprint says so).
> If it ever prompts you for a value you don't have, just type any long random
> string for `SECRET_KEY`.

---

## 4. Set your secret keys (the `sync: false` values)

The blueprint intentionally leaves real secrets blank so they never touch GitHub.
Fill them in now:

1. Open the **enayi-backend** service → **Environment** tab.
2. Add values for any you use (leave blank ones you don't):
   - `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY` — your test keys
   - `OPENAI_API_KEY` — only if you want the AI concierge working
   - `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` — only if you want OTP emails sent
3. Click **Save Changes**. Render redeploys automatically.

> The app runs fine even if these are blank — OTP email "fails silently" and
> payment buttons simply won't complete a charge. Nothing crashes.

---

## 5. Connect the frontend to the backend (the one wire you must check)

1. After the backend is live, copy its URL from the top of its dashboard page —
   it looks like `https://enayi-backend.onrender.com`
   (Render may add a suffix, e.g. `enayi-backend-ab12.onrender.com`).
2. Open the **enayi-frontend** service → **Environment** tab.
3. Make sure `VITE_API_URL` is **exactly** that backend URL — **no trailing slash**.
   Fix it if Render assigned a different name.
4. Also set `VITE_PAYSTACK_PK` to your Paystack **public** test key (optional).
5. **Save Changes**, then go to the frontend's **Manual Deploy → Deploy latest commit**
   (the API URL is baked in at build time, so it must rebuild after this change).

---

## 6. Create your admin login & add data

Your live database starts **empty** (that's normal). Create an admin user:

1. Open **enayi-backend** → **Shell** tab (top right).
2. Run:
   ```bash
   python manage.py createsuperuser
   ```
   Enter an email and password.
3. Visit `https://YOUR-BACKEND-URL/admin/` and log in.
4. Add Hotels, Rooms, Gallery images, etc. through the admin.

### (Recommended) Bring your offline data online
If your local site already has rooms/images you want online, do this **on your computer**:

```bash
# In your local backend/ folder, with your local DB running:
python manage.py dumpdata --natural-foreign --natural-primary \
  -e contenttypes -e auth.permission -e sessions -e admin.logentry \
  -e admin -e sessions > fixtures/seed.json
```

Commit and push `fixtures/seed.json` **and** your `backend/media/` images:
```bash
git add backend/fixtures/seed.json backend/media
git commit -m "Add seed data and images"
git push
```

Then in the Render **Shell** for `enayi-backend`:
```bash
python manage.py loaddata fixtures/seed.json
```
Your rooms and their images will now appear on the live site.

---

## 7. Verify it works (no errors)

Open these URLs in your browser:

- ✅ **Frontend**: `https://enayi-frontend.onrender.com` — the homepage loads
- ✅ **API docs**: `https://YOUR-BACKEND-URL/api/docs/` — Swagger page loads
- ✅ **Admin**: `https://YOUR-BACKEND-URL/admin/` — you can log in
- ✅ Register/login on the frontend, browse rooms — data comes from the backend

If room images don't show, it's almost always Step 6 (no data yet) or Step 5
(`VITE_API_URL` wrong / frontend not rebuilt after changing it).

---

## 8. When the test is over

- **Keep it running for real?** Upgrade `enayi-db` to **Basic‑256mb (~$6/mo)** in
  its dashboard **before** the free database's ~30‑day expiry, or your data is deleted.
- **Done testing?** Suspend or delete the services so you stop being billed.

---

## Troubleshooting cheat‑sheet

| Symptom | Cause | Fix |
|---|---|---|
| Backend build fails on a package | A new dependency needs system libs | Check the failing package in logs; tell us which one |
| `DisallowedHost` error | Host not allowed | Confirm `ALLOWED_HOSTS` contains `.onrender.com` (it does by default) |
| Frontend loads but API calls fail (CORS / network) | `VITE_API_URL` wrong or not rebuilt | Redo Step 5, then **Manual Deploy** the frontend |
| Images 404 | No data in DB, or media not pushed | Do Step 6; ensure `git add backend/media` ran |
| Admin login "CSRF" error | Trusted origin missing | Add `https://YOUR-BACKEND-URL` to `CSRF_TRUSTED_ORIGINS` env var |
| Site refresh on `/rooms` gives 404 | SPA routing | The blueprint's rewrite rule handles this; confirm it's present |
| DB "connection refused" at build | Migrate ran before DB ready | Re‑deploy; `preDeployCommand` runs migrate after build with DB attached |

---

## What was changed to make this deploy‑ready (summary)

**Backend**
- Cleaned the broken database config; `DATABASE_URL`‑first with SSL on Render.
- Made Redis optional (your code uses no Celery/Channels/cache) → $0, no Redis service.
- WhiteNoise switched to non‑manifest storage (a missing asset can't 500 the site).
- Fixed `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`; added `SECURE_PROXY_SSL_HEADER`
  so media URLs are HTTPS (no mixed‑content image failures).
- `/media/` is now served in production (was DEBUG‑only → images would 404).
- Removed `weasyprint` (Render build‑breaker) and `python-magic` (both unused).
- Pinned `setuptools<81` (newer versions removed `pkg_resources`, which `drf_yasg` needs).

**Frontend**
- API client now uses `VITE_API_URL` instead of a hardcoded dev‑proxy URL.
- Fixed `booking_number` → `booking_reference` (matches the backend).
- Added `avatar`/`nationality`/`date_of_birth` to the auth store's `User` type.
- These fixes make `npm run build` (which runs `tsc`) pass — it failed before.

**Project**
- Added `render.yaml`, `backend/.env.example`, `frontend/.env.example`.
- Un‑ignored `backend/media/` so seed images deploy.
