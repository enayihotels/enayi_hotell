"""Reset stock-related data ahead of adding branch scoping.

Every StockBalance, StockRequisition, and StockAdjustmentLog row was
created before branches existed as a concept for inventory, so there's
no correct branch to retroactively assign them to — guessing would
just produce wrong numbers that look authoritative. Deleting them
clears the way to add a REQUIRED `hotel` field on all three models in
the next migration without needing a fake default value.

The item catalog itself (InventoryCategory, InventoryItem) is
untouched — only the per-branch stock counts and their history reset
to a clean slate, ready for accurate branch-by-branch entry.
"""
from django.db import migrations


def reset_stock_data(apps, schema_editor):
    StockBalance = apps.get_model("inventory", "StockBalance")
    StockRequisition = apps.get_model("inventory", "StockRequisition")
    StockAdjustmentLog = apps.get_model("inventory", "StockAdjustmentLog")

    StockAdjustmentLog.objects.all().delete()
    StockRequisition.objects.all().delete()
    StockBalance.objects.all().delete()


def noop_reverse(apps, schema_editor):
    # Deliberately not reversible — there's nothing meaningful to
    # restore once the data's gone, and pretending otherwise would be
    # misleading. Rolling back just leaves the tables empty.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0003_stockadjustmentlog"),
    ]

    operations = [
        migrations.RunPython(reset_stock_data, noop_reverse),
    ]
