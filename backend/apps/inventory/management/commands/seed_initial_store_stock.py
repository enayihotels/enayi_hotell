"""
Gives every item at BOTH branches a real starting Store stock quantity
(instead of the 0 they currently sit at), so Adrian can test
Bar/Kitchen/Housekeeping requisitions end-to-end without first
clicking through Adjust Stock by hand for 124 items x 2 branches.

Run:
    python manage.py seed_initial_store_stock

Safe to re-run — only tops up items that are STILL at zero Store
stock; never overwrites or reduces a quantity that's already been
manually adjusted, so running this again after real testing has begun
won't clobber real data.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

INITIAL_STORE_STOCK = 20


class Command(BaseCommand):
    help = "Seed a real starting Store stock quantity for every item at both branches (only where still zero)."

    def handle(self, *args, **options):
        from apps.hotels.models import Hotel
        from apps.inventory.models import InventoryItem, StockBalance

        hotels = Hotel.objects.filter(branch__in=["fwawei", "zaramaganda"])
        if not hotels.exists():
            self.stderr.write(self.style.ERROR("Neither branch found — is the hotels app seeded?"))
            return

        topped_up, skipped = 0, 0
        with transaction.atomic():
            for hotel in hotels:
                for item in InventoryItem.objects.filter(hotel=hotel):
                    balance, _ = StockBalance.objects.get_or_create(
                        item=item, hotel=hotel, location=StockBalance.STORE
                    )
                    if balance.quantity == 0:
                        balance.quantity = INITIAL_STORE_STOCK
                        balance.save()
                        topped_up += 1
                    else:
                        skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f"Done — {topped_up} item(s) topped up to {INITIAL_STORE_STOCK} Store stock, "
            f"{skipped} left untouched (already had real stock). Bar/Kitchen/Housekeeping "
            f"staff can now submit real requisitions against actual Store stock at both branches."
        ))
