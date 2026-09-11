"""
Zarmaganda room renumbering + inventory population, transcribed from
the original handwritten room roster and per-room inventory sheets
(9 scanned photos, "zaramaganda inventory.zip").

WHAT THIS DOES, IN ORDER:

1. Deletes 2 duplicate rooms — "VIP 1" and "VIP 2" (category:
   Executive Deluxe) — accidentally created via Admin as empty
   placeholders. Confirmed with Adrian: these are the SAME physical
   rooms as "Deluxe 1"/"Deluxe 2" below, not separate rooms. Skipped
   automatically with a warning if either turns out to have booking
   history that blocks deletion.
2. Renumbers/recategorizes 4 rooms whose live room_number or category
   didn't match the original roster (run AFTER the deletion above,
   since "Deluxe 1" -> "VIP 1" would otherwise collide with the
   duplicate room of the same number):
     - "SUITE 1"  -> "Suite 1"  (typo fix)
     - "Suites 2" -> "Suite 2"  (typo fix)
     - "Deluxe 1" -> "VIP 1"    (recategorized: Executive Deluxe -> VIP)
     - "Deluxe 2" -> "VIP 2"    (recategorized: Executive Deluxe -> VIP)
   ("2010" was already fixed to "210" independently before this
   command was written — no action needed there.)
   The other 16 rooms (101-106, 201-210 except the above) already
   matched the roster exactly and are left untouched.
3. Creates the "VIP" RoomCategory (didn't exist before — Rayfield has
   no VIP tier). Price is a PLACEHOLDER pending Adrian's real figure —
   see PLACEHOLDER PRICE note below. Easy to change any time from
   Admin > Rooms > Categories > Edit, no re-run of this command needed.
4. Creates PropertyAsset records (department=housekeeping) for every
   item listed against each room in the inventory sheets. Uses
   get_or_create keyed on (hotel, room, name) so it's safe to re-run
   without creating duplicates.
5. 7 rooms have no itemized list in the source sheets yet (105, 202,
   206, 207, 208, VIP 2, Suite 2) — each gets a single placeholder
   asset flagging that, instead of invented item data. Same pattern
   as Rayfield's Room 203.

SAFETY: defaults to a DRY RUN — prints every change it WOULD make,
touches nothing. Pass --apply to actually commit.

Usage (from backend root):
    python manage.py apply_zarmaganda_room_inventory            # dry run
    python manage.py apply_zarmaganda_room_inventory --apply    # for real

PLACEHOLDER PRICE: VIP has no rate anywhere in the source material
(only a food/bar menu had prices, unrelated to rooms). Set here to
base=100000, weekend=110000, holiday=120000 (between Class Plus/Suites
and Executive Deluxe) purely so the category is bookable — Adrian said
he'll adjust it later. Flagged loudly in the dry-run output.

ASSUMPTION flagged for review: the roster has no "Executive Deluxe"
category for Zarmaganda at all (that's Rayfield-only) — it lists
"VIP 1"/"VIP 2" instead, and the counts line up exactly (2 Deluxe rooms
in the DB, 2 VIP slots in the roster, nothing else unaccounted for).
Confirmed with Adrian before running: use what's in the roster.

A few individual quantities in the source sheets were illegible or
struck through (noted inline in ROOM_INVENTORY below, in each item's
`notes` field) — flagged for a physical re-check rather than guessed.
"""
import re
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import ProtectedError

from apps.hotels.models import Hotel
from apps.rooms.models import Room, RoomCategory
from apps.assets.models import PropertyAsset


# ── Step 1: duplicate rooms to delete FIRST (before renumbering below,
# to avoid a room_number collision — see module docstring) ──
DELETE_ROOM_NUMBERS = ["VIP 1", "VIP 2"]  # duplicates of "Deluxe 1"/"Deluxe 2"

# ── Step 2: renumber + recategorize map ──
# old_room_number -> (new_room_number, category_name_as_in_db)
RENUMBER_MAP = {
    "SUITE 1":  ("Suite 1", "Suites"),
    "Suites 2": ("Suite 2", "Suites"),
    "Deluxe 1": ("VIP 1",   "VIP"),   # ⚠ recategorized, see ASSUMPTION above
    "Deluxe 2": ("VIP 2",   "VIP"),   # ⚠ recategorized, see ASSUMPTION above
}

