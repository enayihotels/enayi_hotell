# Fix: Food/Bar ordering wasn't actually filtering anything

## What was actually wrong

There were two unrelated controls on the guest ordering page that
looked connected but weren't:

1. **Category chips** (Breakfast, Rice Specialties, Beers & Spirits,
   etc.) — these did filter the menu, by one specific category.
2. **An "Order from: Room Service / Kitchen / Bar / Restaurant" row**
   — this looked like it should filter Food vs. Bar, but it never
   touched which items were displayed at all. It only tagged which
   department the order would be routed to — completely disconnected
   from browsing. That's the bug you ran into: selecting "Bar" never
   hid food items, because it was never wired to do that in the first
   place.

**A second, related problem I found while fixing this:** that same
"source" value isn't just cosmetic — Bar Staff can only update orders
tagged `bar`/`room_service`, Kitchen Staff only `kitchen`/`room_service`.
Since guests were picking this manually with no real guidance, a wrong
guess could leave an order visible in a staff member's queue but
blocked (403) when they tried to act on it. There was even a code
comment from earlier development flagging this exact risk.

## The fix

- **Replaced** the confusing 4-way "Order from" row with a clear
  **Food / Drinks** toggle that actually filters both the category
  chips and the items shown — using `category_type` (already present
  on every menu item) against the same `FOOD_TYPES`/`DRINK_TYPES`
  grouping already used on the backend for Kitchen vs. Bar queues, so
  guest-side and staff-side now agree on what counts as "food" and
  what counts as "drink."
- **Removed** the manual source picker entirely. `source` is now
  computed automatically from what's actually in the cart at checkout:
  food-only → `kitchen`, drink-only → `bar`, a mixed cart → `room_service`
  (which both Kitchen and Bar staff can act on). This closes the
  mismatch risk — the value sent to the backend now always genuinely
  reflects what was ordered.

## Changed file

**`OrdersPage.tsx`** → `frontend/src/pages/guest/OrdersPage.tsx`

## Install

```powershell
Move-Item $env:USERPROFILE\Downloads\OrdersPage.tsx .\frontend\src\pages\guest\OrdersPage.tsx -Force
```

No migration needed — pure frontend, and `source`'s possible values
haven't changed, just how it gets set.

## Test

1. As a Guest, go to Food & Bar → confirm it opens on the **Food** tab
   with only food categories/items showing (no drinks mixed in).
2. Switch to **Drinks** → confirm only drink categories/items show now,
   and the previously active category resets cleanly.
3. Add a food item to the cart and place the order → as Kitchen Staff
   at that branch, confirm the order appears and you can update its
   status.
4. Add a drink item instead → confirm it's Bar Staff who can act on it
   this time, not Kitchen.
5. Add one of each to the same cart and place it → confirm it shows up
   for both Kitchen and Bar Staff (room_service).
