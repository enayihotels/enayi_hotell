"""
Copy every MenuCategory and MenuItem from one branch to another —
built specifically to give Zarmaganda the same food & bar menu Rayfield
already has, since Zarmaganda never had one set up at all (that's the
actual reason its Kitchen/Bar/Manager saw zero orders: no menu meant no
guest could ever order anything there).

Unlike the earlier room-inventory migrations (which came from photos of
a physical document Adrian sent), this reads Rayfield's menu directly
from the live database and duplicates it — nothing hand-transcribed,
so it's exactly right by construction, and safe to re-run (skips
anything that already exists at the destination by matching category/
item name, so running it twice doesn't create duplicates).

What's copied per category: name, type, icon, description, sort_order.
What's copied per item: name, description, price, image (points at the
exact same uploaded photo — no need to duplicate the file, it's the
same dish), dietary flags, allergens, calories, preparation_time,
sort_order.

What's deliberately NOT copied: MenuItem.inventory_item — that link
points at a specific InventoryItem, which is itself branch-specific
stock. Carrying it over would wire a new Zarmaganda menu item to
Rayfield's stock records, silently decrementing the wrong branch's
inventory on delivery. Copied items start unlinked; Store Keeper/Admin
can link each one to Zarmaganda's own matching stock item afterward,
the same way it'd be done for a genuinely new menu item.

SAFETY: defaults to a DRY RUN — lists every category/item it would
create, touches nothing. Pass --apply to actually commit.

Usage (from backend root):
    python manage.py copy_menu_to_branch --from fwawei --to zaramaganda
    python manage.py copy_menu_to_branch --from fwawei --to zaramaganda --apply
"""
from django.core.management.base import BaseCommand, CommandError

from apps.hotels.models import Hotel
from apps.orders.models import MenuCategory, MenuItem


class Command(BaseCommand):
    help = "Copy every menu category and item from one branch to another (skips anything already there by name)."

    def add_arguments(self, parser):
        parser.add_argument("--from", dest="from_branch", required=True, help='Source branch key, e.g. "fwawei".')
        parser.add_argument("--to", dest="to_branch", required=True, help='Destination branch key, e.g. "zaramaganda".')
        parser.add_argument("--apply", action="store_true", help="Actually commit changes. Without this flag, dry-run only.")

    def handle(self, *args, **options):
        apply_changes = options["apply"]

        try:
            source_hotel = Hotel.objects.get(branch=options["from_branch"])
        except Hotel.DoesNotExist:
            raise CommandError(f'No hotel found with branch="{options["from_branch"]}".')
        try:
            dest_hotel = Hotel.objects.get(branch=options["to_branch"])
        except Hotel.DoesNotExist:
            raise CommandError(f'No hotel found with branch="{options["to_branch"]}".')

        mode = "APPLYING CHANGES" if apply_changes else "DRY RUN — no changes will be saved"
        self.stdout.write(self.style.WARNING(f"\n=== {mode}: {source_hotel.name} -> {dest_hotel.name} ===\n"))

        source_categories = MenuCategory.objects.filter(hotel=source_hotel).order_by("sort_order", "name")
        if not source_categories.exists():
            self.stdout.write(self.style.ERROR(f"No menu categories found at {source_hotel.name} — nothing to copy."))
            return

        existing_dest_category_names = set(
            MenuCategory.objects.filter(hotel=dest_hotel).values_list("name", flat=True)
        )

        total_categories_created = 0
        total_items_created = 0
        total_items_skipped = 0

        for cat in source_categories:
            if cat.name in existing_dest_category_names:
                self.stdout.write(f'Category "{cat.name}": already exists at {dest_hotel.name} — skipping category creation, checking items only.')
                dest_cat = MenuCategory.objects.filter(hotel=dest_hotel, name=cat.name).first()
            else:
                self.stdout.write(self.style.MIGRATE_HEADING(f'Category "{cat.name}" ({cat.get_type_display()}) — creating'))
                dest_cat = None
                if apply_changes:
                    dest_cat = MenuCategory.objects.create(
                        hotel=dest_hotel, name=cat.name, type=cat.type, icon=cat.icon,
                        description=cat.description, is_active=cat.is_active, sort_order=cat.sort_order,
                    )
                total_categories_created += 1

            existing_item_names = set()
            if dest_cat:
                existing_item_names = set(MenuItem.objects.filter(hotel=dest_hotel, category=dest_cat).values_list("name", flat=True))

            items = MenuItem.objects.filter(category=cat).order_by("sort_order", "name")
            for item in items:
                if item.name in existing_item_names:
                    self.stdout.write(f'  SKIP "{item.name}" — already exists at {dest_hotel.name}.')
                    total_items_skipped += 1
                    continue

                self.stdout.write(f'  + "{item.name}" — \u20a6{item.price:,.0f}')
                total_items_created += 1
                if apply_changes and dest_cat:
                    MenuItem.objects.create(
                        hotel=dest_hotel, category=dest_cat, name=item.name, description=item.description,
                        price=item.price, image=item.image if item.image else None,
                        is_available=item.is_available, is_vegetarian=item.is_vegetarian, is_vegan=item.is_vegan,
                        is_halal=item.is_halal, is_gluten_free=item.is_gluten_free, is_spicy=item.is_spicy,
                        allergens=item.allergens, calories=item.calories, preparation_time=item.preparation_time,
                        sort_order=item.sort_order, inventory_item=None,
                    )

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"\nCategories: {total_categories_created} to create. Items: {total_items_created} to create, {total_items_skipped} already present."
        ))

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                "\n=== DRY RUN complete — nothing was saved. Review the output above, then re-run with --apply to commit. ==="
            ))
        else:
            self.stdout.write(self.style.SUCCESS("\n=== Done — all changes committed. ==="))
