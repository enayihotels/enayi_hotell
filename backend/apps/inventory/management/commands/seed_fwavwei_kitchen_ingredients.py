"""
Seeds real raw-ingredient items across the 5 Kitchen-only categories
(Bakery & Frozen Foods, Dairy & Eggs, Fresh Produce, Grains/Staples/
Pantry, Meat/Poultry/Seafood) at Fwavwei, so there's actual data to
test the Kitchen Staff -> Store Keeper requisition flow against
instead of 5 empty categories.

Run:
    python manage.py seed_fwavwei_kitchen_ingredients

Safe to re-run — items are matched by (hotel, name) and updated in
place, never duplicated.

UNIT CHOICES — decided per item based on how it's actually bought/
used in a Nigerian hotel kitchen, using the unit dropdown that already
exists on the Add Item form:
  - kg    — anything sold/used by weight (meat, produce, salt, sugar)
  - bag   — dry staples bought in sacks (rice, beans, garri, flour)
  - litre — liquids bought in bulk (oil, milk)
  - piece — whole countable items (a chicken, a loaf, a yam tuber)
  - bunch — plantain, the way it's actually sold
  - pack  — small pre-packaged goods (seasoning cubes, frozen veg)
  - carton — items bought by the carton (tomato paste, pasta)

EGGS: deliberately NOT re-added here — "2 Crates of Egg" already
exists under Dairy & Eggs from earlier manual testing. Worth a quick
rename to just "Eggs" (unit already correctly set to crate) so the
quantity isn't baked into the item's name — the 2 you're currently
holding belongs in the Store stock count, not the name — but that's a
one-field edit whenever convenient, not something this script does
automatically.

COST PRICES are placeholder estimates for testing the requisition
workflow, not verified current market prices — adjust via Edit once
you have your real supplier costs. Sale price is left blank for all
of these, matching InventoryItem.sale_price's own help text ("leave
blank for items that are only consumed, like kitchen ingredients") —
these never get listed on the guest menu the way bar drinks do.
"""
from django.core.management.base import BaseCommand
from django.db import transaction


# (name, category_key, unit, cost_price)
INGREDIENTS = [
    # ── Meat, Poultry & Seafood ──
    ("Beef",                      "meat", "kg",    8000),
    ("Goat Meat",                 "meat", "kg",    9000),
    ("Chicken (Whole)",           "meat", "piece", 6500),
    ("Turkey",                    "meat", "kg",    7500),
    ("Titus Fish",                "meat", "kg",    5500),
    ("Catfish",                   "meat", "piece", 4000),
    ("Prawns",                    "meat", "kg",    9500),
    ("Snails",                    "meat", "kg",    7000),

    # ── Dairy & Eggs — eggs intentionally excluded, see docstring ──
    ("Fresh Milk",                "dairy", "litre", 1500),
    ("Cooking Butter",            "dairy", "kg",    4500),
    ("Cheese",                    "dairy", "kg",    6000),
    ("Evaporated Milk (Tin)",     "dairy", "piece", 800),

    # ── Grains, Staples & Pantry ──
    ("Rice (Local)",              "pantry", "bag",   75000),
    ("Rice (Foreign)",            "pantry", "bag",   90000),
    ("Beans",                     "pantry", "bag",   65000),
    ("Semovita",                  "pantry", "bag",   35000),
    ("Garri",                     "pantry", "bag",   30000),
    ("Vegetable Oil",             "pantry", "litre", 2200),
    ("Salt",                      "pantry", "kg",    500),
    ("Sugar",                     "pantry", "kg",    1200),
    ("Seasoning Cubes",           "pantry", "pack",  1500),
    ("Flour",                     "pantry", "bag",   40000),
    ("Tomato Paste",              "pantry", "carton",18000),
    ("Spaghetti / Pasta",         "pantry", "carton",15000),

    # ── Fresh Produce ──
    ("Tomatoes",                  "produce", "kg",    1200),
    ("Onions",                    "produce", "kg",    1000),
    ("Tatashe Pepper",            "produce", "kg",    1800),
    ("Scotch Bonnet Pepper",      "produce", "kg",    2000),
    ("Plantain",                  "produce", "bunch", 2500),
    ("Yam Tubers",                "produce", "piece", 2000),
    ("Cabbage",                   "produce", "piece", 800),
    ("Carrots",                   "produce", "kg",    1000),
    ("Cucumber",                  "produce", "piece", 400),
    ("Lettuce",                   "produce", "piece", 600),
    ("Green Beans",               "produce", "kg",    1500),

    # ── Bakery & Frozen Foods ──
    ("Bread Loaves",              "bakery", "piece", 1200),
    ("Frozen Chips (Fries)",      "bakery", "bag",   6000),
    ("Frozen Mixed Vegetables",   "bakery", "pack",  2500),
    ("Sausage Rolls (Frozen)",    "bakery", "pack",  4000),
    ("Meat Pie Pastry",           "bakery", "pack",  3500),
    ("Ice Cream (Tub)",           "bakery", "piece", 5000),
]

