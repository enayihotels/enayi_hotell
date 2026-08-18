"""
Links a standard set of room equipment/furniture/linens to EVERY real
Room at BOTH branches — not a hardcoded room list, reads live from
whatever rooms actually exist via Room.objects.all(), so it picks up
new rooms too if you add them later.

Every item created here is department='housekeeping' — she's the one
who notices/reports damage during cleaning, matching the reasoning on
PropertyAsset.department itself.

Run:
    python manage.py link_room_assets_all_branches

Safe to re-run — items matched by (hotel, room, name), updated in
place rather than duplicated.

QUANTITIES are a reasonable uniform starting point across every room
(4 pillows, 2 chairs, 1 TV, etc.) — obviously a Standard room and a
Suite don't really have identical furniture in real life, but you
said you'd remove/adjust what doesn't apply, so this seeds a sane
baseline rather than guessing per room category.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

# (name, category, quantity)
ROOM_ITEMS = [
    ("Bed",                "furniture",  1),
    ("Wardrobe",           "furniture",  1),
    ("Reading Chair",      "furniture",  2),
    ("Bedside Table",      "furniture",  2),
    ("Split AC Unit",      "appliance",  1),
    ("Television",         "appliance",  1),
    ("Electric Kettle",    "appliance",  1),
    ("Ceiling Fan",        "fixture",    1),
    ("Wall Socket",        "electrical", 3),
    ("Room Safe",          "furniture",  1),
    ("Bathroom Tap",       "plumbing",   1),
    ("Shower Head",        "plumbing",   1),
    ("Toilet",             "plumbing",   1),
    ("Pillow",             "linen",      4),
    ("Duvet",              "linen",      1),
    ("Bedsheet Set",       "linen",      1),
    ("Curtain",            "linen",      2),
    ("Bath Towel",         "linen",      2),
]

DEPARTMENT = "housekeeping"


class Command(BaseCommand):
    help = "Link standard room equipment/linens to every real room at both branches."

    def handle(self, *args, **options):
        from apps.rooms.models import Room
        from apps.assets.models import PropertyAsset

        rooms = Room.objects.select_related("hotel").all()
        if not rooms.exists():
            self.stderr.write(self.style.ERROR("No rooms found at all — is the rooms app seeded?"))
            return

        no_hotel = rooms.filter(hotel__isnull=True)
        if no_hotel.exists():
            self.stdout.write(self.style.WARNING(
                f"{no_hotel.count()} room(s) have no hotel assigned — skipping those "
                f"(can't link branch-scoped assets to a room with no branch): "
                f"{list(no_hotel.values_list('room_number', flat=True))}"
            ))
            rooms = rooms.filter(hotel__isnull=False)

        created, updated = 0, 0
        with transaction.atomic():
            for room in rooms:
                for name, category, qty in ROOM_ITEMS:
                    asset, was_created = PropertyAsset.objects.update_or_create(
                        hotel=room.hotel, room=room, name=name,
                        defaults=dict(category=category, department=DEPARTMENT, quantity=qty),
                    )
                    created += was_created
                    updated += not was_created

        self.stdout.write(self.style.SUCCESS(
            f"Done — {created} asset line(s) created, {updated} already existed and were "
            f"updated, across {rooms.count()} room(s) at both branches. All default to "
            f"'Working' condition — statuses only change when someone reports a real issue."
        ))
