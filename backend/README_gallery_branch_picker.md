# Gallery — branch picker + per-photo branch assignment

## What changed

Unlike Rooms, the Gallery had no concept of "branch" at all in its data
model — photos were only ever organized by content category (e.g.
"Hotel Exterior", "Zarmaganda Rooms"), and some categories genuinely mix
both branches' photos (Rayfield's entrance shots live under the same
"Hotel Exterior" category Zarmaganda's would too). So this needed an
actual schema change, not just a frontend filter.

### Backend
- **`GalleryImage` gets a new `hotel` field** (nullable — blank means
  "not yet assigned"). Migration: `0002_galleryimage_hotel.py`.
- Upload endpoint (`POST /gallery/images/upload/`) now accepts an
  optional `hotel` field.
- `GalleryImageDetailView` now supports `PATCH` (staff-only) so an
  existing photo's branch can be changed after the fact — needed since
  your 20 existing photos predate this field and start out unassigned.
- `GalleryImageSerializer` now returns `hotel`, `hotel_name`, `branch`.

### Frontend
- **`types.ts`** — added `hotel`, `hotel_name`, `branch` to the
  `GalleryImage` type.
- **`AdminGallery.tsx`** — clicking the **Images** tab now shows a
  branch picker (Rayfield / Zarmaganda / **Unassigned**) instead of all
  20+ photos at once. Click a branch, only its photos show.
  - Every photo card now has a small branch dropdown right on it — so
    you can go through the **Unassigned** bucket once and quickly tag
    each of your 20 existing photos to the right branch, no separate
    edit screen needed.
  - The Upload modal has a new optional "Branch" field — uploads made
    while viewing a specific branch pre-fill that branch automatically.
  - The lightbox (full-size photo viewer) now only cycles through the
    currently-selected branch's photos, not every photo in the gallery.

## Install

1. Copy `gallery_models.py` → `apps/gallery/models.py`
2. Copy `0002_galleryimage_hotel.py` → `apps/gallery/migrations/0002_galleryimage_hotel.py`
3. Copy `gallery_serializers.py` → `apps/gallery/serializers.py`
4. Copy `gallery_views.py` → `apps/gallery/views.py`
5. Copy `AdminGallery.tsx` → `frontend/src/pages/admin/AdminGallery.tsx`
6. Copy `types_gallery.ts` → `frontend/src/types/index.ts`

## Test — run the migration on the LIVE Render database

Same rule as always: run this from the **Render Shell tab**, not local.

```bash
python manage.py migrate gallery
```

Then:
1. Go to `/admin/gallery`, click **Images** — you should see a branch
   picker: Rayfield, Zarmaganda, and **Unassigned (20)**.
2. Click **Unassigned** — go through each photo and use its branch
   dropdown to tag it Rayfield or Zarmaganda. As you do, the counts on
   the picker screen update.
3. Click **Rayfield** — should show only Rayfield's tagged photos.
4. Click **Upload Images** while viewing a branch — the Branch field
   should pre-fill to that branch.
