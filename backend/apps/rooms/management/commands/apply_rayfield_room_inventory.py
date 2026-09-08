"""
Rayfield room renumbering + inventory population, from the official
"Categorized Property Asset & Inventory Checklist" compiled by
Reception Desk (Maria Yakubu).

WHAT THIS DOES, IN ORDER:

1. Renumbers/recategorizes 14 existing Rayfield rooms to match the
   PDF's official numbering (101-104, 201-207, 301-303). Room FKs
   (bookings, orders, etc.) are untouched — this only changes the
   room_number and category fields on the existing Room rows, so
   booking history stays intact under the new number.
2. Deletes "SUITE 2" (the near-duplicate of "Suite 2") — skipped
   automatically with a warning if it turns out to have booking
   history that blocks deletion.
3. Creates PropertyAsset records (department=housekeeping) for every
   item listed against each new room number in the PDF. Uses
   get_or_create keyed on (hotel, room, name) so it's safe to re-run
   without creating duplicates.
4. Room 203 has no itemized list in the PDF yet ("pending physical
   verification") — gets a single placeholder asset flagging that,
   instead of invented item data.

SAFETY: defaults to a DRY RUN — prints every change it WOULD make,
touches nothing. Pass --apply to actually commit.

Usage (from backend root):
    python manage.py apply_rayfield_room_inventory            # dry run
    python manage.py apply_rayfield_room_inventory --apply    # for real

One mapping was a low-confidence guess and is flagged loudly in the
dry-run output: Room "1" (currently category "Suites") becomes Room
103 (Executive Deluxe) — this was the only way to make the category
counts balance (DB had 4 Suites/2 Executive Deluxe; PDF wants 3/3).
Worth a physical double-check before running --apply.
"""
import re
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import ProtectedError

from apps.hotels.models import Hotel
from apps.rooms.models import Room, RoomCategory
from apps.assets.models import PropertyAsset


# ── Step 1: renumber + recategorize map ──
# old_room_number -> (new_room_number, category_name_as_in_db)
RENUMBER_MAP = {
    "6":       ("201", "Standard"),
    "7":       ("202", "Standard"),
    "8":       ("203", "Standard"),
    "4":       ("204", "Classic"),
    "10":      ("206", "Classic"),
    "11":      ("207", "Classic"),
    "14":      ("303", "Classic"),
    "5":       ("104", "Class Plus"),
    "2":       ("101", "Executive Deluxe"),
    "3":       ("102", "Executive Deluxe"),
    "1":       ("103", "Executive Deluxe"),  # LOW CONFIDENCE — see note above
    "Suite 1": ("205", "Suites"),
    "Suite 2": ("301", "Suites"),
    "Suite 3": ("302", "Suites"),
}
DELETE_ROOM_NUMBERS = ["SUITE 2"]  # duplicate of "Suite 2"

HOUSEKEEPING = "housekeeping"  # PropertyAsset.HOUSEKEEPING


def parse_quantity(raw):
    """'1' -> (1, None); '1 Set' -> (1, 'Set'); '4' -> (4, None);
    'Yes' -> (1, 'Yes'); 'Standard' -> (1, 'Standard')."""
    raw = raw.strip()
    if raw.isdigit():
        return int(raw), None
    m = re.match(r"^(\d+)\s*(.*)$", raw)
    if m:
        qty = int(m.group(1))
        note = m.group(2).strip() or None
        return qty, note
    return 1, raw


FURNITURE_KEYWORDS = [
    "bed", "wardrobe", "closet", "chair", "armchair", "sofa", "table",
    "cabinet", "shelf", "dressing table", "desk",
]
LINEN_KEYWORDS = [
    "towel", "pillow", "duvet", "curtain", "bathrobe", "pjs", "slippers",
    "blanket", "tissue", "mat",
]
APPLIANCE_KEYWORDS = [
    "fridge", "television", "tv ", "tv remote", "telephone", "kettle",
    "air conditioner", "ac remote", "inverter",
]
PLUMBING_KEYWORDS = [
    "tap", "shower", "basin", "bathtub", "toilet ", "lavatory", "jacuzzi",
]
ELECTRICAL_KEYWORDS = ["socket", "switch", "wiring"]


