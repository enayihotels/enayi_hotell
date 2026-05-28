"""Seed the two Enayi branches: Zaramaganda and Fwawei.

Fwawei is marked primary (the featured/default branch on the public site),
but both are active and both appear on the front page.
"""
from django.db import migrations


BRANCHES = [
    {
        "branch": "fwawei",
        "name": "Enayi Hotels & Suites — Fwawei",
        "slug": "fwawei",
        "tagline": "Modern luxury at our flagship Fwawei branch",
        "city": "Jos",
        "state": "Plateau State",
        "is_active": True,
        "is_primary": True,
        "sort_order": 0,
    },
    {
        "branch": "zaramaganda",
        "name": "Enayi Hotels & Suites — Zaramaganda",
        "slug": "zaramaganda",
        "tagline": "Serene comfort in the heart of Zaramaganda",
        "city": "Jos",
        "state": "Plateau State",
        "is_active": True,
        "is_primary": False,
        "sort_order": 1,
    },
]


def seed(apps, schema_editor):
    Hotel = apps.get_model("hotels", "Hotel")
    for data in BRANCHES:
        Hotel.objects.update_or_create(branch=data["branch"], defaults=data)


def unseed(apps, schema_editor):
    Hotel = apps.get_model("hotels", "Hotel")
    Hotel.objects.filter(branch__in=[b["branch"] for b in BRANCHES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("hotels", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
