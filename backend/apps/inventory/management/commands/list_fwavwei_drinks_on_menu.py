"""
Closes the exact gap that caused "guests weren't seeing the drinks":
the earlier import added all 37 drinks to Inventory (stock tracking),
but never actually put any of them on the guest-facing menu — that's
a separate step ("List on Guest Menu") that has to happen per item,
and it never ran for these.

This does that step in bulk, once, for every Fwavwei inventory item
that doesn't already have a menu listing.

Run:
    python manage.py list_fwavwei_drinks_on_menu

Safe to re-run — only items with no existing menu listing get one
created; already-listed items are left alone.
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "List every un-listed Fwavwei inventory item onto the guest menu."

    def handle(self, *args, **options):
        from apps.hotels.models import Hotel
        from apps.inventory.models import InventoryItem
        from apps.orders.models import MenuCategory, MenuItem

        try:
            fwavwei = Hotel.objects.get(branch="fwawei")
        except Hotel.DoesNotExist:
            self.stderr.write(self.style.ERROR("Fwavwei branch not found."))
            return

        # Mirror the inventory category split onto two guest-facing menu
        # categories — simple and functional; rename/reorganize later
        # from the app if you want a different guest-facing grouping.
        beer_menu_cat, _ = MenuCategory.objects.get_or_create(
            hotel=fwavwei, name="Beers, Spirits & Wines", defaults={"type": "drink", "sort_order": 10})
        soft_menu_cat, _ = MenuCategory.objects.get_or_create(
            hotel=fwavwei, name="Soft Drinks & Mixers", defaults={"type": "drink", "sort_order": 11})

        items = InventoryItem.objects.filter(hotel=fwavwei).exclude(menu_items__isnull=False)
        if not items.exists():
            self.stdout.write("Nothing to do — every Fwavwei inventory item is already listed on the menu.")
            return

        listed = 0
        with transaction.atomic():
            for item in items:
                is_beer_category = "beer" in item.category.name.lower() or "spirit" in item.category.name.lower()
                menu_cat = beer_menu_cat if is_beer_category else soft_menu_cat
                if item.sale_price is None:
                    self.stdout.write(self.style.WARNING(f"Skipped '{item.name}' — no selling price set."))
                    continue
                MenuItem.objects.create(
                    hotel=fwavwei, category=menu_cat, name=item.name,
                    description=item.name, price=item.sale_price,
                    inventory_item=item, is_available=True,
                )
                listed += 1

        self.stdout.write(self.style.SUCCESS(f"Done — {listed} item(s) now listed on the guest menu."))