def guess_category(item_name):
    """Best-guess PropertyAsset.category CHOICE KEY (not the display
    label) from the item name. Actual valid keys, confirmed live from
    the model: appliance, electrical, plumbing, furniture, fixture,
    linen, other. Anything not matched falls into "fixture" (bucket,
    waste bin, wall art, tiled floor, toilet brush, standalone
    mirror) — same bucket "Ceiling Fan" already uses. These are
    starting guesses, not verified — easy to correct later from the
    Admin Assets edit screen if any look wrong.
    """
    n = item_name.lower()
    if any(k in n for k in FURNITURE_KEYWORDS):
        return "furniture"
    if any(k in n for k in LINEN_KEYWORDS):
        return "linen"
    if any(k in n for k in APPLIANCE_KEYWORDS):
        return "appliance"
    if any(k in n for k in PLUMBING_KEYWORDS):
        return "plumbing"
    if any(k in n for k in ELECTRICAL_KEYWORDS):
        return "electrical"
    return "fixture"


# ── Step 3: per-new-room-number inventory, transcribed verbatim from
# the PDF. (item_name, quantity_string) — parsed via parse_quantity().
ROOM_INVENTORY = {
    "101": [
        ("Bed", "1"), ("Television (55-inch Flat Screen)", "1"), ("Mirror", "1"),
        ("Fridge (Medium)", "1"), ("Kettle & Tea Cup Set", "1 Set"), ("Jacuzzi", "1"),
        ("Table", "1"), ("Foot Mat", "1"), ("Slippers", "1 Pair"),
        ("Night Cabinet / Bedside Table", "1"), ("Inverter Air Conditioner (AC)", "1"),
        ("Chair", "1"), ("Wardrobe / Closet", "1"), ("Tiled Floor", "Yes"),
        ("Towel", "1"), ("Pillows", "4"), ("Duvet", "1"), ("Wall Art", "1"),
        ("Rubber Bucket", "1"), ("Bathrobe / PJs", "1 Set"), ("Curtain", "1 Set"),
    ],
    "102": [
        ("Bed", "1"), ("Armchair", "1"), ("Flat Screen Television", "1"),
        ("Sofa & Throw Pillows", "1 Set"), ("Mini Fridge", "1"), ("Tiled Floor", "Yes"),
        ("Foot Mat", "1"), ("Slippers", "1 Pair"), ("Air Conditioner (AC)", "1"),
        ("Jacuzzi", "1"), ("Cabinet / Shelf", "1"), ("Waste Bin", "1"),
        ("Bath Mat", "1"), ("Towel", "1"), ("Bathrobe / PJs", "1 Set"),
        ("Rubber Bucket", "1"), ("Wall Art", "1"), ("Wardrobe", "1"), ("Curtain", "1 Set"),
    ],
    "103": [
        ("Bed", "1"), ("Mirror Dressing Table", "1"),
        ("Flat-screen Television (55-inch)", "1"), ("Air Conditioner", "1"),
        ("Mini Fridge", "1"), ("Slippers", "1 Pair"), ("Foot Mat", "1"),
        ("Wall Art", "1"), ("Bathtub with Hand Shower", "1"), ("Hand Basin", "1"),
        ("Rubber Bucket", "1"), ("Wardrobe", "1"), ("Curtain", "1 Set"),
    ],
    "104": [
        ("Bed", "1"), ("Wardrobe", "1"), ("Wall Mirror", "1"),
        ("Wall Art / Framed Paintings", "1"), ("Table / Desk", "1"), ("Chair", "1"),
        ("Electric Kettle", "1"), ("Television", "1"), ("Air Conditioner", "1"),
        ("Jacuzzi Mini", "1"), ("Rubber Bucket", "1"), ("Slippers", "1 Pair"),
    ],
    "201": [
        ("Bed", "1"), ("Mirror", "1"), ("Foot Mat", "1"), ("Rubber Bucket", "1"),
        ("Hand Basin / Lavatory", "1"), ("Tissue Roll", "1"), ("Toilet Brush", "1"),
        ("Bathtub with Hand Shower", "1"), ("Wall Art", "1"), ("Slippers", "1 Pair"),
        ("Mini Fridge", "1"), ("Air Conditioner (AC)", "1"), ("Wardrobe", "1"),
        ("Toilet", "1"), ("Wall Socket", "Standard"), ("Television (55-inch)", "1"),
        ("Curtain", "1 Set"),
    ],
    "202": [
        ("Bed", "1"), ("Mirror", "1"), ("Foot Mat", "1"), ("Rubber Bucket", "1"),
        ("Hand Basin", "1"), ("Tissue Roll", "1"), ("Toilet Brush", "1"),
        ("Bathtub with Hand Shower", "1"), ("Wall Art", "1"), ("Slippers", "1 Pair"),
        ("Television (55-inch)", "1"), ("Mini Fridge", "1"), ("Air Conditioner (AC)", "1"),
        ("Wardrobe", "1"), ("Toilet", "1"), ("Wall Socket", "Standard"), ("Curtain", "1 Set"),
    ],
    "203": None,  # placeholder — pending physical verification, see below
    "204": [
        ("Television", "1"), ("Bed", "1"), ("Telephone", "1"), ("Wardrobe", "1"),
        ("Air Conditioner", "1"), ("TV Remote", "1"), ("AC Remote", "1"),
        ("Bed Foot Mat", "1"), ("Mirror Table & Chair", "1 Set"), ("Waste Bin", "1"),
        ("Mini Fridge", "1"),
    ],
    "205": [
        ("Side Bed Fridge", "1"), ("Television", "1"), ("Electric Kettle", "1"),
        ("AC Remote", "1"), ("Wardrobe", "1"), ("Bucket", "1"), ("Slippers", "1 Pair"),
        ("Toilet Brush", "1"), ("Tea Cup", "1"),
    ],
    "206": [
        ("Side Fridge", "1"), ("Bed", "1"), ("Wardrobe", "1"), ("Television", "1"),
        ("Slippers", "1 Pair"), ("Waste Bin", "1"), ("Tea Cup", "1"), ("Blanket", "1"),
        ("Telephone", "1"), ("AC Remote", "1"),
    ],
    "207": [
        ("Bucket", "1"), ("Toilet Brush", "1"), ("Telephone", "1"), ("Slippers", "1 Pair"),
        ("Tea Cup", "1"), ("Electric Kettle", "1"), ("Bed Side Fridge", "1"), ("Wardrobe", "1"),
    ],
    "301": [
        ("Bed", "1"), ("Side Mini Fridge", "1"), ("Wardrobe", "1"), ("AC Remote", "1"),
        ("Television", "1"), ("Telephone", "1"), ("Slippers", "1 Pair"), ("Tea Cup", "1"),
        ("Bucket", "1"), ("Chairs with Glass Side Mirror Table", "1 Set"),
        ("Table with Mirror", "1"), ("Rubber Bucket & Basin", "1 Set"), ("Toilet Brush", "1"),
    ],
    "302": [
        ("Side Fridge", "1"), ("Bed", "1"), ("Wardrobe", "1"), ("Full Chairs Set", "1 Set"),
        ("Television", "1"), ("AC Remote", "1"), ("Table with Mirror Set", "1"),
        ("Telephones", "1"), ("Waste Bin", "1"), ("Electric Kettle", "1"), ("Tea Cup", "1"),
    ],
    "303": [
        ("Bed", "1"), ("Table and Mirror with Chair", "1 Set"),
        ("Television (Smart TV Wall Mounted)", "1"), ("Double Chairs in Room", "2"),
        ("Slippers", "1 Pair"), ("Waste Bin", "1"), ("AC Remote", "1"), ("TV Remote", "1"),
        ("Hot Water Kettle", "1"), ("Toilet Brush", "1"), ("Wardrobe", "1"),
        ("Mini Side Bed Fridge", "1"), ("Bucket", "1"), ("Tea Cup", "1"),
    ],
}


