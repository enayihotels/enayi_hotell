"""
Tags the kitchen-ingredient categories that already exist in the
Fwavwei catalog (Bakery & Frozen Foods, Dairy & Eggs, Fresh Produce,
Grains/Staples/Pantry, Meat/Poultry/Seafood) as department='kitchen',
so Kitchen Staff can see them and Bar Staff can't — the same way the
two drink categories were already tagged department='bar' by the
0008 migration's data backfill.

"Guest Toiletries & Amenities" is deliberately left at 'shared' — it's
general hotel supply, not kitchen-specific, so both departments (or
whichever role ends up handling it) should still see it.

Run:
    python manage.py tag_kitchen_ingredient_categories

Safe to re-run — only sets department where it isn't already 'kitchen';
doesn't touch categories not in the list below, and doesn't touch
'Guest Toiletries & Amenities' at all.
"""
from django.core.management.base import BaseCommand


KITCHEN_CATEGORY_NAMES = [
    "Bakery & Frozen Foods",
    "Dairy & Eggs",
    "Fresh Produce",
    "Grains, Staples & Pantry",
    "Meat, Poultry & Seafood",
]


class Command(BaseCommand):
    help = "Tag the existing raw-ingredient categories as Kitchen-only."

    def handle(self, *args, **options):
        from apps.hotels.models import Hotel
        from apps.inventory.models import InventoryCategory

        try:
            fwavwei = Hotel.objects.get(branch="fwawei")
        except Hotel.DoesNotExist:
            self.stderr.write(self.style.ERROR("Fwavwei hotel not found — nothing to do."))
            return

        tagged = 0
        skipped = []
        for name in KITCHEN_CATEGORY_NAMES:
            cat = InventoryCategory.objects.filter(hotel=fwavwei, name=name).first()
            if not cat:
                skipped.append(name)
                continue
            if cat.department != InventoryCategory.KITCHEN:
                cat.department = InventoryCategory.KITCHEN
                cat.save(update_fields=["department"])
                tagged += 1

        self.stdout.write(self.style.SUCCESS(
            f"Done — {tagged} categor{'y' if tagged == 1 else 'ies'} tagged as Kitchen only."
        ))
        if skipped:
            self.stdout.write(self.style.WARNING(
                f"Not found (skipped, no action taken): {', '.join(skipped)}"
            ))
