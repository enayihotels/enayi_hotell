"""
One-off bulk import: the 37-item Enayi Hotels bar drinks price list,
into Fwavwei's inventory, under the Store Keeper's existing categories.

Run once:
    python manage.py import_fwavwei_bar_drinks

Safe to re-run — items are matched by (hotel, name) and updated in
place rather than duplicated if you run it again after fixing a typo
in this file.

WHAT THIS DOES, exactly as instructed:
- Every item goes under either "Soft Drinks & Mixers" or "Beer &
  Spirit/Wines" (matched to your existing categories at Fwavwei by
  name — case/spacing insensitive — not recreated).
- Beer/Spirit/Wine items: unit = Bottle, as instructed.
- Soft drink items: unit = Bottle, Can, or Plastic, chosen per item
  based on how it's typically actually sold (see the CATEGORY
  assignment below) — "Plastic" was added as a new unit option since
  it didn't exist yet.
- Selling price set from the price list. Cost price deliberately left
  at 0/blank, exactly as instructed — fill that in later.
- Reorder threshold set to 5 for every item, and Store stock at
  Fwavwei is set to 5 to start.

ONE THING WORTH DOUBLE-CHECKING: the source price list is just a flat
alphabetical list with no categories in it, so I categorized each item
myself from general knowledge of what it actually is (e.g. Heineken =
beer, Fanta = soft drink). A couple of borderline ones I want to flag
directly rather than quietly guess on:
  - "Elixir" — genuinely unclear from the name alone; placed under
    Soft Drinks & Mixers (as a mixer) rather than Beer & Spirits.
  - "Malt" — placed under Soft Drinks & Mixers as Can (non-alcoholic
    malt drink, e.g. Maltina/Malta Guinness), not a beer.
  - "Yoghurt" — placed under Soft Drinks & Mixers as Plastic.
If any of these should be different, they're a normal Edit away in
the Inventory screen — nothing here is locked in.
"""
from django.core.management.base import BaseCommand
from django.db import transaction


# (name, category, unit, sale_price)
DRINKS = [
    # ── Beer & Spirit/Wines — unit: bottle, per instruction ──
    ("4th Street Wine",          "beer",  "bottle", 15000),
    ("Black Jameson",            "beer",  "bottle", 85000),
    ("Black Label",              "beer",  "bottle", 50000),
    ("British Street Wine",      "beer",  "bottle", 15000),
    ("Budweiser",                "beer",  "bottle", 2000),
    ("Campari",                  "beer",  "bottle", 38000),
    ("Castle Lite",              "beer",  "bottle", 2000),
    ("Desperados",                "beer",  "bottle", 2000),
    ("Double Black",             "beer",  "bottle", 2000),
    ("Flying Fish",              "beer",  "bottle", 2000),
    ("Four Cousins Wine",        "beer",  "bottle", 15000),
    ("Goldberg",                 "beer",  "bottle", 2000),
    ("Guinness Smooth",          "beer",  "bottle", 2000),
    ("Guinness Stout",           "beer",  "bottle", 2000),
    ("Heineken",                 "beer",  "bottle", 2000),
    ("Hero",                     "beer",  "bottle", 2000),
    ("Legend Extra Stout",       "beer",  "bottle", 2000),
    ("Life Continental Lager",   "beer",  "bottle", 2000),
    ("Orijin Beer",              "beer",  "bottle", 2000),
    ("Orijin Bitters (Bottle)",  "beer",  "bottle", 10000),
    ("Orijin Bitters (Small)",   "beer",  "bottle", 2000),
    ("Singleton",                "beer",  "bottle", 85000),
    ("Tiger Beer",               "beer",  "bottle", 2000),
    ("Trophy Beer",              "beer",  "bottle", 2000),
    ("Trophy Smooth",            "beer",  "bottle", 2000),

    # ── Soft Drinks & Mixers — unit: bottle / can / plastic per item ──
    ("Coke",                     "soft",  "bottle", 1000),
    ("Elixir",                   "soft",  "bottle", 2000),
    ("Exotic Juice",             "soft",  "bottle", 3000),
    ("Fanta",                    "soft",  "bottle", 1000),
    ("Fearless Energy Drink",    "soft",  "can",    1000),
    ("Malt",                     "soft",  "can",    1000),
    ("Monster Energy Drink",     "soft",  "can",    2000),
    ("Predator Energy Drink",    "soft",  "can",    1000),
    ("Schweppes",                "soft",  "bottle", 1000),
    ("Sprite",                   "soft",  "bottle", 1000),
    ("Water (Bottle)",           "soft",  "bottle", 500),
    ("Yoghurt",                  "soft",  "plastic",3000),
]

