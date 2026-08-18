"""
One-off bulk import: the Enayi Hotels In-Room & Dining food menu (73
items), directly onto Fwavwei's guest menu.

Run once:
    python manage.py import_fwavwei_food_menu

Safe to re-run — items are matched by (hotel, name) and updated in
place, never duplicated.

WHY THESE AREN'T INVENTORY ITEMS: unlike bottled drinks, a cooked dish
doesn't have a simple per-unit cost or a countable stock level the way
"we have 40 bottles of Coke" does — so food goes straight onto the
guest menu as MenuItem records with no linked InventoryItem and no
cost price field at all (there's nothing to remove — MenuItem never
had one). Availability is controlled directly by Kitchen Staff via the
is_available toggle instead of a stock count hitting zero.

Categories mirror the source menu's own six sections. Preparation
times are realistic, guest-friendly estimates — kept deliberately on
the shorter side (nothing over 35 minutes) so a guest ordering isn't
discouraged by a long wait shown up front; adjust any of these directly
in the app afterward if a dish genuinely takes longer in practice.
"""
from django.core.management.base import BaseCommand
from django.db import transaction


# (name, price, prep_minutes)
BREAKFAST = [
    ("Tea & Bread", 2500, 10),
    ("Coffee & Bread", 2500, 10),
    ("Oat & Bread", 3500, 12),
    ("Omelette", 1000, 12),
    ("Egg Sauce", 1500, 15),
    ("Boiled Yam & Egg Sauce", 3500, 20),
    ("Noodles & Omelette", 3500, 15),
    ("Chips & Omelette", 4500, 20),
    ("Acha Pudding", 3500, 20),
    ("Sweet Potatoes & Egg Sauce", 4500, 20),
    ("Yam Porridge", 3500, 25),
    ("Irish Porridge", 4000, 25),
    ("Toast Bread", 2000, 10),
]

RICE_SPECIALTIES = [
    ("White Rice & Stew (Only)", 3000, 15),
    ("White Rice, Stew & Beef", 5000, 20),
    ("White Rice, Stew & Goat Meat", 5000, 20),
    ("White Rice, Stew & Chicken", 6000, 20),
    ("Jollof Rice & Beans (Only)", 3000, 15),
    ("Jollof Rice, Beans & Beef", 5500, 20),
    ("Jollof Rice, Beans & Goat Meat", 5500, 20),
    ("Jollof Rice, Beans & Chicken", 6500, 20),
    ("Fried Rice & Beef", 6000, 20),
    ("Fried Rice & Goat Meat", 6000, 20),
    ("Fried Rice & Chicken", 7000, 20),
    ("Coconut Rice & Beef", 6000, 22),
    ("Coconut Rice & Goat Meat", 6000, 22),
    ("Coconut Rice & Chicken", 7000, 22),
    ("Curry Fried Rice & Beef", 5500, 22),
    ("Curry Fried Rice & Goat Meat", 5500, 22),
    ("English Fried Rice & Beef", 6000, 22),
    ("English Fried Rice & Goat Meat", 6000, 22),
    ("English Fried Rice & Chicken", 7000, 22),
    ("Chinese Fried Rice & Goat Meat", 8000, 25),
    ("Chinese Fried Rice & Chicken", 9000, 25),
]

SWALLOW_SOUPS = [
    ("Semo with Draw Soup & Goat Meat", 5000, 20),
    ("Semo with Egusi & Goat Meat", 5000, 20),
    ("Semo with Egusi & Beef", 5000, 20),
    ("Wheat with Egusi & Beef", 5000, 20),
    ("Wheat with Draw Soup & Goat Meat", 5000, 20),
    ("Wheat with Draw Soup & Chicken", 6000, 20),
    ("Poundo with White Soup & Beef", 5500, 22),
    ("Poundo with Bitter Leaf & Goat Meat", 5500, 22),
    ("Poundo with White Soup & Chicken", 7500, 22),
    ("Garri with Vegetable Soup & Beef", 5000, 20),
    ("Garri with Afang Soup & Goat Meat", 5500, 20),
    ("Garri with Afang Soup & Chicken", 6500, 20),
    ("Acha with Draw Soup & Goat Meat", 6000, 22),
    ("Acha with Vegetable Soup & Beef", 6000, 22),
    ("Acha with Egusi & Goat Meat", 6000, 22),
]

