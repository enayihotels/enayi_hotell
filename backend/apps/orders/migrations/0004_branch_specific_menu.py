"""Make MenuCategory and MenuItem branch-specific.

Mirrors apps/inventory/migrations/0006_branch_specific_catalog.py —
since inventory items are now fully separate per branch, the guest
menu (which links to those inventory items) needs to be too, or a
Zarmaganda guest could end up seeing a menu item tied to Fwavwei-only
stock. Every existing category/item was created before any branch
besides Fwavwei had real menu data, so it's backfilled there.
"""
from django.db import migrations, models
import django.db.models.deletion


def backfill_to_fwavwei(apps, schema_editor):
    Hotel = apps.get_model("hotels", "Hotel")
    MenuCategory = apps.get_model("orders", "MenuCategory")
    MenuItem = apps.get_model("orders", "MenuItem")

    fwavwei = Hotel.objects.filter(branch="fwawei").first()
    if not fwavwei:
        return

    MenuCategory.objects.filter(hotel__isnull=True).update(hotel=fwavwei)
    MenuItem.objects.filter(hotel__isnull=True).update(hotel=fwavwei)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("hotels", "0004_alter_hotel_branch"),
        ("orders", "0003_order_hotel"),
    ]

    operations = [
        migrations.AddField(
            model_name="menucategory",
            name="hotel",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE,
                                     related_name="menu_categories", to="hotels.hotel"),
        ),
        migrations.AddField(
            model_name="menuitem",
            name="hotel",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE,
                                     related_name="menu_items", to="hotels.hotel"),
        ),

        migrations.RunPython(backfill_to_fwavwei, noop_reverse),

        migrations.AlterField(
            model_name="menucategory",
            name="hotel",
            field=models.ForeignKey(
                help_text="Each branch runs its own menu, mirroring how inventory is fully separate per "
                          "branch — a category at one branch has nothing to do with a same-named one at "
                          "the other.",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="menu_categories", to="hotels.hotel"),
        ),
        migrations.AlterField(
            model_name="menuitem",
            name="hotel",
            field=models.ForeignKey(
                help_text="Which branch actually offers this item. Kept naturally consistent with its "
                          "linked inventory_item's own branch when listed via 'List on Guest Menu'.",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="menu_items", to="hotels.hotel"),
        ),
        migrations.AlterModelOptions(
            name="menucategory",
            options={"ordering": ["hotel__branch", "sort_order", "name"], "verbose_name_plural": "Menu Categories"},
        ),
    ]
