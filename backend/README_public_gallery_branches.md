# Public Gallery — branch tabs + real room photos, animated

## What changed

The guest-facing `/gallery` page previously had tabs for content
categories (Reception, Hotel Exterior, Bar & Lounge, etc.) and only ever
showed the curated Gallery-tagged photos — never the actual per-room
photos you've been uploading via Admin → Rooms → Photos.

Now:

1. **Tabs are just "All", "Rayfield", "Zarmaganda"** — no more category
   tabs. Click a branch, see everything for that branch.
2. **Each branch's view merges two sources**: the Gallery-tagged photos
   assigned to that branch (via the branch picker we added to Admin →
   Gallery) **and** that branch's actual room photos (the same ones
   shown in Admin → Rooms → Photos), so guests see the exact rooms you
   have photographed, not just generic marketing shots.
3. **Nicer transitions** — switching branches now cross-fades the grid,
   and photos stagger in with a subtle rise-and-fade as they load,
   instead of just popping in.

### Backend
- New public endpoint: `GET /api/v1/rooms/branch-photos/public/?hotel=<branch-or-id>`
  — same data as the staff-only one added for Admin Gallery, just without
  requiring login. No new model or migration, just a new read endpoint.

### Frontend
- **`GalleryPage.tsx`** — full rewrite: branch tabs instead of category
  tabs, merges Gallery photos + room photos per branch, `AnimatePresence`
  for the branch-switch transition, staggered entrance animation per
  photo, and a caption overlay on hover (room photos show "Room 101 —
  Standard", Gallery photos show their title).

## ⚠️ Important — why this may look sparse at first

Every existing Gallery photo (Reception, Exterior, Bar & Lounge, etc.)
is currently **Unassigned** to a branch (we set that up together in
Admin → Gallery, but haven't gone through tagging the 31 existing
photos yet). Until you assign them a branch there, this public page will
only show **room photos** under Rayfield/Zarmaganda — the Gallery photos
simply won't appear under either branch tab (they're not "lost", just
not tagged yet). Once you tag them in Admin → Gallery, they'll show up
here automatically.

## Install

1. Copy `rooms_views.py` → `apps/rooms/views.py`
2. Copy `rooms_urls.py` → `apps/rooms/urls.py`
3. Copy `GalleryPage.tsx` → `frontend/src/pages/public/GalleryPage.tsx`

No migration needed.

## Test

1. Go to `/gallery` on the live site.
2. Click **Rayfield** — should show Rayfield's real room photos (101,
   102, 103... each captioned "Room 101 — Executive Deluxe" etc. on
   hover), with a smooth fade/stagger-in.
3. Click **Zarmaganda** — same, for Zarmaganda's rooms.
4. Click between tabs a few times — the grid should cross-fade rather
   than jump.
5. Once you've tagged some Gallery photos to a branch in Admin →
   Gallery, refresh and confirm they now appear mixed in with that
   branch's room photos here too.