REORDER_THRESHOLD = 5

# Matched against your existing category names case/spacing-insensitively
# — not recreated if they already exist under different exact casing.
CATEGORY_NAME_HINTS = {
    "meat":    ["meat", "poultry", "seafood"],
    "dairy":   ["dairy", "egg"],
    "pantry":  ["grain", "staple", "pantry"],
    "produce": ["produce", "fresh"],
    "bakery":  ["bakery", "frozen"],
}


class Command(BaseCommand):
    help = "Seed real raw-ingredient items across the 5 Kitchen-only categories at Fwavwei."

    def handle(self, *args, **options):
        from apps.hotels.models import Hotel
        from apps.inventory.models import InventoryCategory, InventoryItem

        try:
            fwavwei = Hotel.objects.get(branch="fwawei")
        except Hotel.DoesNotExist:
            self.stderr.write(self.style.ERROR("Fwavwei branch not found — is the hotels app seeded?"))
            return

        categories = InventoryCategory.objects.filter(hotel=fwavwei)
        if not categories.exists():
            self.stderr.write(self.style.ERROR(
                "No inventory categories exist yet at Fwavwei. Create the 5 Kitchen categories "
                "first (or run tag_kitchen_ingredient_categories if they already exist but aren't "
                "tagged), then re-run this command."
            ))
            return

        def find_category(kind):
            hints = CATEGORY_NAME_HINTS[kind]
            for cat in categories:
                name_lower = cat.name.lower()
                if any(hint in name_lower for hint in hints):
                    return cat
            return None

        resolved = {}
        missing = []
        for kind in CATEGORY_NAME_HINTS:
            cat = find_category(kind)
            if cat:
                resolved[kind] = cat
            else:
                missing.append(kind)

        if missing:
            self.stderr.write(self.style.ERROR(
                f"Couldn't find a category for: {missing}. "
                f"Existing categories: {[c.name for c in categories]}"
            ))
            return

        self.stdout.write("Using categories: " + ", ".join(f"'{c.name}'" for c in resolved.values()))

        created, updated = 0, 0
        with transaction.atomic():
            for name, kind, unit, cost_price in INGREDIENTS:
                category = resolved[kind]
                item, was_created = InventoryItem.objects.update_or_create(
                    hotel=fwavwei, name=name,
                    defaults=dict(
                        category=category,
                        unit=unit,
                        cost_price=cost_price,
                        # sale_price left unset on purpose — these are
                        # consumed by the kitchen, never sold directly
                        # to a guest the way a bottled drink is.
                        reorder_threshold=REORDER_THRESHOLD,
                    ),
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
                # No initial Store stock set here on purpose (unlike
                # the drinks import) — these start at a real zero so
                # the first thing that happens in testing is an actual
                # Store Keeper stock delivery via Adjust Stock, which
                # is itself part of what you're testing.

        self.stdout.write(self.style.SUCCESS(
            f"Done — {created} item(s) created, {updated} already existed and were updated, "
            f"across {len(resolved)} Kitchen categories. Cost prices are placeholder estimates — "
            f"adjust via Edit once you have real supplier costs. All start at 0 Store stock; use "
            f"'Adjust Stock' as Store Keeper to bring some in before Kitchen Staff can request any."
        ))
