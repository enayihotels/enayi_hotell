"""
Seeds durable equipment for Front Desk, Kitchen, Bar, and Common
Areas/Laundry at BOTH branches — the parts of Adrian's checklist PDF
that were explicitly deferred earlier as "Property & Assets, a
different model" (gas cookers, bar fridges, POS terminals, generators,
etc.). None of this is room-tied — every line uses `location_note`
instead, same as the app already supported for common-area assets.

Run:
    python manage.py seed_department_equipment

Safe to re-run — items matched by (hotel, name), updated in place.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

# (name, category, department, location_note, quantity)
EQUIPMENT = [
    # ── Front Desk ──
    ("Reception Desk",             "furniture",  "frontdesk", "Front Desk / Reception", 1),
    ("Front Desk Computer",        "appliance",  "frontdesk", "Front Desk / Reception", 2),
    ("Receipt/POS Printer",        "appliance",  "frontdesk", "Front Desk / Reception", 1),
    ("Office Telephone System",    "electrical", "frontdesk", "Front Desk / Reception", 1),
    ("Front Desk Safe",            "furniture",  "frontdesk", "Front Desk / Reception", 1),

    # ── Kitchen ──
    ("Gas Cooker",                 "appliance",  "kitchen",   "Main Kitchen", 1),
    ("Deep Fryer",                 "appliance",  "kitchen",   "Main Kitchen", 1),
    ("Refrigerator / Freezer",     "appliance",  "kitchen",   "Main Kitchen", 2),
    ("Blender (Kitchen)",          "appliance",  "kitchen",   "Main Kitchen", 2),
    ("Extractor Fan",              "fixture",    "kitchen",   "Main Kitchen", 1),
    ("Microwave",                  "appliance",  "kitchen",   "Main Kitchen", 1),

    # ── Bar ──
    ("Bar Fridge / Chiller",       "appliance",  "bar",       "Main Bar", 1),
    ("Blender (Bar)",              "appliance",  "bar",       "Main Bar", 1),
    ("Ice Machine",                "appliance",  "bar",       "Main Bar", 1),

    # ── Common Areas / Facilities (shared — visible centrally only) ──
    ("Lobby Television",           "appliance",  "shared",    "Main Lobby", 1),
    ("Lobby AC Unit",              "appliance",  "shared",    "Main Lobby", 2),
    ("Generator",                  "appliance",  "shared",    "Generator House", 1),
    ("Water Pump",                 "appliance",  "shared",    "Utility Room", 1),
    ("Inverter / Battery Bank",    "electrical", "shared",    "Utility Room", 1),
    ("Washing Machine",            "appliance",  "shared",    "Laundry Room", 1),
    ("Dryer",                      "appliance",  "shared",    "Laundry Room", 1),
    ("Laundry Press / Iron",       "appliance",  "shared",    "Laundry Room", 1),
]


class Command(BaseCommand):
    help = "Seed Front Desk, Kitchen, Bar, and Common Area equipment at both branches."

    def handle(self, *args, **options):
        from apps.hotels.models import Hotel
        from apps.assets.models import PropertyAsset

        hotels = Hotel.objects.filter(branch__in=["fwawei", "zaramaganda"])
        if not hotels.exists():
            self.stderr.write(self.style.ERROR("Neither branch found — is the hotels app seeded?"))
            return

        created, updated = 0, 0
        with transaction.atomic():
            for hotel in hotels:
                for name, category, department, location_note, qty in EQUIPMENT:
                    asset, was_created = PropertyAsset.objects.update_or_create(
                        hotel=hotel, name=name, room=None,
                        defaults=dict(category=category, department=department,
                                      location_note=location_note, quantity=qty),
                    )
                    created += was_created
                    updated += not was_created

        self.stdout.write(self.style.SUCCESS(
            f"Done — {created} equipment line(s) created, {updated} already existed and were "
            f"updated, across both branches."
        ))
