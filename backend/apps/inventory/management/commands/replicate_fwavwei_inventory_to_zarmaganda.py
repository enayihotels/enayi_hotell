"""
Replicates EVERY inventory category and item that currently exists at
Fwavwei over to Zarmaganda — drinks, kitchen ingredients, and the
checklist categories (Front Desk, Kitchen/Bar Consumables, Laundry,
Admin/Office), whatever's there at the time this runs. Deliberately
reads live from Fwavwei's current data rather than a hardcoded list,
so it always mirrors whatever Fwavwei actually has, including future
additions — matching "just use all the items in Fwavwei for
Zarmaganda" exactly, not just today's specific additions.

Run this LAST, after any Fwavwei seed commands, so Zarmaganda picks
up everything:
    python manage.py seed_fwavwei_kitchen_ingredients
    python manage.py seed_fwavwei_checklist_inventory
    python manage.py replicate_fwavwei_inventory_to_zarmaganda

Safe to re-run — categories matched by (hotel, slug), items by
(hotel, name), both updated in place rather than duplicated.

WHAT THIS DOES:
- Copies every InventoryCategory (name, description, department,
  is_active) to Zarmaganda, matched by slug.
- Copies every InventoryItem (name, unit, cost_price, sale_price,
  reorder_threshold, expiry_tracked, is_active) to Zarmaganda under
  the matching replicated category.
- Creates zero-quantity StockBalance rows at Zarmaganda for every
  item at all 3 locations (Store/Bar/Kitchen) — same as what happens
  when a Store Keeper manually adds a new item — so Zarmaganda's
  Store Keeper does a real stock delivery from zero, same as Fwavwei's
  did, rather than starting with fake pre-filled stock.

WHAT THIS DELIBERATELY DOES NOT DO:
- Does NOT list any of Fwavwei's drinks/food on Zarmaganda's GUEST
  MENU (MenuCategory/MenuItem) — that's the separate "List on Guest
  Menu" step (mirrors list_fwavwei_drinks_on_menu / 
  import_fwavwei_food_menu, which only ever targeted Fwavwei). If you
  want Zarmaganda guests to see a menu too, that's a follow-up ask —
  this command only builds Zarmaganda's internal Store catalog.
- Does NOT copy StockRequisition history — that's real transaction
  history specific to each branch, not catalog data to replicate.
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Replicate every Fwavwei inventory category and item to Zarmaganda."

    def handle(self, *args, **options):
        from apps.hotels.models import Hotel
        from apps.inventory.models import InventoryCategory, InventoryItem, StockBalance

        try:
            fwavwei = Hotel.objects.get(branch="fwawei")
        except Hotel.DoesNotExist:
            self.stderr.write(self.style.ERROR("Fwavwei branch not found."))
            return
        try:
            zarmaganda = Hotel.objects.get(branch="zaramaganda")
        except Hotel.DoesNotExist:
            self.stderr.write(self.style.ERROR(
                "Zarmaganda branch not found (looked for branch='zaramaganda' — check the exact "
                "branch key on the Hotel model if this doesn't match)."
            ))
            return

        cats_created, cats_updated = 0, 0
        items_created, items_updated = 0, 0

        with transaction.atomic():
            category_map = {}  # fwavwei category id -> zarmaganda category instance
            for src_cat in InventoryCategory.objects.filter(hotel=fwavwei):
                dst_cat, was_created = InventoryCategory.objects.update_or_create(
                    hotel=zarmaganda, slug=src_cat.slug,
                    defaults=dict(
                        name=src_cat.name,
                        description=src_cat.description,
                        department=src_cat.department,
                        is_active=src_cat.is_active,
                    ),
                )
                category_map[src_cat.id] = dst_cat
                cats_created += was_created
                cats_updated += not was_created

            for src_item in InventoryItem.objects.filter(hotel=fwavwei).select_related("category"):
                dst_cat = category_map.get(src_item.category_id)
                if not dst_cat:
                    continue  # shouldn't happen — every item's category was just replicated above
                dst_item, was_created = InventoryItem.objects.update_or_create(
                    hotel=zarmaganda, name=src_item.name,
                    defaults=dict(
                        category=dst_cat,
                        unit=src_item.unit,
                        cost_price=src_item.cost_price,
                        sale_price=src_item.sale_price,
                        reorder_threshold=src_item.reorder_threshold,
                        expiry_tracked=src_item.expiry_tracked,
                        is_active=src_item.is_active,
                    ),
                )
                items_created += was_created
                items_updated += not was_created

                for loc, _ in StockBalance.LOCATION_CHOICES:
                    StockBalance.objects.get_or_create(item=dst_item, hotel=zarmaganda, location=loc)

        self.stdout.write(self.style.SUCCESS(
            f"Done — Categories: {cats_created} created, {cats_updated} updated. "
            f"Items: {items_created} created, {items_updated} updated. "
            f"All Zarmaganda items start at 0 Store stock — do a real stock delivery via "
            f"Adjust Stock as Zarmaganda's Store Keeper before Bar/Kitchen Staff there can "
            f"request anything. None of this was listed on Zarmaganda's guest menu — that's "
            f"a separate step if you want it."
        ))
