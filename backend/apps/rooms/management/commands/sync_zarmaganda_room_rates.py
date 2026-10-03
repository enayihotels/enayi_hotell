"""
Sets Zarmaganda's per-branch room prices (RoomCategoryPrice) from the
rate sheet in "Enayi_Hotels_Zarmaganda_and_Rayfield_Branches.docx".

Per Adrian: the sheet's "Executive Deluxe" is the same tier as the
existing "VIP" category, and "Ex Suites" is just the existing "Suite"/
"Suites" category — not new categories to create.

Checking this sheet against what's actually live turned up only ONE
real change: five of the six rates already match exactly what's set
today. The only gap is VIP, which has never had a Zarmaganda-specific
price set at all (RoomCategoryPrice has no row for it yet, so it was
silently falling back to the category's unbranded default). This
command still sets all six explicitly rather than special-casing just
VIP, so it doubles as a reusable "apply this rate sheet" tool rather
than a one-off patch — re-running it after the first apply is a safe
no-op for the five that already match.

Every row uses a single flat number for base/weekend/holiday pricing,
matching the existing convention at BOTH branches today (neither one
currently differentiates weekend or holiday pricing — every existing
row already has all three fields equal). breakfast_price is the flat
₦2,500 per-night surcharge the sheet implies (the gap between its
"without" and "with breakfast" columns is exactly 2,500 for every
row) — this also already matches all five existing rows, so only the
new VIP row actually needs it set.

SAFETY: defaults to a DRY RUN — prints exactly what it would set for
each category, touches nothing. Pass --apply to actually commit.

Usage (from backend root):
    python manage.py sync_zarmaganda_room_rates            # dry run
    python manage.py sync_zarmaganda_room_rates --apply     # for real
"""
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError

from apps.hotels.models import Hotel
from apps.rooms.models import RoomCategory, RoomCategoryPrice

# (rate-sheet name, actual RoomCategory name, base price, breakfast surcharge)
RATES = [
    ("Single",            "Single",           Decimal("25000"), Decimal("2500")),
    ("Standard",          "Standard",         Decimal("30000"), Decimal("2500")),
    ("Classic",           "Classic",          Decimal("35000"), Decimal("2500")),
    ("Classic Plus",      "Class Plus",       Decimal("40000"), Decimal("2500")),
    ("Executive Deluxe",  "VIP",              Decimal("45000"), Decimal("2500")),
    ("Ex Suites",         "Suites",           Decimal("55000"), Decimal("2500")),
]


class Command(BaseCommand):
    help = "Set Zarmaganda's room rates from the uploaded rate sheet (maps Executive Deluxe->VIP, Ex Suites->Suites)."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Actually commit changes. Without this flag, dry-run only.")

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        mode = "APPLYING CHANGES" if apply_changes else "DRY RUN — no changes will be saved"
        self.stdout.write(self.style.WARNING(f"\n=== {mode}: Zarmaganda room rates ===\n"))

        try:
            hotel = Hotel.objects.get(branch="zaramaganda")
        except Hotel.DoesNotExist:
            raise CommandError('Hotel with branch="zaramaganda" (Zarmaganda) not found. Aborting.')

        for sheet_name, category_name, base_price, breakfast_price in RATES:
            try:
                category = RoomCategory.objects.get(name=category_name)
            except RoomCategory.DoesNotExist:
                self.stdout.write(self.style.ERROR(
                    f'  SKIP "{sheet_name}" -> category "{category_name}" not found at all — check the name against Admin \u2192 Rooms \u2192 Categories.'
                ))
                continue

            existing = RoomCategoryPrice.objects.filter(hotel=hotel, category=category).first()
            label = f'{sheet_name} ("{category_name}")' if sheet_name != category_name else sheet_name

            if existing is None:
                self.stdout.write(f'  + {label}: no price set yet \u2192 creating at \u20a6{base_price:,.0f} (+\u20a6{breakfast_price:,.0f} breakfast)')
            elif existing.base_price == base_price and existing.weekend_price == base_price and \
                    existing.holiday_price == base_price and existing.breakfast_price == breakfast_price:
                self.stdout.write(f'  = {label}: already \u20a6{base_price:,.0f} (+\u20a6{breakfast_price:,.0f} breakfast) \u2014 no change')
            else:
                self.stdout.write(
                    f'  ~ {label}: \u20a6{existing.base_price:,.0f} (+\u20a6{existing.breakfast_price:,.0f}) '
                    f'\u2192 \u20a6{base_price:,.0f} (+\u20a6{breakfast_price:,.0f})'
                )

            if apply_changes:
                RoomCategoryPrice.objects.update_or_create(
                    hotel=hotel, category=category,
                    defaults={
                        "base_price": base_price,
                        "weekend_price": base_price,
                        "holiday_price": base_price,
                        "breakfast_price": breakfast_price,
                        "is_active": True,
                    },
                )

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                "\n=== DRY RUN complete — nothing was saved. Review the output above, then re-run with --apply to commit. ==="
            ))
        else:
            self.stdout.write(self.style.SUCCESS("\n=== Done — all changes committed. ==="))
