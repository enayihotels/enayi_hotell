# Gallery — show each branch's actual rooms, not just tagged Gallery photos

## What changed

You already have real per-room photos in the system (from `RoomPhoto`,
managed via Admin → Rooms → Photos on each room card) — separate from
the Gallery's own tagged marketing photos. Rather than making you
re-upload the same room photos a second time into the Gallery, the
branch view in Admin → Gallery now pulls those room photos in directly
and shows them as a "Rooms at [Branch]" section, read-only, with a link
to manage them from Rooms.

### Backend
- New endpoint: `GET /api/v1/rooms/branch-photos/?hotel=<branch-or-id>`
  (staff-only). Returns every room at that branch with its `RoomPhoto`
  photos, grouped — same hotel-resolution logic as `branch-availability`
  (accepts either a branch key like `fwawei` or a hotel UUID).
- `rooms_urls.py` — registers the new route.

### Frontend
- **`AdminGallery.tsx`** — when a real branch is selected (not the
  Unassigned bucket), a new "Rooms at [Branch]" section appears above
  the Gallery-tagged photos, showing every room with its first photo
  (or "No photo yet"), room number, category, and a "Manage in Rooms →"
  link. Clicking a room's photo opens a lightbox to browse all of that
  room's photos. This section is purely a read-only overview — uploads,
  edits, and deletes for room photos still happen in Admin → Rooms, to
  avoid having two separate places that can each half-manage the same
  photo.

## Install

1. Copy `rooms_views.py` → `apps/rooms/views.py`
2. Copy `rooms_urls.py` → `apps/rooms/urls.py`
3. Copy `AdminGallery.tsx` → `frontend/src/pages/admin/AdminGallery.tsx`

No migration needed — this only adds a new read endpoint and a new
frontend section, no schema change.

## Test

1. Go to `/admin/gallery` → **Images** → click **Rayfield**.
2. You should see a new "Rooms at Enayi Hotels & Suites — Rayfield"
   section above the (currently empty, until you tag some) Gallery
   photos section — showing all 14 Rayfield rooms with their real
   photos (Room 302 should show "No photo yet", matching what we know
   is still missing).
3. Click a room's photo — should open a lightbox showing all of that
   room's photos.
4. Click "Manage in Rooms →" — should take you to `/admin/rooms`.
5. Same check for Zarmaganda.
