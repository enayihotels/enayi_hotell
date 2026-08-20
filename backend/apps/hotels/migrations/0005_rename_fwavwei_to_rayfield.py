"""
Rename the Fwavwei/Fwawei branch display name to "Rayfield" everywhere.

The internal branch key ("fwawei") and slug are deliberately left
unchanged — altering the DB key would require re-pointing every FK
in bookings, rooms, inventory, assets, etc. and is unnecessary since
the key is an internal identifier, not a user-visible label.

What this migration does:
1. Updates the Hotel.branch choices display label: "Fwavwei" → "Rayfield"
2. Updates the live Hotel row's name  field:
       "Enayi Hotels & Suites — Fwavwei" → "Enayi Hotels & Suites — Rayfield"
3. Updates the live Hotel row's tagline field to match.
"""
from django.db import migrations, models


def rename_to_rayfield(apps, schema_editor):
    Hotel = apps.get_model("hotels", "Hotel")
    Hotel.objects.filter(branch="fwawei").update(
        name="Enayi Hotels & Suites — Rayfield",
        tagline="Modern luxury at our Rayfield branch",
    )


def reverse_rename(apps, schema_editor):
    Hotel = apps.get_model("hotels", "Hotel")
    Hotel.objects.filter(branch="fwawei").update(
        name="Enayi Hotels & Suites — Fwavwei",
        tagline="Modern luxury at our flagship Fwavwei branch",
    )


class Migration(migrations.Migration):

    dependencies = [
        ("hotels", "0004_alter_hotel_branch"),
    ]

    operations = [
        # Update the choices list on the branch field so that
        # makemigrations --check stays clean.
        migrations.AlterField(
            model_name="hotel",
            name="branch",
            field=models.CharField(
                choices=[
                    ("zaramaganda", "Zarmaganda"),
                    ("fwawei", "Rayfield"),
                ],
                max_length=20,
                unique=True,
            ),
        ),
        # Update the actual hotel row's name and tagline in the database.
        migrations.RunPython(rename_to_rayfield, reverse_rename),
    ]
