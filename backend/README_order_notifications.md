# Instant SMS + email notifications for Kitchen/Bar Staff on new orders

## What it does

The moment a guest's order is fully placed, every Kitchen Staff member
at that branch gets an SMS + email if the order has food items, and
every Bar Staff member gets one if it has drink items (an order with
both notifies both groups). No one has to keep the app open and refresh
to check for new work — the phone genuinely "beeps."

Scoped strictly to the order's own branch — a Rayfield order never
notifies Zarmaganda staff, same rule as everywhere else in the app.

**Nothing here can ever block or fail a guest's order.** By the time
this runs, the order is already fully saved — if Termii is down, a
staff member has no phone number on file, or the email server hiccups,
the order still goes through fine; the failure is just logged.

## New file

**`notifications.py`** (new, `apps/orders/notifications.py`) — the
whole feature lives here:
- `_send_sms(phone, message)` — calls Termii's SMS API. Returns
  `False` and logs a warning on any failure (no key configured, bad
  phone number, Termii error) rather than raising.
- `notify_new_order(order)` — looks at what's actually in the order
  (reusing the same `FOOD_TYPES`/`DRINK_TYPES` categorization already
  used to split Kitchen vs Bar order queues elsewhere), finds the
  matching staff at that branch, and notifies each one by SMS + email.

## Changed files

- **`settings.py`** — two new settings:
  - `TERMII_API_KEY` — from env, **no real default** (it's a secret —
    unlike the Google Client ID, this must never be hardcoded).
  - `TERMII_SENDER_ID` — from env, defaults to `"Termii"` (their shared
    sender ID, works immediately without approval). Switch it to your
    own once a custom Sender ID is approved on their dashboard.
- **`orders_views.py`** → `apps/orders/views.py` — one addition: right
  after an order is successfully created, calls `notify_new_order`,
  wrapped so any failure there is logged and swallowed, never surfaced
  to the guest.

## Install

1. Copy `settings.py` → `config/settings.py`
2. Copy `notifications.py` → `apps/orders/notifications.py`
3. Copy `orders_views.py` → `apps/orders/views.py`

No migration needed — nothing here touches the database schema.

## ⚠️ Required: add your Termii API key to Render

This won't send any real SMS until you add the key. In the Render
Dashboard → your **backend web service** → **Environment** → add:

```
TERMII_API_KEY = <paste your real Termii API key here>
```

(Leave `TERMII_SENDER_ID` unset for now — it'll use Termii's shared
default automatically until you tell me you have a custom one
approved.)

## ⚠️ Also required: phone numbers on Kitchen/Bar staff accounts

SMS can only reach staff who have a phone number saved. Check this in
the Render Shell:

```python
python manage.py shell
```
```python
from apps.accounts.models import User

for u in User.objects.filter(role__in=["kitchen_staff", "bar_staff"]).select_related("hotel"):
    print(f"{u.email!r:35} role={u.role:15} hotel={u.hotel.branch if u.hotel else None:12} phone={u.phone or 'MISSING'}")
```

Anyone showing `phone=MISSING` won't get texted (they'll still get the
email, if their email is real) until a phone number is added — either
by them updating their own profile, or you setting it directly:

```python
u = User.objects.get(email="someone@example.com")
u.phone = "08031234567"  # any normal Nigerian format works, it auto-converts
u.save()
```

## Test

1. Make sure a Kitchen or Bar Staff test account has a real phone
   number you can check (your own, for testing).
2. As a Guest, place an order containing at least one food item.
3. Within a few seconds, that branch's Kitchen Staff should get a text
   and an email. Bar Staff should NOT be notified for a food-only
   order.
4. Place an order with a drink item — only Bar Staff should be
   notified this time.
5. Place an order with both — both groups get notified.
6. Place an order at Rayfield while logged in as Zarmaganda Kitchen
   Staff (or vice versa) — confirm you do NOT get notified for the
   other branch's order.
