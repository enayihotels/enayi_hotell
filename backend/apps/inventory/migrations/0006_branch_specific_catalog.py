"""Make InventoryCategory and InventoryItem branch-specific.

Previously these were a single shared catalog across both branches —
after actually seeing that in use, a Store Keeper at one branch could
see every item *name* the other branch had ever created (even though
stock quantities were always correctly separate). This changes items
and categories to be fully separate per branch too.

All EXISTING categories/items were created before any branch besides
Fwavwei had been used in practice, so they're backfilled to Fwavwei
here — that's where they actually came from. Zarmaganda (or any other
branch added later) starts with a clean, empty catalog, exactly as
expected for a branch nobody has entered anything for yet.
"""
from django.db import migrations, models
import django.db.models.deletion


def backfill_to_fwavwei(apps, schema_editor):
    Hotel = apps.get_model("hotels", "Hotel")
    InventoryCategory = apps.get_model("inventory", "InventoryCategory")
    InventoryItem = apps.get_model("inventory", "InventoryItem")

    fwavwei = Hotel.objects.filter(branch="fwawei").first()
    if not fwavwei:
        # No branches seeded at all yet (a genuinely fresh install) —
        # nothing to backfill.
        return

    InventoryCategory.objects.filter(hotel__isnull=True).update(hotel=fwavwei)
    InventoryItem.objects.filter(hotel__isnull=True).update(hotel=fwavwei)


def noop_reverse(apps, schema_editor):
    # Deliberately a no-op — reversing this would mean merging two
    # branches' catalogs back into one shared list, which isn't a safe
    # or meaningful thing to automate.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("hotels", "0004_alter_hotel_branch"),
        ("inventory", "0005_alter_stockbalance_options_and_more"),
    ]

    operations = [
        # Step 1: add the field as nullable so it can coexist with
        # existing rows that don't have a value yet.
        migrations.AddField(
            model_name="inventorycategory",
            name="hotel",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE,
                                     related_name="inventory_categories", to="hotels.hotel"),
        ),
        migrations.AddField(
            model_name="inventoryitem",
            name="hotel",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE,
                                     related_name="inventory_items", to="hotels.hotel"),
        ),

        # Step 2: backfill every existing row to Fwavwei — where they
        # were actually created.
        migrations.RunPython(backfill_to_fwavwei, noop_reverse),

        # Step 3: now that every row has a value, make it required and
        # drop the old globally-unique constraints in favour of
        # per-branch uniqueness (two branches can both have a "Soft
        # Drinks" category without colliding).
        migrations.AlterField(
            model_name="inventorycategory",
            name="hotel",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                     related_name="inventory_categories", to="hotels.hotel"),
        ),
        migrations.AlterField(
            model_name="inventoryitem",
            name="hotel",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                     related_name="inventory_items", to="hotels.hotel"),
        ),
        migrations.AlterField(
            model_name="inventorycategory",
            name="name",
            field=models.CharField(max_length=100),
        ),
        migrations.AlterField(
            model_name="inventorycategory",
            name="slug",
            field=models.SlugField(max_length=120),
        ),
        migrations.AlterUniqueTogether(
            name="inventorycategory",
            unique_together={("hotel", "slug")},
        ),
        migrations.AlterModelOptions(
            name="inventorycategory",
            options={"ordering": ["hotel__branch", "name"], "verbose_name_plural": "Inventory categories"},
        ),
        migrations.AlterModelOptions(
            name="inventoryitem",
            options={"ordering": ["hotel__branch", "name"]},
        ),
    ]