class Command(BaseCommand):
    help = "Renumber Rayfield rooms to the official scheme and populate per-room inventory from Maria's PDF."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Actually commit changes. Without this flag, dry-run only.")

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        mode = "APPLYING CHANGES" if apply_changes else "DRY RUN — no changes will be saved"
        self.stdout.write(self.style.WARNING(f"\n=== {mode} ===\n"))

        try:
            hotel = Hotel.objects.get(branch="fwawei")
        except Hotel.DoesNotExist:
            self.stderr.write(self.style.ERROR('Hotel with branch="fwawei" (Rayfield) not found. Aborting.'))
            return

        with transaction.atomic():
            sid = transaction.savepoint()

            # ── Step 1: renumber + recategorize ──
            self.stdout.write(self.style.MIGRATE_HEADING("Step 1 — Renumber & recategorize rooms"))
            new_room_by_number = {}
            for old_number, (new_number, category_name) in RENUMBER_MAP.items():
                try:
                    room = Room.objects.get(hotel=hotel, room_number=old_number)
                except Room.DoesNotExist:
                    self.stdout.write(self.style.ERROR(f'  SKIP: Room "{old_number}" not found at Rayfield.'))
                    continue
                try:
                    category = RoomCategory.objects.get(name=category_name)
                except RoomCategory.DoesNotExist:
                    self.stdout.write(self.style.ERROR(f'  SKIP: RoomCategory "{category_name}" not found (needed for Room "{old_number}" -> {new_number}).'))
                    continue
                except RoomCategory.MultipleObjectsReturned:
                    self.stdout.write(self.style.ERROR(f'  SKIP: Multiple RoomCategory rows named "{category_name}" — ambiguous, needs manual fix.'))
                    continue

                flag = "  ⚠ LOW CONFIDENCE" if old_number == "1" else ""
                self.stdout.write(f'  Room "{old_number}" ({room.category.name if room.category_id else "no category"}) -> "{new_number}" ({category_name}){flag}')
                if apply_changes:
                    room.room_number = new_number
                    room.category = category
                    room.save(update_fields=["room_number", "category"])
                new_room_by_number[new_number] = room

            # ── Step 2: delete duplicate(s) ──
            self.stdout.write(self.style.MIGRATE_HEADING("\nStep 2 — Remove duplicate room(s)"))
            for dup_number in DELETE_ROOM_NUMBERS:
                try:
                    dup_room = Room.objects.get(hotel=hotel, room_number=dup_number)
                except Room.DoesNotExist:
                    self.stdout.write(f'  "{dup_number}" not found — nothing to remove.')
                    continue
                self.stdout.write(f'  Deleting Room "{dup_number}" (id={dup_room.id})')
                if apply_changes:
                    try:
                        dup_room.delete()
                    except ProtectedError:
                        self.stdout.write(self.style.ERROR(
                            f'  BLOCKED: Room "{dup_number}" has booking history and can\'t be deleted. '
                            f'Set it to "Out of Order" manually via Admin instead.'
                        ))

            # ── Step 3: populate inventory ──
            self.stdout.write(self.style.MIGRATE_HEADING("\nStep 3 — Populate room inventory"))
            for new_number, items in ROOM_INVENTORY.items():
                room = new_room_by_number.get(new_number)
                if room is None:
                    # Room wasn't in RENUMBER_MAP's successful set (e.g. lookup failed above) —
                    # try to find it directly in case it already had this number.
                    room = Room.objects.filter(hotel=hotel, room_number=new_number).first()
                if room is None:
                    self.stdout.write(self.style.ERROR(f'  SKIP: no Room found with number "{new_number}" — run Step 1 first or check the mapping.'))
                    continue

                if items is None:
                    # Room 203 — pending physical verification, no itemized list yet.
                    self.stdout.write(f'  Room {new_number}: placeholder only (pending physical verification)')
                    if apply_changes:
                        PropertyAsset.objects.get_or_create(
                            hotel=hotel, room=room, name="Standard Room Package (Pending Audit)",
                            defaults={
                                "department": HOUSEKEEPING, "category": "furniture", "quantity": 1,
                                "notes": "Pending physical inventory verification by Reception Desk (Maria Yakubu) — "
                                         "replace with an itemized list once the audit is complete.",
                            },
                        )
                    continue

                self.stdout.write(f'  Room {new_number}: {len(items)} items')
                for item_name, raw_qty in items:
                    qty, note = parse_quantity(raw_qty)
                    category = guess_category(item_name)
                    if apply_changes:
                        PropertyAsset.objects.get_or_create(
                            hotel=hotel, room=room, name=item_name,
                            defaults={"department": HOUSEKEEPING, "category": category, "quantity": qty, "notes": note or ""},
                        )

            if not apply_changes:
                transaction.savepoint_rollback(sid)
                self.stdout.write(self.style.WARNING(
                    "\n=== DRY RUN complete — nothing was saved. Review the output above, "
                    "then re-run with --apply to commit. ==="
                ))
            else:
                transaction.savepoint_commit(sid)
                self.stdout.write(self.style.SUCCESS("\n=== Done — all changes committed. ==="))