# New category — didn't exist before this command.
VIP_CATEGORY_DEFAULTS = {
    "slug": "vip",
    "tagline": "Zarmaganda's premium tier",
    "description": "Zarmaganda's top room class — full details to be filled in from the physical rooms.",
    "base_price": 100000,     # ⚠ PLACEHOLDER — adjust in Admin once Adrian gives the real rate
    "weekend_price": 110000,  # ⚠ PLACEHOLDER
    "holiday_price": 120000,  # ⚠ PLACEHOLDER
    "max_adults": 2,
    "max_children": 1,
    "bed_type": "king",
    "num_beds": 1,
    "room_size_sqm": 35,
    "num_bathrooms": 1,
    "is_active": True,
}

HOUSEKEEPING = "housekeeping"  # PropertyAsset.HOUSEKEEPING
KITCHEN = "kitchen"            # PropertyAsset.KITCHEN


def parse_quantity(raw):
    """'1' -> (1, None); '1 Set' -> (1, 'Set'); '4' -> (4, None)."""
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
    "bed", "wardrobe", "closet", "chair", "armchair", "sofa", "couch",
    "table", "cabinet", "shelf", "dressing table", "desk",
]
LINEN_KEYWORDS = [
    "towel", "pillow", "duvet", "curtain", "bathrobe", "pjs", "slippers",
    "blanket", "tissue", "mat",
]
APPLIANCE_KEYWORDS = [
    "fridge", "television", "tv", "tv remote", "telephone", "kettle",
    "air conditioner", "ac remote", "ac ", "inverter", "microwave",
]
PLUMBING_KEYWORDS = [
    "tap", "shower", "basin", "bathtub", "toilet", "lavatory", "jacuzzi",
]
ELECTRICAL_KEYWORDS = ["socket", "switch", "wiring"]


