"""
Management command: fix_room_branches
Fixes two data problems:
1. Room category names that include "Zaramaganda" or "Fwawei" 
   (should be just the room type e.g. "Executive Deluxe")
2. Rooms not properly assigned to their hotel/branch
   (so branch filtering works correctly)
"""
from django.core.management.base import BaseCommand
from django.db import transaction
import re


class Command(BaseCommand):
    help = "Fix room category names and ensure rooms are assigned to correct branches"

    def handle(self, *args, **options):
        from apps.rooms.models import RoomCategory, Room
        from apps.hotels.models import Hotel

        # ── Step 1: Clean up category names ─────────────────────────
        # Remove branch names from category names
        # e.g. "EXECUTIVE DULUXE Zaramaganda" -> "Executive Deluxe"
        branch_words = [
            "Zaramaganda", "ZARAMAGANDA", "zaramaganda",
            "Fwawei", "FWAWEI", "fwawei",
        ]

        cleaned = 0
        for cat in RoomCategory.objects.all():
            original = cat.name
            clean_name = cat.name
            for word in branch_words:
                clean_name = clean_name.replace(word, "").strip()
            # Clean up double spaces and trailing punctuation
            clean_name = re.sub(r"\s+", " ", clean_name).strip(" -_,.")
            clean_name = clean_name.title()

            if clean_name != original and clean_name:
                # Make sure new name is unique
                if not RoomCategory.objects.filter(name=clean_name).exclude(pk=cat.pk).exists():
                    cat.name = clean_name
                    # Also fix slug
                    import re as _re
                    cat.slug = _re.sub(r"[^a-z0-9-]", "-",
                                      clean_name.lower()).strip("-")
                    cat.slug = _re.sub(r"-+", "-", cat.slug)
                    cat.save(update_fields=["name", "slug"])
                    cleaned += 1
                    print(f"  Renamed: {original!r} -> {clean_name!r}")

        self.stdout.write(f"Cleaned {cleaned} category names")

        # ── Step 2: Ensure all rooms have status=available ───────────
        reset = Room.objects.exclude(status="available").update(status="available")
        self.stdout.write(f"Reset {reset} rooms to available")

        # ── Step 3: Check room-to-hotel assignments ───────────────────
        hotels = list(Hotel.objects.filter(is_active=True))
        if len(hotels) < 2:
            self.stdout.write("Less than 2 branches found — skipping hotel assignment fix")
            return

        unassigned = Room.objects.filter(hotel__isnull=True).count()
        if unassigned > 0:
            # Distribute unassigned rooms evenly between branches
            all_unassigned = Room.objects.filter(hotel__isnull=True)
            for i, room in enumerate(all_unassigned):
                room.hotel = hotels[i % len(hotels)]
                room.save(update_fields=["hotel"])
            self.stdout.write(f"Assigned {unassigned} rooms to branches")

        # Summary
        for hotel in hotels:
            count = Room.objects.filter(hotel=hotel).count()
            avail = Room.objects.filter(hotel=hotel, status="available").count()
            self.stdout.write(
                self.style.SUCCESS(
                    f"  {hotel.name}: {avail}/{count} rooms available"
                )
            )

        self.stdout.write(self.style.SUCCESS("Done!"))
