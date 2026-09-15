# Front Desk / Manager can now book rooms on behalf of a guest

## What was actually wrong

The booking API always created the booking under `guest=request.user` —
whoever was logged in. So when Front Desk or a Manager used it, the
booking was created under *their own* staff account, not the actual
guest. There was also no way to reach a booking form from the admin
side at all — the booking page only ever lived inside the guest
dashboard.

## What changed

### Backend — `apps/bookings/serializers.py`
`CreateBookingSerializer` now accepts optional `guest_email`,
`guest_first_name`, `guest_last_name`, `guest_phone`. When a request
comes from Front Desk ("staff"), Manager, or Admin **and** includes
`guest_email`:
- If that email already has an account, the booking is created for
  that real guest.
- If not, a minimal guest account is created on the spot — same
  pattern as Google Sign-In (no password, verified immediately, since
  staff are vouching for the person in person or by phone).
- The booking's `source` defaults to `walk_in` instead of `website`
  for staff-created bookings (still overridable to `phone`/`agent`).
- `assigned_by` (an existing field on `Booking` that was never actually
  used anywhere) now records which staff member created it.

A regular guest trying to pass `guest_email` themselves is rejected —
self-service booking always stays tied to whoever is actually logged in.

### Frontend
- **`AdminBookings.tsx`** — new **"New Booking"** button opens a form:
  guest email/phone/name, branch, room class, dates, adults/children,
  how it was booked (walk-in/phone/travel agent), special requests.
  The bookings list now also shows "Booked by [staff name] · walk-in"
  under the guest's name when applicable.
- **`types.ts`** — added `assigned_by_name` to the `Booking` type.

## Install

1. Copy `bookings_serializers.py` → `apps/bookings/serializers.py`
2. Copy `AdminBookings.tsx` → `frontend/src/pages/admin/AdminBookings.tsx`
3. Copy `types_booking.ts` → `frontend/src/types/index.ts`

No migration needed — `assigned_by` already existed on the model, just
unused until now.

## Test

1. Log in as Front Desk, Manager, or Admin → go to **Bookings** → click
   **New Booking**.
2. Fill in a guest email that doesn't have an account yet, plus a name,
   pick a branch/room class/dates → Create Booking.
3. Confirm it succeeds and shows up in the list under that guest's name
   (not yours), with "Booked by [your name] · walk-in" beneath it.
4. Try again with an email that already has an account (e.g. a test
   guest account) — confirm it attaches to that existing account
   instead of creating a duplicate.
5. As a **Guest** role account, confirm the normal self-booking flow
   at `/book` still works unchanged.
