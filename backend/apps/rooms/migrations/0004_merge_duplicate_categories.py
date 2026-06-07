"""
Data migration: merge duplicate room categories and reset rooms.
Runs automatically when backend deploys via: python manage.py migrate
"""
from django.db import migrations
import re


BRANCH_WORDS = ["zaramaganda", "fwawei", "fwavei"]


def clean_name(name):
    result = name
    for word in BRANCH_WORDS:
        result = re.sub(word, "", result, flags=re.IGNORECASE)
    result = re.sub(r"\s+", " ", result).strip(" -_,.()")
    return result.title() if result.strip() else name


def merge_categories(apps, schema_editor):
    RoomCategory = apps.get_model("rooms", "RoomCategory")
    Room = apps.get_model("rooms", "Room")
    Booking = apps.get_model("bookings", "Booking")
    from django.utils import timezone

    all_cats = list(RoomCategory.objects.all().order_by("id"))

    # Group by clean name
    groups = {}
    for cat in all_cats:
        key = clean_name(cat.name).lower()
        if key not in groups:
            groups[key] = []
        groups[key].append(cat)

    for clean_key, cats in groups.items():
        clean = clean_name(cats[0].name)
        new_slug = re.sub(r"[^a-z0-9]+", "-", clean.lower()).strip("-")

        if len(cats) == 1:
            # Just rename if needed
            cat = cats[0]
            if cat.name != clean or cat.slug != new_slug:
                cat.name = clean
                cat.slug = new_slug
                cat.save()
        else:
            # Keep first, reassign rooms from others
            keeper = cats[0]
            keeper.name = clean
            keeper.slug = new_slug
            keeper.save()

            for other in cats[1:]:
                Room.objects.filter(category=other).update(category=keeper)
                try:
                    other.delete()
                except Exception:
                    pass

    # Reset all unbooked rooms to available
    active_ids = set(
        Booking.objects.filter(
            status__in=["pending", "confirmed", "checked_in"]
        ).values_list("room_id", flat=True)
    )
    Room.objects.exclude(id__in=active_ids).update(status="available")
    Room.objects.filter(id__in=active_ids).exclude(
        status__in=["reserved", "occupied"]
    ).update(status="reserved")


def reverse_merge(apps, schema_editor):
    pass  # irreversible


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0003_seed_branch_prices"),
    ]

    operations = [
        migrations.RunPython(merge_categories, reverse_merge),
    ]