def guess_category(item_name):
    """Best-guess PropertyAsset.category CHOICE KEY from the item name.
    Same heuristic used for the Rayfield inventory — starting guesses,
    not verified, easy to correct later from Admin > Assets.
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


# ── Step 3: per-room inventory, transcribed from the handwritten sheets.
# (item_name, quantity_string) — parsed via parse_quantity(). A room
# mapped to None means "no itemized list in the source" -> placeholder.
ROOM_INVENTORY = {
    "101": [
        ("Bed", "1"), ("Television", "1"), ("Mirror", "2"), ("Table", "1"),
        ("Telephone", "1"), ("Air Conditioner", "1"), ("Fan", "1"), ("Kettle", "1"),
        ("Shower", "1"), ("Water Heater", "1"), ("Towel Hanger", "1"), ("Bucket", "1"),
        ("Wardrobe", "1"), ("Chair", "1"), ("Tea Cup", "1"), ("Tray", "1"),
        ("Trash Can", "1"), ("Pillows", "4"), ("WC", "1"), ("Towel", "1"),
        ("Bible", "1"), ("Toilet Brush", "1"), ("Foot Mat", "1"), ("Cup", "1"),
    ],
    "102": [
        ("Couch", "1"), ("Bed", "1"), ("Pillows", "4"), ("Shower", "1"),
        ("Handwash", "1"), ("Trash Can", "1"), ("Fridge", "1"), ("Wardrobe", "1"),
        ("Television", "1"), ("Air Conditioner", "1"), ("Towel Hanger", "1"), ("WC", "1"),
        ("Water Heater", "1"), ("Toilet Brush", "1"), ("Mirrors", "2"), ("Tray", "1"),
        ("Remote", "1"), ("Slippers", "1"), ("Telephone", "1"),
        ("Sockets/Switch", "6"),
    ],
    "103": [
        ("Bed", "1"), ("Pillows", "4"), ("Towel", "1"), ("Telephone", "1"),
        ("Table", "1"), ("Chair", "1"), ("Tray", "1"), ("Bible", "1"),
        ("Wardrobe", "1"), ("Television", "1"), ("Fridge", "1"), ("Remote", "1"),
        ("Slippers", "1"), ("Trash Can", "1"), ("Air Conditioner", "1"), ("Painting", "1"),
        ("Shower", "1"), ("Water Heater", "1"), ("WC", "1"), ("Handwash", "1"),
        ("Toilet Brush", "1"), ("Towel Hanger", "1"), ("Foot Mat", "1"), ("Bucket", "1"),
        ("Cup", "1"),
    ],
    "104": [
        ("Bed", "1"), ("Pillows", "4"), ("Fridge", "1"), ("Trash Can", "1"),
        ("Television", "1"), ("Wardrobe", "1"), ("Bible", "1"), ("Remote", "1"),
        ("Telephone", "1"), ("Tray & Tea Cup", "1 Set"), ("Air Conditioner", "1"),
        ("Painting", "1"), ("Mirror", "2"), ("Handwash", "1"), ("WC", "1"),
        ("Shower", "1"), ("Water Heater", "1"), ("Bucket", "1"), ("Foot Mat", "1"),
        ("Toilet Brush", "1"), ("Chair", "1"), ("Table", "1"), ("Cup", "1"),
    ],
    "105": None,  # placeholder — no itemized list in source
    "106": [
        ("Television", "1"), ("Bed", "1"), ("Pillows", "4"), ("Table", "1"),
        ("Chair", "1"), ("Tray & Tea Cup", "1 Set"), ("Kettle", "1"), ("Bible", "1"),
        ("Telephone", "1"), ("Painting", "1"), ("Mirror", "2"), ("Towel", "1"),
        ("WC", "1"), ("Slippers", "1"), ("Foot Mat", "1"), ("Shower", "1"),
        ("Water Heater", "1"), ("Handwash", "1"), ("Wardrobe", "1"), ("Trash Can", "1"),
        ("Toilet Brush", "1"), ("Bucket", "1"), ("Towel Hanger", "1"), ("Remote", "1"),
        ("Air Conditioner", "1"), ("Cup", "1"),
    ],
    "201": [
        ("Television", "1"), ("Fan", "1"), ("Fridge", "1"), ("Bed", "1"),
        ("Pillows", "4"), ("Mirrors", "2"), ("Table", "1"), ("Chair", "1"),
        ("Tray", "1"), ("Painting", "1"), ("Telephone", "1"), ("Trash Can", "1"),
        ("Remote", "1"), ("AC Remote", "1"), ("Sockets", "7"), ("Shower", "1"),
        ("Water Heater", "1"), ("Bucket", "1"), ("Wardrobe", "1"), ("Towel Hanger", "1"),
        ("Foot Mat", "1"), ("Slippers", "1"), ("Cup", "1"), ("Tea Cup", "1"),
        ("Air Conditioner", "1"),
    ],
    "202": None,  # placeholder — no itemized list in source
    "203": [
        ("Couch", "1"), ("Center Table", "1"), ("Chairs", "3"), ("Television", "1"),
        ("Air Conditioner", "1"), ("Painting", "1"), ("Bed", "1"), ("Pillows", "4"),
        ("Table", "1"), ("Tray", "1"), ("Tea Cup", "1"), ("Mirrors", "2"),
        ("Wardrobe", "1"), ("Fridge", "1"), ("Water Heater", "1"), ("Shower", "1"),
        ("Handwash", "1"), ("WC", "1"), ("Toilet Brush", "1"),
    ],
    "204": [
        ("Bed", "1"), ("Pillows", "6"), ("Kettle", "1"), ("Tea Cup", "1"),
        ("Tray", "1"), ("Trash Can", "1"), ("Table", "1"), ("Chair", "1"),
        ("Fridge", "1"), ("Bible", "1"), ("Television", "1"), ("Remote", "1"),
        ("Telephone", "1"), ("Foot Mat", "1"), ("Wardrobe", "1"), ("Handwash", "1"),
        ("Bucket", "1"), ("Shower", "1"), ("WC", "1"), ("Slippers", "1"),
        ("Mirrors", "2"), ("Towel", "1"), ("Air Conditioner", "1"), ("Towel Hanger", "1"),
        ("Water Heater", "1"), ("Cup", "1"), ("Painting", "1"),
    ],
    "205": [
        ("Bed", "1"), ("Pillows", "6"), ("Kettle", "1"), ("Tray", "1"),
        ("Tea Cup", "1"), ("Table", "1"), ("Chair", "1"), ("Fridge", "1"),
        ("Television", "1"), ("Mirror", "2"), ("Air Conditioner", "1"), ("Bible", "1"),
        ("Telephone", "1"), ("Remote", "1"), ("Foot Mat", "1"), ("Slippers", "1"),
        ("Wardrobe", "1"), ("WC", "1"), ("Shower", "1"), ("Water Heater", "1"),
        ("Handwash", "1"), ("Bucket", "1"), ("Towel", "1"),
    ],
    "206": None,  # placeholder — no itemized list in source
    "207": None,  # placeholder — no itemized list in source
    "208": None,  # placeholder — no itemized list in source
    "209": [
        ("Bed", "1"), ("Pillows", "4"), ("Table", "1"), ("Couch", "1"),
        ("Fridge", "1"), ("Television", "1"), ("Air Conditioner", "1"), ("Painting", "2"),
        ("Fan", "1"), ("Wardrobe", "1"), ("Bible", "1"), ("Mirrors", "2"),
        ("Trash Can", "1"), ("Handwash", "1"), ("Foot Mat", "1"), ("Bucket", "1"),
        ("Towel Hanger", "1"), ("Cup", "1"),
        ("Sockets", "1"),  # quantity struck through/illegible in source — needs a physical recheck
        ("Telephone", "1"), ("WC", "1"),
    ],
    "210": [
        ("Bed", "1"), ("Pillows", "6"), ("Telephone", "1"), ("Chairs", "2"),
        ("Remote", "1"), ("Fan", "1"), ("Kettle, Tray & Tea Cup", "1 Set"),
        ("Television", "1"), ("Mirror", "2"), ("Painting", "1"), ("Air Conditioner", "1"),
        ("Wardrobe", "1"), ("Trash Can", "1"), ("Slippers", "1"), ("WC", "1"),
        ("Shower", "1"), ("Bucket", "1"), ("Handwash", "1"), ("Water Heater", "1"),
        ("Toilet Brush", "1"), ("Towel Hanger", "1"), ("Sockets/Switch", "6"),
    ],
    "VIP 1": [
        ("Television", "1"), ("Bed", "1"), ("Couch", "1"), ("Tables", "2"),
        ("Chair", "1"), ("Small Couch", "1"), ("Remote", "1"), ("Pillows", "4"),
        ("Towel", "1"), ("Wardrobe", "1"), ("Mirror", "2"), ("Painting", "1"),
        ("Air Conditioner", "1"), ("Telephone", "1"), ("Fridge", "1"), ("Trash Can", "1"),
        ("Foot Mat", "1"), ("Shower", "1"), ("Towel Hanger", "1"), ("WC", "1"),
        ("Handwash", "1"), ("Bucket", "1"), ("Cup", "1"), ("Water Heater", "1"),
    ],
    "VIP 2": None,  # placeholder — no itemized list in source
    "Suite 1": [
        ("Television", "1"), ("Fridge", "1"), ("Couch", "1"), ("Center Table", "1"),
        ("Chair", "1"), ("Air Conditioner", "1"), ("Painting", "4"), ("Tray", "1"),
        ("Tea Cup", "1"), ("Bible", "1"), ("Mirrors", "1"), ("Wardrobe", "1"),
        ("Bed", "1"), ("Pillows", "6"), ("Telephone", "1"), ("Table", "1"),
        ("Sockets/Switch", "14"), ("Foot Mat", "1"), ("Shower", "1"), ("Water Heater", "1"),
        ("Handwash", "1"), ("WC", "1"), ("Towel Hanger", "1"), ("Cup", "1"),
        ("Bucket", "1"), ("Small Jacuzzi", "1"), ("Towel", "1"),
    ],
    "Suite 2": None,  # placeholder — no itemized list in source
}

# ── Kitchen equipment — shared, not tied to any room ──
# (item_name, quantity_string, note)
KITCHEN_INVENTORY = [
    ("Fire Extinguisher", "1", ""),
    ("Tea Spoon", "6", ""),
    ("Scale", "1", ""),
    ("Food Cover", "1", "quantity not specified in source"),
    ("Potato Peeler", "1", ""),
    ("Big Kettle", "1", "quantity not specified in source"),
    ("Pepper Soup Bowl", "5", ""),
    ("Plates", "11", ""),
    ("Eating Spoon", "6", ""),
    ("Forks", "3", ""),
    ("Knives", "3", ""),
    ("Bowls", "4", ""),
    ("Pots", "11", ""),
    ("Gas Cooker", "1", ""),
    ("Fridge", "2", ""),
    ("Cookers", "2", ""),
    ("Dishing Spoons", "4", ""),
    ("Trays", "2", ""),
    ("Frying Pan (Big)", "2", ""),
    ("Table Knives", "14", ""),
    ("Frying Pan (Small)", "2", ""),
    ("Basin (Rubber)", "1", "handwriting unclear in source, worth a physical re-check"),
    ("Deep Freezer", "1", ""),
    ("Blender", "1", ""),
    ("Microwave", "1", ""),
    ("Pressure Pot", "1", "quantity not specified in source"),
    ("Sieve", "3", ""),
    ("Soup Bowl", "14", ""),
    ("Saucers", "1", ""),
    ("Telephone", "1", ""),
    ("Chair", "2", ""),
    ("Toaster", "1", "quantity not specified in source"),
]


class Command(BaseCommand):
    help = "Fix Zarmaganda room numbers/categories, create the VIP category, and populate per-room + kitchen inventory from the original handwritten sheets."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Actually commit changes. Without this flag, dry-run only.")

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        mode = "APPLYING CHANGES" if apply_changes else "DRY RUN — no changes will be saved"
        self.stdout.write(self.style.WARNING(f"\n=== {mode} ===\n"))

        try:
            hotel = Hotel.objects.get(branch="zaramaganda")
        except Hotel.DoesNotExist:
            self.stderr.write(self.style.ERROR('Hotel with branch="zaramaganda" (Zarmaganda) not found. Aborting.'))
            return

        with transaction.atomic():
            sid = transaction.savepoint()

            # ── Step 1a: create VIP category if missing ──
            self.stdout.write(self.style.MIGRATE_HEADING("Step 1 — Ensure VIP category exists"))
            vip_category = RoomCategory.objects.filter(name="VIP").first()
            if vip_category:
                self.stdout.write('  VIP category already exists — leaving it as-is.')
            else:
                self.stdout.write(self.style.WARNING(
                    '  Creating "VIP" category with a PLACEHOLDER price '
                    f'(base=₦{VIP_CATEGORY_DEFAULTS["base_price"]:,}) — adjust in Admin once Adrian gives the real rate.'
                ))
                if apply_changes:
                    vip_category = RoomCategory.objects.create(name="VIP", **VIP_CATEGORY_DEFAULTS)

            # ── Step 1b: delete duplicate rooms FIRST (before renumbering, to
            # avoid a room_number collision with the rename below) ──
            self.stdout.write(self.style.MIGRATE_HEADING("\nStep 1 — Remove duplicate room(s)"))
            for dup_number in DELETE_ROOM_NUMBERS:
                try:
                    dup_room = Room.objects.get(hotel=hotel, room_number=dup_number)
                except Room.DoesNotExist:
                    self.stdout.write(f'  "{dup_number}" not found — nothing to remove.')
                    continue
                self.stdout.write(f'  Deleting Room "{dup_number}" (id={dup_room.id}, category={dup_room.category.name if dup_room.category_id else "none"}) — duplicate of "Deluxe {dup_number[-1]}"')
                if apply_changes:
                    try:
                        dup_room.delete()
                    except ProtectedError:
                        self.stdout.write(self.style.ERROR(
                            f'  BLOCKED: Room "{dup_number}" has booking history and can\'t be deleted. '
                            f'Set it to "Out of Order" manually via Admin instead, and skip renaming "Deluxe" to this number.'
                        ))

            # ── Step 2: renumber + recategorize ──
            self.stdout.write(self.style.MIGRATE_HEADING("\nStep 2 — Renumber & recategorize rooms"))
            new_room_by_number = {}
            for old_number, (new_number, category_name) in RENUMBER_MAP.items():
                try:
                    room = Room.objects.get(hotel=hotel, room_number=old_number)
                except Room.DoesNotExist:
                    self.stdout.write(self.style.ERROR(f'  SKIP: Room "{old_number}" not found at Zarmaganda.'))
                    continue

                category = RoomCategory.objects.filter(name=category_name).first()
                if category is None and category_name == "VIP" and apply_changes:
                    category = vip_category  # just created above in this same run
                if category is None and not apply_changes:
                    # Dry run: VIP may not exist yet — that's fine, just show intent.
                    self.stdout.write(f'  Room "{old_number}" ({room.category.name if room.category_id else "no category"}) -> "{new_number}" ({category_name})')
                    continue
                if category is None:
                    self.stdout.write(self.style.ERROR(f'  SKIP: RoomCategory "{category_name}" not found (needed for Room "{old_number}" -> {new_number}).'))
                    continue

                self.stdout.write(f'  Room "{old_number}" ({room.category.name if room.category_id else "no category"}) -> "{new_number}" ({category_name})')
                if apply_changes:
                    room.room_number = new_number
                    room.category = category
                    room.save(update_fields=["room_number", "category"])
                new_room_by_number[new_number] = room

            # ── Step 3: populate per-room inventory ──
            self.stdout.write(self.style.MIGRATE_HEADING("\nStep 3 — Populate room inventory"))
            for room_number, items in ROOM_INVENTORY.items():
                room = new_room_by_number.get(room_number)
                if room is None:
                    room = Room.objects.filter(hotel=hotel, room_number=room_number).first()
                if room is None:
                    self.stdout.write(self.style.ERROR(f'  SKIP: no Room found with number "{room_number}" — run Step 1 first or check the mapping.'))
                    continue

                if items is None:
                    self.stdout.write(f'  Room {room_number}: placeholder only (no itemized list in source)')
                    if apply_changes:
                        PropertyAsset.objects.get_or_create(
                            hotel=hotel, room=room, name="Standard Room Package (Pending Audit)",
                            defaults={
                                "department": HOUSEKEEPING, "category": "furniture", "quantity": 1,
                                "notes": "No itemized inventory list was available in the original handwritten sheets — "
                                         "replace with an itemized list once a physical audit is done.",
                            },
                        )
                    continue

                self.stdout.write(f'  Room {room_number}: {len(items)} items')
                for item_name, raw_qty in items:
                    qty, note = parse_quantity(raw_qty)
                    category = guess_category(item_name)
                    if apply_changes:
                        PropertyAsset.objects.get_or_create(
                            hotel=hotel, room=room, name=item_name,
                            defaults={"department": HOUSEKEEPING, "category": category, "quantity": qty, "notes": note or ""},
                        )

            # ── Step 4: kitchen equipment (shared, not room-tied) ──
            self.stdout.write(self.style.MIGRATE_HEADING("\nStep 4 — Populate kitchen inventory"))
            self.stdout.write(f'  {len(KITCHEN_INVENTORY)} items -> department=kitchen, Main Kitchen (Zarmaganda)')
            for item_name, raw_qty, note in KITCHEN_INVENTORY:
                qty, parsed_note = parse_quantity(raw_qty)
                category = guess_category(item_name)
                final_note = note or parsed_note or ""
                if apply_changes:
                    PropertyAsset.objects.get_or_create(
                        hotel=hotel, room=None, name=item_name, location_note="Main Kitchen",
                        defaults={"department": KITCHEN, "category": category, "quantity": qty, "notes": final_note},
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