PASTA_BEANS = [
    ("Beans Porridge", 2000, 20),
    ("Beans Porridge & Yam", 3500, 22),
    ("Beans Porridge & Plantain", 3500, 22),
    ("Spaghetti with Goat Meat or Beef", 5000, 20),
]

SIGNATURE = [
    ("Okoho Soup with Any Swallow", 5000, 25),
    ("Okoho Soup with Beef", 6000, 28),
    ("Okoho Soup with Chicken", 8000, 28),
    ("Okoho Soup with Bush Meat", 10000, 30),
    ("Isiewu (Full Pot)", 8000, 30),
    ("Isiewu (Half Pot)", 4000, 25),
    ("Nkwobi (Full Pot)", 8000, 30),
    ("Nkwobi (Half Pot)", 4000, 25),
]

SIDES_SOUPS_PROTEINS = [
    ("Afang Soup", 1500, 12),
    ("Bitter Leaf Soup", 1500, 12),
    ("Egusi Soup", 1500, 12),
    ("Draw Soup", 1500, 12),
    ("Vegetable Soup", 1500, 12),
    ("Coleslaw", 1000, 8),
    ("Salad", 2000, 10),
    ("Beef", 3000, 15),
    ("Goat Meat", 3000, 15),
    ("Chicken", 4000, 18),
    ("Catfish", 5000, 20),
    ("Bush Meat", 5000, 20),
]

# (menu category name, type, sort_order, items, description)
CATEGORIES = [
    ("Breakfast", "breakfast", 1, BREAKFAST,
     "Start the day right"),
    ("Rice Specialties", "food", 2, RICE_SPECIALTIES,
     "Jollof, fried, coconut & more, your way"),
    ("Swallow & Traditional Soups", "food", 3, SWALLOW_SOUPS,
     "Semo, wheat, poundo, garri & acha with rich local soups"),
    ("Pasta, Beans & Portages", "food", 4, PASTA_BEANS,
     "Hearty, comforting classics"),
    ("Enayi's Signature & Local Delicacies", "food", 5, SIGNATURE,
     "House specialties you won't find everywhere"),
    ("Sides, Soups & Proteins", "food", 6, SIDES_SOUPS_PROTEINS,
     "Build your own plate — soups, sides & proteins by portion"),
]


class Command(BaseCommand):
    help = "Import the full Fwavwei food menu (73 items across 6 categories) directly onto the guest menu."

    def handle(self, *args, **options):
        from apps.hotels.models import Hotel
        from apps.orders.models import MenuCategory, MenuItem

        try:
            fwavwei = Hotel.objects.get(branch="fwawei")
        except Hotel.DoesNotExist:
            self.stderr.write(self.style.ERROR("Fwavwei branch not found."))
            return

        created, updated = 0, 0
        with transaction.atomic():
            for cat_name, cat_type, sort_order, items, cat_description in CATEGORIES:
                category, _ = MenuCategory.objects.update_or_create(
                    hotel=fwavwei, name=cat_name,
                    defaults={"type": cat_type, "sort_order": sort_order, "description": cat_description},
                )
                for i, (name, price, prep_minutes) in enumerate(items):
                    item, was_created = MenuItem.objects.update_or_create(
                        hotel=fwavwei, name=name,
                        defaults=dict(
                            category=category,
                            description=name,
                            price=price,
                            preparation_time=prep_minutes,
                            is_available=True,
                            sort_order=i,
                        ),
                    )
                    if was_created:
                        created += 1
                    else:
                        updated += 1

        self.stdout.write(self.style.SUCCESS(
            f"Done — {created} food item(s) created, {updated} already existed and were updated, "
            f"across {len(CATEGORIES)} categories."
        ))
        self.stdout.write(
            "Photos can be added per item from the Inventory/Menu screen in the app — "
            "none are set yet from this import."
        )
