from django.db import migrations, models


# Every current category is a drink category (Beer & Spirits / Beers,
# Spirits & Wines / Soft Drinks & Mixers / Soft Drinks — imported by
# import_fwavwei_bar_drinks + list_fwavwei_drinks_on_menu). Backfilling
# by name match here rather than leaving them at the new 'shared'
# default, so this migration doesn't quietly re-expose bar categories
# to Kitchen Staff the moment it runs.
BAR_CATEGORY_NAME_FRAGMENTS = ["beer", "spirit", "wine", "soft drink", "drink"]


def backfill_bar_departments(apps, schema_editor):
    InventoryCategory = apps.get_model("inventory", "InventoryCategory")
    for cat in InventoryCategory.objects.all():
        name_lower = cat.name.lower()
        if any(fragment in name_lower for fragment in BAR_CATEGORY_NAME_FRAGMENTS):
            cat.department = "bar"
            cat.save(update_fields=["department"])


def noop_reverse(apps, schema_editor):
    # Reversing just leaves everything at 'shared' — nothing destructive
    # to undo, so no need to track what was changed.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0007_alter_inventoryitem_unit"),
    ]

    operations = [
        migrations.AddField(
            model_name="inventorycategory",
            name="department",
            field=models.CharField(
                choices=[("bar", "Bar only"), ("kitchen", "Kitchen only"), ("shared", "Shared / Store only")],
                default="shared",
                max_length=10,
                help_text="Who requests items in this category from the Store. 'Bar only' / 'Kitchen only' "
                          "hides it from the other department's Inventory screen entirely — a Kitchen Staff "
                          "account never sees a Bar-only category and vice versa. 'Shared / Store only' is "
                          "visible to both (or neither, if it's something only the Store Keeper handles "
                          "directly, like cleaning supplies).",
            ),
        ),
        migrations.RunPython(backfill_bar_departments, noop_reverse),
    ]
