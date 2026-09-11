# Zarmaganda room fix + inventory (original roster)

## What this does

A new management command, `apply_zarmaganda_room_inventory`, transcribed
from the 9 handwritten inventory photos you uploaded (the "original" room
roster and per-room item lists), does three things:

1. **Fixes 5 rooms** whose live room_number/category didn't match the
   original roster — everything else (15 rooms) already matched and is
   left untouched:
   - `2010` → `210` (typo)
   - `Suitea 1` → `Suite 1`, `Suites 2` → `Suite 2` (typos)
   - `Deluxe 1` → `VIP 1`, `Deluxe 2` → `VIP 2` (recategorized —
     confirmed with you: the roster has no "Executive Deluxe" tier for
     Zarmaganda at all, only VIP)
2. **Creates the "VIP" category** (didn't exist before). Price is a
   **placeholder** — base ₦100,000 / weekend ₦110,000 / holiday
   ₦120,000 — since it wasn't in the source material. Change it any
   time from Admin → Rooms → Categories → Edit "VIP"; no need to re-run
   this command.
3. **Populates per-room inventory** for the 13 rooms that had an
   itemized list in the photos (101, 102, 103, 104, 106, 201, 203, 204,
   205, 209, 210, VIP 1, Suite 1), and a **placeholder** for the 7 that
   didn't (105, 202, 206, 207, 208, VIP 2, Suite 2) — same pattern as
   Rayfield's Room 203.
4. **Populates kitchen inventory** (32 items — plates, pots, fridges,
   deep freezer, blender, microwave, etc.) as shared `department=kitchen`
   assets, not tied to any specific room, visible to Kitchen Staff.

A few quantities in the source sheets were illegible or struck through —
those are flagged in each item's `notes` field in the app rather than
guessed at, worth a physical re-check when convenient.

**No room photos in this pass** — you said you'll upload real photos
later. Nothing here touches `RoomPhoto`.

## Install

Copy `apply_zarmaganda_room_inventory.py` into:

```
apps/rooms/management/commands/apply_zarmaganda_room_inventory.py
```

## Test — run on the LIVE Render database, not local

Same lesson as Rayfield: this must run from the **Render Shell tab**
(the `root@srv-...:/app#` prompt), not your laptop's local terminal —
otherwise it'll touch a different database than the one guests see.

```bash
python manage.py apply_zarmaganda_room_inventory
```

That's a **dry run** — review the output carefully, especially:
- the 5 renumber/recategorize lines match what's expected above
- the VIP category creation line shows the placeholder price
- Step 2 shows the right item count per room, and the 7 placeholder
  rooms are correctly flagged
- Step 3 shows all 32 kitchen items

If it all looks right, commit it:

```bash
python manage.py apply_zarmaganda_room_inventory --apply
```

Then verify:

```bash
python manage.py shell
```
```python
from apps.hotels.models import Hotel
from apps.rooms.models import Room

z = Hotel.objects.get(branch="zaramaganda")
for r in Room.objects.filter(hotel=z).order_by("room_number"):
    print(f"  {r.room_number!r:12} -> {r.category.name}")
```

You should see 20 rooms, with `VIP 1`/`VIP 2` now under category "VIP"
and `210`/`Suite 1`/`Suite 2` corrected.

## Still to do after this

- Adjust the VIP nightly price when you have the real figure.
- Get itemized inventory for the 7 placeholder rooms when convenient.
- Upload real photos for Zarmaganda rooms when you have them — I'll
  build a photo-migration command the same way we did for Rayfield
  once they're ready.
