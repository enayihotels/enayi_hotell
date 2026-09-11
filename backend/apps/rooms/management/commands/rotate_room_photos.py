"""
Rotate the stored RoomPhoto image(s) for one or more rooms — for photos
that came out sideways/upside-down. This is a genuine pixel rotation
(not an EXIF-tag fix — the upload pipeline already auto-corrects EXIF
orientation via ImageOps.exif_transpose, so if a photo still looks wrong
after upload, the pixels themselves are actually stored that way).

Usage (from backend root):
    # See what would be rotated, without touching anything:
    python manage.py rotate_room_photos --branch fwawei --rooms 202 --degrees -90

    # Actually do it:
    python manage.py rotate_room_photos --branch fwawei --rooms 202 --degrees -90 --apply

    # Multiple rooms at once, same rotation:
    python manage.py rotate_room_photos --branch fwawei --rooms 202,204,301 --degrees -90 --apply

--branch: the hotel's branch key — "fwawei" for Rayfield, "zaramaganda" for Zarmaganda.
--rooms:  comma-separated room numbers exactly as stored (e.g. "202" or "VIP 1").
--degrees: rotation amount. -90 = clockwise, 90 = counter-clockwise, 180 = upside-down fix.
           PIL's rotate() convention: positive = counter-clockwise.

SAFETY: defaults to a DRY RUN — lists every photo it would rotate and by
how much, touches nothing. Pass --apply to actually commit.

If a rotation comes out wrong (sideways the other way, or upside down),
don't run the same command again — that compounds the rotation instead
of undoing it. Work out the correction needed from how it actually
looks and run that instead (e.g. if -90 left it upside-down instead of
upright, the fix from there is 180, not another -90).
"""
from django.core.management.base import BaseCommand, CommandError
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile

from apps.hotels.models import Hotel
from apps.rooms.models import Room, RoomPhoto


class Command(BaseCommand):
    help = "Rotate the stored photo(s) for one or more rooms (fixes sideways/upside-down uploads)."

    def add_arguments(self, parser):
        parser.add_argument("--branch", required=True, help='Hotel branch key, e.g. "fwawei" or "zaramaganda".')
        parser.add_argument("--rooms", required=True, help='Comma-separated room numbers, e.g. "202,204,301".')
        parser.add_argument("--degrees", type=int, default=-90, help="Rotation amount: -90 clockwise, 90 counter-clockwise, 180 upside-down fix. Default -90.")
        parser.add_argument("--apply", action="store_true", help="Actually commit changes. Without this flag, dry-run only.")

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        degrees = options["degrees"]
        room_numbers = [r.strip() for r in options["rooms"].split(",") if r.strip()]

        try:
            hotel = Hotel.objects.get(branch=options["branch"])
        except Hotel.DoesNotExist:
            raise CommandError(f'No hotel found with branch="{options["branch"]}".')

        mode = "APPLYING CHANGES" if apply_changes else "DRY RUN — no changes will be saved"
        self.stdout.write(self.style.WARNING(f"\n=== {mode} (rotate {degrees}°) ===\n"))

        for room_number in room_numbers:
            try:
                room = Room.objects.get(hotel=hotel, room_number=room_number)
            except Room.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'  SKIP: Room "{room_number}" not found at {hotel.name}.'))
                continue

            photos = RoomPhoto.objects.filter(room=room)
            if not photos.exists():
                self.stdout.write(f'  Room {room_number}: no photos to rotate.')
                continue

            self.stdout.write(f'  Room {room_number}: rotating {photos.count()} photo(s)')
            for p in photos:
                if apply_changes:
                    img = Image.open(p.image)
                    rotated = img.rotate(degrees, expand=True)
                    buf = BytesIO()
                    rotated.save(buf, format="JPEG", quality=90)
                    filename = p.image.name.rsplit("/", 1)[-1]
                    p.image.save(filename, ContentFile(buf.getvalue()), save=True)
                self.stdout.write(f'    {"rotated" if apply_changes else "would rotate"}: {p.image.name}')

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                "\n=== DRY RUN complete — nothing was saved. Re-run with --apply to commit. ==="
            ))
        else:
            self.stdout.write(self.style.SUCCESS("\n=== Done. ==="))
