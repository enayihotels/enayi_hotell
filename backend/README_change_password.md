# Change Password — was missing everywhere, now live for every role

## What was actually wrong

The backend has had a working `/auth/change-password/` endpoint this
whole time — but **nothing in the frontend ever called it**, for any
role. Not Admin, not Front Desk, not Bar/Kitchen/Housekeeper/Laundry,
not Guests. There was simply no button anywhere in the app that led to
it. That's the actual bug behind what you ran into after logging into
one of the new Zarmaganda accounts.

This matters more right now than it would normally, since 14 real
people currently share the same starting password (`12345678@`) —
getting this in is genuinely urgent, not just a nice-to-have.

## What's in this delivery

**`ChangePasswordModal.tsx`** (new, shared) — one modal component used
everywhere: current password, new password, confirm, with show/hide
toggles. Calls the existing backend endpoint. Doesn't log the person
out or require re-login — their current session keeps working right
after a successful change.

Wired into all three places someone can be logged in:
- **`AdminLayout.tsx`** — Front Desk Staff, Manager, Admin/Owner (the
  roles that land in `/admin`). New "Change Password" link in the
  sidebar, above "Sign Out".
- **`InventoryLayout.tsx`** — Store Keeper, Bar Staff, Kitchen Staff,
  Housekeeper, Laundry Staff (the roles that land in `/inventory` or
  `/housekeeping` — **this is where most of the 14 new Zarmaganda
  accounts actually go**, not the Admin panel). Same placement.
- **`ProfilePage.tsx`** — Guests. New "Security" section with a Change
  Password button, right below their profile details.

## Install

1. Copy `ChangePasswordModal.tsx` → `frontend/src/components/ChangePasswordModal.tsx`
2. Copy `AdminLayout.tsx` → `frontend/src/components/layout/AdminLayout.tsx`
3. Copy `InventoryLayout.tsx` → `frontend/src/components/layout/InventoryLayout.tsx`
4. Copy `ProfilePage.tsx` → `frontend/src/pages/guest/ProfilePage.tsx`

No migration needed — pure frontend, the backend endpoint already existed.

## Test

1. Log in as one of the new Zarmaganda staff (e.g. a Kitchen or Bar
   Staff account, which lands in the Inventory shell, not Admin) — find
   "Change Password" in the sidebar, change it, confirm it works and
   you're still logged in afterward.
2. Log out, log back in with the **new** password to confirm it stuck.
3. Repeat quickly for a Front Desk/Manager account (Admin panel) and a
   Guest account (Profile page) to confirm all three surfaces work.

## Worth telling your 14 new staff

Now that this exists, it'd be worth letting them know to actually go
change their password from the shared `12345678@` default soon — the
whole point of "they can change it at login" only works once this
button exists for them to find.
