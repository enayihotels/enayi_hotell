"""
Replaces all photos for every Rayfield room with the ones Adrian
uploaded, and adds the 3 entrance photos to the public Gallery.

Reuses the SAME optimize_image_file() compression utility every
existing manual upload endpoint already uses (RoomImageUploadView,
RoomPhotoListUploadView, GalleryImageUploadView all call it) — this
command imports and calls the real function directly, so whatever
compression settings are already in place apply here identically,
with nothing reimplemented or guessed at.

WHAT THIS DOES:
1. For every Rayfield room that has photo(s) in the source folder,
   DELETES all of that room's existing RoomPhoto records (both the
   DB rows and the underlying image files), then creates new ones
   from the uploaded photos, in filename order.
2. Room 302 had no photo in the upload — its existing photos (if any)
   are deleted per "delete all previous pictures... only use the
   ones in this zipped file," and it's left with none. Flagged
   clearly in the output.
3. The 3 entrance*.jpeg files go into the Gallery under the
   "Hotel Exterior" category (found by category_type="exterior", or
   created if it doesn't exist yet).

SAFETY: defaults to a DRY RUN — prints every intended change, saves
nothing. Pass --apply to actually commit.

Usage (from backend root, after extracting the source photos folder
alongside manage.py — see README):
    python manage.py apply_rayfield_room_photos            # dry run
    python manage.py apply_rayfield_room_photos --apply     # for real
"""
import re
from pathlib import Path
from django.core.management.base import BaseCommand
from django.core.files import File
from django.db import transaction

from apps.hotels.models import Hotel
from apps.rooms.models import Room, RoomPhoto
from apps.gallery.models import GalleryCategory, GalleryImage

SOURCE_DIR = Path("rayfield_room_photos/rooms")

# All 14 Rayfield rooms — used to report which ones got zero photos.
ALL_RAYFIELD_ROOMS = ["101", "102", "103", "104", "201", "202", "203",
                       "204", "205", "206", "207", "301", "302", "303"]


def group_photos_by_room(source_dir):
    """'101.jpeg', '101..jpeg', '101...jpeg' -> {'101': [sorted files]}.
    The trailing dots are just how the phone avoided overwriting a
    same-named file — not a meaningful order — so files are sorted by
    filename, which happens to sort by increasing dot-count too, giving
    a stable, repeatable order."""
    by_room = {}
    entrance_files = []
    for f in sorted(source_dir.iterdir()):
        if not f.is_file():
            continue
        name = f.name.lower()
        if name.startswith("entrance"):
            entrance_files.append(f)
            continue
        m = re.match(r"^(\d+)\.+jpe?g$", f.name, re.IGNORECASE)
        if not m:
            continue
        room_number = m.group(1)
        by_room.setdefault(room_number, []).append(f)
    return by_room, sorted(entrance_files)


class Command(BaseCommand):
    help = "Replace all Rayfield room photos from the uploaded set; add entrance photos to Gallery."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Actually commit changes. Without this flag, dry-run only.")
        parser.add_argument("--source", default=str(SOURCE_DIR), help="Folder containing the room/entrance photos.")

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        source_dir = Path(options["source"])
        mode = "APPLYING CHANGES" if apply_changes else "DRY RUN — no changes will be saved"
        self.stdout.write(self.style.WARNING(f"\n=== {mode} ===\n"))

        if not source_dir.exists():
            self.stderr.write(self.style.ERROR(f'Source folder "{source_dir}" not found. Run this from the backend root with the photos extracted alongside manage.py.'))
            return

        try:
            hotel = Hotel.objects.get(branch="fwawei")
        except Hotel.DoesNotExist:
            self.stderr.write(self.style.ERROR('Hotel with branch="fwawei" (Rayfield) not found. Aborting.'))
            return

        by_room, entrance_files = group_photos_by_room(source_dir)

        with transaction.atomic():
            sid = transaction.savepoint()

            # ── Rooms ──
            self.stdout.write(self.style.MIGRATE_HEADING("Room photos"))
            for room_number in ALL_RAYFIELD_ROOMS:
                try:
                    room = Room.objects.get(hotel=hotel, room_number=room_number)
                except Room.DoesNotExist:
                    self.stdout.write(self.style.ERROR(f'  SKIP: Room "{room_number}" not found at Rayfield.'))
                    continue

                existing = list(RoomPhoto.objects.filter(room=room))
                new_files = by_room.get(room_number, [])

                if not new_files:
                    self.stdout.write(f'  Room {room_number}: NO photo provided — deleting {len(existing)} existing photo(s), room will have none.')
                else:
                    self.stdout.write(f'  Room {room_number}: deleting {len(existing)} existing photo(s), adding {len(new_files)} new')

                if apply_changes:
                    for photo in existing:
                        photo.image.delete(save=False)
                        photo.delete()
                    for i, path in enumerate(new_files):
                        from apps.rooms.image_utils import optimize_image_file
                        with open(path, "rb") as fh:
                            django_file = File(fh, name=path.name)
                            optimized = optimize_image_file(django_file)
                            caption = f"View {i + 1}" if len(new_files) > 1 else ""
                            RoomPhoto.objects.create(room=room, image=optimized, caption=caption)

            # ── Entrance -> Gallery ──
            self.stdout.write(self.style.MIGRATE_HEADING("\nEntrance photos -> Gallery"))
            category = GalleryCategory.objects.filter(category_type="exterior").first()
            if category is None:
                self.stdout.write('  No "Hotel Exterior" gallery category found — will create one.')
                if apply_changes:
                    category = GalleryCategory.objects.create(
                        name="Hotel Exterior", slug="hotel-exterior", category_type="exterior",
                    )
            else:
                self.stdout.write(f'  Using existing gallery category: "{category.name}"')

            self.stdout.write(f'  Adding {len(entrance_files)} entrance photo(s)')
            if apply_changes:
                for i, path in enumerate(entrance_files):
                    from apps.rooms.image_utils import optimize_image_file
                    with open(path, "rb") as fh:
                        django_file = File(fh, name=path.name)
                        optimized = optimize_image_file(django_file)
                        title = "Rayfield Entrance" if i == 0 else f"Rayfield Entrance ({i + 1})"
                        GalleryImage.objects.create(
                            category=category, image=optimized, title=title,
                            alt_text="Enayi Hotels & Suites — Rayfield entrance",
                        )

            if not apply_changes:
                transaction.savepoint_rollback(sid)
                self.stdout.write(self.style.WARNING(
                    "\n=== DRY RUN complete — nothing was saved. Review the output above, "
                    "then re-run with --apply to commit. ==="
                ))
            else:
                transaction.savepoint_commit(sid)
                self.stdout.write(self.style.SUCCESS("\n=== Done — all changes committed. ==="))
