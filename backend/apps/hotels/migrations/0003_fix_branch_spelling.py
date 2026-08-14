"""Correct the spelling of both branch names.

"Fwawei" -> "Fwavwei" and "Zaramaganda" -> "Zarmaganda". This only
touches the human-readable `name` and `tagline` fields — the internal
`branch` choice value and `slug` (e.g. "fwawei") are deliberately left
unchanged, since those are used as stable identifiers throughout the
app (URL query params, filtering logic, room/branch matching) and
renaming them would risk breaking existing links and data relationships
for a purely cosmetic spelling fix. Only what guests and staff actually
*read* needed correcting.
"""
from django.db import migrations

CORRECTIONS = [
    {
        "branch": "fwawei",
        "name": "Enayi Hotels & Suites — Fwavwei",
        "tagline": "Modern luxury at our flagship Fwavwei branch",
    },
    {
        "branch": "zaramaganda",
        "name": "Enayi Hotels & Suites — Zarmaganda",
        "tagline": "Serene comfort in the heart of Zarmaganda",
    },
]


def fix_spelling(apps, schema_editor):
    Hotel = apps.get_model("hotels", "Hotel")
    for data in CORRECTIONS:
        Hotel.objects.filter(branch=data["branch"]).update(
            name=data["name"], tagline=data["tagline"],
        )


def revert_spelling(apps, schema_editor):
    Hotel = apps.get_model("hotels", "Hotel")
    Hotel.objects.filter(branch="fwawei").update(
        name="Enayi Hotels & Suites — Fwawei",
        tagline="Modern luxury at our flagship Fwawei branch",
    )
    Hotel.objects.filter(branch="zaramaganda").update(
        name="Enayi Hotels & Suites — Zaramaganda",
        tagline="Serene comfort in the heart of Zaramaganda",
    )


class Migration(migrations.Migration):

    dependencies = [
        ("hotels", "0002_seed_branches"),
    ]

    operations = [
        migrations.RunPython(fix_spelling, revert_spelling),
    ]
