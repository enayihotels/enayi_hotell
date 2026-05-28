"""Seed the real per-branch room prices for Enayi Hotels & Suites.

Source: HOTEL_BRANCHES_AND_PRICES.docx

    Zaramaganda  (room-only price | +breakfast surcharge per night = 2,500)
        Single             25,000
        Standard           30,000
        Classic            35,000
        Class Plus         40,000
        Executive Deluxe   45,000
        Suites             55,000

    Fwawei  (single price column; Single NOT offered; breakfast surcharge 0)
        Standard           40,000
        Classic            45,000
        Class Plus         75,000
        Suites             80,000
        Executive Deluxe  150,000

Run it any time prices change:

    python manage.py seed_branch_prices
    python manage.py seed_branch_prices --no-create-missing   # only price existing categories

It is idempotent: it updates rows in place, never duplicates, and deactivates
the price row for a class a branch does not offer (e.g. Single @ Fwawei).
"""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from apps.hotels.models import Hotel
from apps.rooms.models import RoomCategory, RoomCategoryPrice


# Canonical room classes, in display order.
ROOM_TYPES = [
    ("single",           "Single"),
    ("standard",         "Standard"),
    ("classic",          "Classic"),
    ("class-plus",       "Class Plus"),
    ("executive-deluxe", "Executive Deluxe"),
    ("suites",           "Suites"),
]

# Name variants seen in the wild, mapped to the canonical slug above.
ALIASES = {
    "single": ["single room"],
    "standard": ["standard room"],
    "classic": ["classic room"],
    "class-plus": ["class plus", "classplus", "classic plus", "class+"],
    "executive-deluxe": ["executive duluxe", "executive deluxe", "exec deluxe", "deluxe", "executive"],
    "suites": ["suite", "suites room", "suite room"],
}

# (room_only_price, breakfast_surcharge_per_night). A class absent from a
# branch's dict is simply not offered there.
BRANCH_PRICES = {
    "zaramaganda": {
        "single":           (25000, 2500),
        "standard":         (30000, 2500),
        "classic":          (35000, 2500),
        "class-plus":       (40000, 2500),
        "executive-deluxe": (45000, 2500),
        "suites":           (55000, 2500),
    },
    "fwawei": {
        "standard":         (40000, 0),
        "classic":          (45000, 0),
        "class-plus":       (75000, 0),
        "suites":           (80000, 0),
        "executive-deluxe": (150000, 0),
        # Single intentionally omitted — not offered at Fwawei.
    },
}


class Command(BaseCommand):
    help = "Load the per-branch room prices for Zaramaganda and Fwawei."

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-create-missing",
            action="store_true",
            help="Do not create RoomCategory rows that don't already exist; only price existing ones.",
        )

    def _match_category(self, slug, display, create_missing):
        """Find the RoomCategory for a canonical slug, by slug then by name."""
        cat = RoomCategory.objects.filter(slug=slug).first()
        if cat:
            return cat, False
        candidates = [display.lower()] + ALIASES.get(slug, [])
        for cat in RoomCategory.objects.all():
            if cat.name.strip().lower() in candidates or cat.slug == slug:
                return cat, False
        if not create_missing:
            return None, False
        # Create with a sensible default base price (Zaramaganda room-only,
        # else Fwawei). Branch prices override this per branch anyway.
        zar = BRANCH_PRICES["zaramaganda"].get(slug)
        fwa = BRANCH_PRICES["fwawei"].get(slug)
        default_price = Decimal(str((zar or fwa)[0]))
        sort = next((i for i, (s, _) in enumerate(ROOM_TYPES) if s == slug), 0)
        cat = RoomCategory.objects.create(
            name=display,
            slug=slug,
            description=f"{display} room at Enayi Hotels & Suites.",
            base_price=default_price,
            weekend_price=default_price,
            holiday_price=default_price,
            sort_order=sort,
        )
        return cat, True

    @transaction.atomic
    def handle(self, *args, **opts):
        create_missing = not opts["no_create_missing"]

        hotels = {h.branch: h for h in Hotel.objects.all()}
        for needed in BRANCH_PRICES:
            if needed not in hotels:
                self.stdout.write(self.style.WARNING(
                    f"Branch '{needed}' not found — run `migrate` first (it seeds the branches)."
                ))
        if not hotels:
            return

        # Resolve each canonical class to a category once.
        resolved = {}
        for slug, display in ROOM_TYPES:
            cat, created = self._match_category(slug, display, create_missing)
            resolved[slug] = cat
            if cat is None:
                self.stdout.write(self.style.WARNING(f"  · no category for '{display}' (skipped)"))
            elif created:
                self.stdout.write(self.style.SUCCESS(f"  + created category '{cat.name}'"))

        for branch, prices in BRANCH_PRICES.items():
            hotel = hotels.get(branch)
            if not hotel:
                continue
            self.stdout.write(self.style.MIGRATE_HEADING(f"\n{hotel.name}"))

            offered_cat_ids = set()
            for slug, (room_only, breakfast) in prices.items():
                cat = resolved.get(slug)
                if cat is None:
                    continue
                offered_cat_ids.add(cat.id)
                amount = Decimal(str(room_only))
                RoomCategoryPrice.objects.update_or_create(
                    hotel=hotel, category=cat,
                    defaults={
                        "base_price": amount,
                        "weekend_price": amount,
                        "holiday_price": amount,
                        "breakfast_price": Decimal(str(breakfast)),
                        "is_active": True,
                    },
                )
                with_bf = f" (+{breakfast:,} breakfast)" if breakfast else ""
                self.stdout.write(f"  ₦{room_only:>7,}  {cat.name}{with_bf}")

            # Deactivate price rows for classes this branch does NOT offer
            # (e.g. Single @ Fwawei), so they stop showing for that branch.
            stale = RoomCategoryPrice.objects.filter(hotel=hotel, is_active=True).exclude(category_id__in=offered_cat_ids)
            for row in stale:
                row.is_active = False
                row.save(update_fields=["is_active"])
                self.stdout.write(self.style.WARNING(f"  – {row.category.name}: not offered here, deactivated"))

        self.stdout.write(self.style.SUCCESS("\nDone. Per-branch prices loaded."))