REORDER_THRESHOLD = 5
INITIAL_STORE_STOCK = 5

# Matched against your existing category names case/spacing-insensitively
# — not recreated if they already exist under different exact casing.
CATEGORY_NAME_HINTS = {
    "beer": ["beer & spirit", "beer&spirit", "beer and spirit", "spirit", "wine"],
    "soft": ["soft drink", "soft drinks", "mixer"],
}


class Command(BaseCommand):
    help = "Import the 37-item Fwavwei bar drinks price list into an existing Store Keeper's categories."

    def handle(self, *args, **options):
        from apps.hotels.models import Hotel
        from apps.accounts.models import User
        from apps.inventory.models import InventoryCategory, InventoryItem, StockBalance

        try:
            fwavwei = Hotel.objects.get(branch="fwawei")
        except Hotel.DoesNotExist:
            self.stderr.write(self.style.ERROR("Fwavwei branch not found — is the hotels app seeded?"))
            return

        categories = InventoryCategory.objects.filter(hotel=fwavwei)
        if not categories.exists():
            self.stderr.write(self.style.ERROR(
                "No inventory categories exist yet at Fwavwei. Log in as the Store Keeper and create "
                "'Soft Drinks & Mixers' and 'Beer & Spirit/Wines' first, then re-run this command."
            ))
            return

        def find_category(kind):
            hints = CATEGORY_NAME_HINTS[kind]
            for cat in categories:
                name_lower = cat.name.lower()
                if any(hint in name_lower for hint in hints):
                    return cat
            return None

        beer_cat = find_category("beer")
        soft_cat = find_category("soft")

        if not beer_cat:
            self.stderr.write(self.style.ERROR(
                "Couldn't find a 'Beer & Spirit/Wines'-like category at Fwavwei. "
                f"Existing categories: {[c.name for c in categories]}"
            ))
            return
        if not soft_cat:
            self.stderr.write(self.style.ERROR(
                "Couldn't find a 'Soft Drinks & Mixers'-like category at Fwavwei. "
                f"Existing categories: {[c.name for c in categories]}"
            ))
            return

        self.stdout.write(f"Using categories: '{beer_cat.name}' and '{soft_cat.name}' at {fwavwei.name}")

        created, updated = 0, 0
        with transaction.atomic():
            for name, kind, unit, price in DRINKS:
                category = beer_cat if kind == "beer" else soft_cat
                item, was_created = InventoryItem.objects.update_or_create(
                    hotel=fwavwei, name=name,
                    defaults=dict(
                        category=category,
                        unit=unit,
                        sale_price=price,
                        reorder_threshold=REORDER_THRESHOLD,
                    ),
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

                for loc, _ in StockBalance.LOCATION_CHOICES:
                    balance, _ = StockBalance.objects.get_or_create(item=item, hotel=fwavwei, location=loc)
                    if loc == StockBalance.STORE and balance.quantity == 0:
                        balance.quantity = INITIAL_STORE_STOCK
                        balance.save()

        self.stdout.write(self.style.SUCCESS(
            f"Done — {created} item(s) created, {updated} already existed and were updated. "
            f"Store stock set to {INITIAL_STORE_STOCK} for any that started at zero."
        ))
