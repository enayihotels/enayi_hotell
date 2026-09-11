# Admin Categories — branch picker + real per-branch pricing

## What changed

Same idea as the Rooms tab fix, plus one more thing: your backend was
already computing real **per-branch prices** for each category (via
`RoomCategoryPrice` — that's why Zarmaganda's Standard rooms show
₦30,000 while Rayfield's or the category default shows ₦40,000) but the
Admin Categories tab was only ever displaying the category's global
default price, never the branch-specific one. That's the mismatch you
were seeing.

Now:

1. Clicking the **Categories** tab shows a branch picker first (same as
   Rooms), instead of one set of categories with a single global price
   that doesn't match what guests actually see.
2. Pick a branch, and each category card shows **that branch's actual
   price** (pulled from the `branch_prices` data the API already
   returns) — with a small note if no branch-specific price has been
   set yet for that category ("no [Branch] override set — showing
   default"), so it's clear when you're seeing a fallback vs. the real
   number.
3. Room counts on each category card now reflect just that branch too.
4. Clicking a category card jumps to the **Rooms** tab already filtered
   to that category **and** that branch — so you land straight on
   exactly the rooms you clicked into, not every branch's rooms in that
   category.

`types.ts` — added the `branch_prices` field to the `RoomCategory`
TypeScript type (the backend serializer already sent this; the frontend
type just didn't know about it yet).

## Install

Copy both files, overwriting the existing ones:
- `AdminRooms.tsx` → `frontend/src/pages/admin/AdminRooms.tsx`
- `types.ts` → `frontend/src/types/index.ts`

## Test

1. Go to `/admin/rooms`, click **Categories** — you should see the
   branch picker (Rayfield / Zarmaganda), not a category grid.
2. Click **Zarmaganda** — Standard should now show ₦30,000 (matching
   what Room 101 actually charges), not the ₦40,000 global default.
3. Click **Rayfield** — categories there should show Rayfield's actual
   prices.
4. Click a category card (e.g. Standard, under Zarmaganda) — should
   land on the Rooms tab already filtered to "Zarmaganda" + "Standard",
   showing only those rooms.
5. If any category has no branch-specific price set at all for a given
   branch, its card should show the "(no [Branch] override set)" note
   next to the fallback price — that's expected, not a bug, it's
   flagging where you haven't set an override yet.
