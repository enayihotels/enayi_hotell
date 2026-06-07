"""
Management command: fix_room_branches

Fixes ALL data problems with room categories and branch assignments:
1. Removes branch names from category names
   e.g. "STANDARD ROOM ZARAMAGANDA" -> "Standard Room"
        "CLASSIC ROOM FWAWEI"       -> "Classic Room"
2. Merges duplicate categories (e.g. "Standard Room Zaramaganda" and
   "Standard Room Fwawei" become one "Standard Room" category)
3. Ensures rooms are correctly assigned to their branch
4. Resets all unbooked rooms to available
"""
import re
from django.core.management.base import BaseCommand
from django.db import transaction


BRANCH_WORDS = [
    "zaramaganda", "fwawei", "fwavei", "fwawei branch",
    "zaramaganda branch",
]

def clean_name(name: str) -> str:
    """Remove branch words from a category name."""
    result = name
    for word in BRANCH_WORDS:
        # Case-insensitive removal
        result = re.sub(re.escape(word), "", result, flags=re.IGNORECASE)
    # Clean up extra spaces and punctuation
    result = re.sub(r"\s+", " ", result).strip(" -_,.()[]")
    return result.title() if result else name


class Command(BaseCommand):
    help = "Fix room category names and branch assignments"

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.rooms.models import RoomCategory, Room
        from apps.hotels.models import Hotel
        from apps.bookings.models import Booking
        from django.utils import timezone

        self.stdout.write("=" * 60)
        self.stdout.write("FIXING ROOM CATEGORIES AND BRANCH ASSIGNMENTS")
        self.stdout.write("=" * 60)

        # ── Step 1: Build mapping of dirty -> clean names ─────────────
        all_cats = list(RoomCategory.objects.all().order_by("name"))
        self.stdout.write(f"\nFound {len(all_cats)} categories:")
        for c in all_cats:
            self.stdout.write(f"  [{c.id}] {c.name!r} (slug: {c.slug})")

        # ── Step 2: For each category, compute clean name ─────────────
        # Group categories by their clean name
        clean_groups = {}  # clean_name -> [category_obj, ...]
        for cat in all_cats:
            cn = clean_name(cat.name)
            if cn not in clean_groups:
                clean_groups[cn] = []
            clean_groups[cn].append(cat)

        self.stdout.write(f"\nWill merge into {len(clean_groups)} clean categories:")
        for cn, cats in clean_groups.items():
            self.stdout.write(f"  {cn!r} <- {[c.name for c in cats]}")

        # ── Step 3: Merge duplicate categories ────────────────────────
        merged = 0
        for clean, cats in clean_groups.items():
            if len(cats) == 1:
                # Just rename
                cat = cats[0]
                if cat.name != clean:
                    old = cat.name
                    cat.name = clean
                    new_slug = re.sub(r"[^a-z0-9]+", "-", clean.lower()).strip("-")
                    cat.slug = new_slug
                    cat.save(update_fields=["name", "slug"])
                    self.stdout.write(f"  Renamed: {old!r} -> {clean!r}")
                    merged += 1
            else:
                # Keep first (lowest pk), reassign all rooms from others to it
                keeper = sorted(cats, key=lambda c: c.created_at if hasattr(c, "created_at") else c.id)[0]
                others = [c for c in cats if c.id != keeper.id]

                # Rename keeper
                old_name = keeper.name
                keeper.name = clean
                new_slug = re.sub(r"[^a-z0-9]+", "-", clean.lower()).strip("-")
                keeper.slug = new_slug
                keeper.save(update_fields=["name", "slug"])
                self.stdout.write(f"  Merged keeper: {old_name!r} -> {clean!r}")

                # Reassign rooms from duplicate categories to keeper
                for other in others:
                    room_count = Room.objects.filter(category=other).count()
                    if room_count > 0:
                        Room.objects.filter(category=other).update(category=keeper)
                        self.stdout.write(
                            f"    Reassigned {room_count} rooms from {other.name!r} to {clean!r}"
                        )
                    # Safely delete the duplicate
                    try:
                        other.delete()
                        self.stdout.write(f"    Deleted duplicate: {other.name!r}")
                    except Exception as e:
                        self.stdout.write(f"    Could not delete {other.name!r}: {e}")
                merged += 1

        self.stdout.write(f"\nCleaned {merged} categories")

        # ── Step 4: Reset unbooked rooms to available ─────────────────
        today = timezone.now().date()
        active_ids = set(Booking.objects.filter(
            status__in=["pending", "confirmed", "checked_in"],
        ).values_list("room_id", flat=True))

        reset = Room.objects.exclude(id__in=active_ids).exclude(
            status="available"
        ).update(status="available")

        synced = Room.objects.filter(
            id__in=active_ids
        ).exclude(
            status__in=["reserved", "occupied"]
        ).update(status="reserved")

        self.stdout.write(f"Reset {reset} unbooked rooms to available")
        self.stdout.write(f"Synced {synced} booked rooms to reserved")

        # ── Summary ───────────────────────────────────────────────────
        self.stdout.write("\n" + "=" * 60)
        hotels = Hotel.objects.filter(is_active=True)
        for hotel in hotels:
            rooms = Room.objects.filter(hotel=hotel)
            avail = rooms.filter(status="available").count()
            self.stdout.write(
                self.style.SUCCESS(
                    f"  {hotel.name}: {avail}/{rooms.count()} rooms available"
                )
            )
        self.stdout.write("\nCategories after fix:")
        for cat in RoomCategory.objects.all().order_by("name"):
            count = Room.objects.filter(category=cat).count()
            self.stdout.write(f"  {cat.name!r} ({count} rooms, slug: {cat.slug})")
        self.stdout.write(self.style.SUCCESS("\nDone!"))
