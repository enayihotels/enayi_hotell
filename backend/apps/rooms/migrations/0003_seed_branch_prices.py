"""Seed per-branch prices from each category's current prices, and attach any
existing rooms (which predate branches) to the primary branch.

This is safe to run on an empty DB too — it simply does nothing when there are
no categories/hotels yet.
"""
from django.db import migrations


def seed(apps, schema_editor):
    Hotel             = apps.get_model("hotels", "Hotel")
    RoomCategory      = apps.get_model("rooms", "RoomCategory")
    RoomCategoryPrice = apps.get_model("rooms", "RoomCategoryPrice")
    Room              = apps.get_model("rooms", "Room")

    hotels = list(Hotel.objects.all())
    if not hotels:
        return

    # Give every branch a price row for every existing category, mirroring the
    # category's current prices. Adjust the per-branch numbers afterwards.
    for cat in RoomCategory.objects.all():
        for hotel in hotels:
            RoomCategoryPrice.objects.get_or_create(
                hotel=hotel,
                category=cat,
                defaults={
                    "base_price":    cat.base_price,
                    "weekend_price": cat.weekend_price,
                    "holiday_price": cat.holiday_price,
                },
            )

    # Existing physical rooms have no branch yet — assign them to the primary.
    primary = next((h for h in hotels if h.is_primary), hotels[0])
    Room.objects.filter(hotel__isnull=True).update(hotel=primary)


def noop(apps, schema_editor):
    # Reversing only removes the generated price rows; rooms keep their branch.
    RoomCategoryPrice = apps.get_model("rooms", "RoomCategoryPrice")
    RoomCategoryPrice.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0002_branch_pricing"),
        ("hotels", "0002_seed_branches"),
    ]

    operations = [
        migrations.RunPython(seed, noop),
    ]
