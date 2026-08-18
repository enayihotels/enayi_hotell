"""
Seeds the consumable/Inventory-flagged items from Adrian's "Enayi
Hotels Comprehensive Inventory Planning Checklist" PDF, for every
section EXCEPT Housekeeping (needs a real architecture decision first
— see the seed_housekeeping_inventory command note / conversation)
and Restaurant/Common-Area durable equipment (those are Property &
Assets, a different model entirely — not something this command, or
the InventoryItem model, is meant to hold).

Creates 5 new categories at Fwavwei: Front Desk & Reception Supplies,
Kitchen Consumables, Bar Consumables, Laundry Supplies, Admin & Office
Supplies — each tagged with the department that makes sense given the
existing InventoryCategory.department field (bar/kitchen/shared).

DELIBERATELY LEFT OUT (durable — belongs in Property & Assets, not
here, once that model is extended to cover these areas):
  - Front Desk: Cash box/float, Safe (branch office) — valuables/
    equipment, not consumables that get "used up."
  - Kitchen: Gas cooker, Deep fryer, Refrigerator/freezer, Blender,
    Pots & pans, Knives & cutting boards, Extractor fan, Microwave
  - Bar: Cocktail shaker, Jigger, Bottle opener, Ice bucket, all
    glassware, Bar fridge/chiller
  - Restaurant: everything (plates, cutlery, trays, tablecloths,
    shakers, menu holders) — the checklist itself labels this section
    "mostly durable tableware → Property & Assets," and it lists no
    condiment/consumable items of its own to seed here.
  - Common Areas: Lobby furniture/TV/AC, corridor fixtures, generator,
    water pump, inverter, washing machine/dryer/press iron — durable.
    Laundry SUPPLIES (detergent, fabric softener) ARE included below.
  - Admin/Security: Fire extinguishers, smoke detectors, CCTV
    maintenance, torches (already have one at Front Desk), emergency
    signage — durable/fixed safety equipment.

Run:
    python manage.py seed_fwavwei_checklist_inventory

Safe to re-run — items matched by (hotel, name), updated in place.

Cost prices are placeholder estimates for testing, same as the
kitchen ingredients seed — adjust once you have real supplier costs.
"""
from django.core.management.base import BaseCommand
from django.db import transaction


