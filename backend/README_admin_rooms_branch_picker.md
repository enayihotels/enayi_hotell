# Admin Rooms — pick a branch first, instead of showing all rooms at once

## What changed

`AdminRooms.tsx` — clicking the **Rooms** tab in `/admin/rooms` now shows
a branch picker (a card per branch, e.g. "Rayfield" / "Zarmaganda", each
showing its room count) instead of dumping all 34 rooms from every branch
onto the screen. Click a branch card and it filters down to just that
branch's rooms, same room cards and Edit/Photos/Delete actions as before.

Clicking the **Rooms** tab again always resets back to the branch picker,
so you get a clean "pick a branch" screen every time rather than it
remembering a stale filter.

The existing "click a category card to see that category's rooms across
every branch" flow (from the Categories tab) is untouched — that still
shows a cross-branch list on purpose, since that's a different, explicit
use case ("show me every Standard room, wherever it is").

## Install

Copy `AdminRooms.tsx` into `frontend/src/pages/admin/AdminRooms.tsx`
(overwriting the existing file).

## Test

1. Go to `/admin/rooms`, click the **Rooms** tab — you should see branch
   cards (Rayfield, Zarmaganda) with room counts, not a room list.
2. Click **Rayfield** — only Rayfield's 14 rooms should show, with a
   pill at the top showing "Rayfield ✕" to go back.
3. Click the ✕ on that pill, or click the **Rooms** tab again — back to
   the branch picker.
4. From the **Categories** tab, click a category card (e.g. "Standard")
   — should still jump straight to that category's rooms across both
   branches, unchanged from before.
5. With a branch selected, click **Add Room** — the new-room form should
   have that branch pre-filled.