# (category_key, name, unit, cost_price)
ITEMS = [
    # ── Front Desk & Reception Supplies (shared) ──
    ("frontdesk", "Registration / Check-in Forms",   "pack",  3000),
    ("frontdesk", "Receipt Booklets",                 "pack",  2500),
    ("frontdesk", "Pens",                              "pack",  1500),
    ("frontdesk", "Stapler & Staples",                 "pack",  1200),
    ("frontdesk", "Paper Clips / Binder Clips",        "pack",  800),
    ("frontdesk", "Visitor Logbook",                   "piece", 2000),
    ("frontdesk", "Guest Welcome Folders",             "pack",  4000),
    ("frontdesk", "Key Cards (Blank)",                 "pack",  6000),
    ("frontdesk", "Key Card Printer Ribbon",           "piece", 8000),
    ("frontdesk", "Luggage Tags",                      "pack",  1500),
    ("frontdesk", "POS Receipt Paper Rolls",           "roll",  500),
    ("frontdesk", "Spare Phone Chargers",              "piece", 3500),
    ("frontdesk", "Extension Cables",                  "piece", 4000),
    ("frontdesk", "Batteries (Remote, Misc.)",         "pack",  1500),
    ("frontdesk", "Cash Deposit Bags",                 "pack",  2000),
    ("frontdesk", "Torch / Flashlight (Front Desk)",   "piece", 3000),

    # ── Kitchen Consumables (kitchen) ──
    ("kitchenconsumables", "Aluminium Foil",           "roll",  3500),
    ("kitchenconsumables", "Cling Film",                "roll",  3000),
    ("kitchenconsumables", "Disposable Gloves",         "pack",  2500),
    ("kitchenconsumables", "Napkins (Kitchen)",         "pack",  1500),
    ("kitchenconsumables", "Dish Soap",                 "bottle",1200),
    ("kitchenconsumables", "Sponges / Scourers",        "pack",  1000),
    ("kitchenconsumables", "Kitchen-Grade Disinfectant","litre", 2500),
    ("kitchenconsumables", "Refuse Bags",                "pack",  1800),
    ("kitchenconsumables", "Cooking Gas (Cylinder Refill)","piece", 15000),

    # ── Bar Consumables (bar) ──
    ("barconsumables", "Straws",                        "pack",  800),
    ("barconsumables", "Cocktail Napkins",               "pack",  1200),
    ("barconsumables", "Ice",                             "bag",   500),
    ("barconsumables", "Lime",                            "kg",    2500),
    ("barconsumables", "Mint Leaves",                     "pack",  1000),
    ("barconsumables", "Cucumber (Garnish)",              "piece", 400),
    ("barconsumables", "Toothpicks / Cocktail Sticks",    "pack",  600),
    ("barconsumables", "Tonic Water / Mixers",            "bottle",1200),
    ("barconsumables", "Grenadine & Syrups",              "bottle",3500),
    ("barconsumables", "Bar Cleaning Sanitizer",          "litre", 2000),

    # ── Laundry Supplies (shared — Common Areas section) ──
    ("laundry", "Washing Detergent",                     "kg",    2500),
    ("laundry", "Fabric Softener",                        "litre", 2000),

    # ── Admin & Office Supplies (shared) ──
    ("adminoffice", "Printer Paper",                     "box",   6000),
    ("adminoffice", "Printer Ink / Toner Cartridges",     "piece", 12000),
    ("adminoffice", "Files & Folders",                    "pack",  2500),
    ("adminoffice", "Staplers & Punchers",                "piece", 3000),
    ("adminoffice", "First Aid Kit Supplies",             "pack",  8000),
]

# (category_key, category_name, department)
CATEGORIES = [
    ("frontdesk",          "Front Desk & Reception Supplies", "shared"),
    ("kitchenconsumables",  "Kitchen Consumables",             "kitchen"),
    ("barconsumables",      "Bar Consumables",                 "bar"),
    ("laundry",             "Laundry Supplies",                "shared"),
    ("adminoffice",         "Admin & Office Supplies",         "shared"),
]

REORDER_THRESHOLD = 5


class Command(BaseCommand):
    help = "Seed Front Desk, Kitchen Consumables, Bar Consumables, Laundry, and Admin/Office inventory at Fwavwei."

    def handle(self, *args, **options):
        from django.utils.text import slugify
        from apps.hotels.models import Hotel
        from apps.inventory.models import InventoryCategory, InventoryItem

        try:
            fwavwei = Hotel.objects.get(branch="fwawei")
        except Hotel.DoesNotExist:
            self.stderr.write(self.style.ERROR("Fwavwei branch not found — is the hotels app seeded?"))
            return

        cats = {}
        with transaction.atomic():
            for key, name, department in CATEGORIES:
                cat, _ = InventoryCategory.objects.update_or_create(
                    hotel=fwavwei, slug=slugify(name),
                    defaults=dict(name=name, department=department, is_active=True),
                )
                cats[key] = cat

            created, updated = 0, 0
            for key, name, unit, cost_price in ITEMS:
                item, was_created = InventoryItem.objects.update_or_create(
                    hotel=fwavwei, name=name,
                    defaults=dict(
                        category=cats[key],
                        unit=unit,
                        cost_price=cost_price,
                        reorder_threshold=REORDER_THRESHOLD,
                    ),
                )
                created += was_created
                updated += not was_created

        self.stdout.write(self.style.SUCCESS(
            f"Done — {len(CATEGORIES)} categories ensured, {created} item(s) created, "
            f"{updated} already existed and were updated. Cost prices are placeholder "
            f"estimates — adjust via Edit once you have real supplier costs."
        ))
