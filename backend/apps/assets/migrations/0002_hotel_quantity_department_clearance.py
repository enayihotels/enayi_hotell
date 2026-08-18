from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_hotel_from_room(apps, schema_editor):
    """Any existing room-tied asset can have its branch inferred from
    the room it's on — no guessing needed. Common-area assets (no
    room) are left with hotel=None; there's no reliable way to infer
    their branch from existing data, and forcing a guess risks
    silently assigning a Zarmaganda common-area asset to Fwavwei or
    vice versa. Those need a one-time manual Edit once this ships."""
    PropertyAsset = apps.get_model("assets", "PropertyAsset")
    for asset in PropertyAsset.objects.filter(hotel__isnull=True, room__isnull=False).select_related("room"):
        if asset.room.hotel_id:
            asset.hotel_id = asset.room.hotel_id
            asset.save(update_fields=["hotel"])


def remap_in_progress_status(apps, schema_editor):
    """The old 'in_progress' status doesn't exist in the new choice
    list — closest real equivalent is 'cleared_for_repair' (someone's
    actively working on it, which under the new flow can only happen
    after clearance anyway)."""
    AssetIssueReport = apps.get_model("assets", "AssetIssueReport")
    AssetIssueReport.objects.filter(status="in_progress").update(status="cleared_for_repair")


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("hotels", "0004_alter_hotel_branch"),
        ("assets", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="propertyasset",
            name="hotel",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name="property_assets", to="hotels.hotel",
                help_text="Which branch this asset belongs to. Added after the model already had real rows in "
                          "some deployments, so this stays nullable rather than forcing a guess for any asset an "
                          "old record can't be traced back to a branch for — same reasoning as "
                          "StockBalance.hotel/StockRequisition.hotel.",
            ),
        ),
        migrations.AddField(
            model_name="propertyasset",
            name="quantity",
            field=models.PositiveIntegerField(
                default=1,
                help_text="How many of this exact item are at this location — e.g. 4 for 'Pillow' in a room, 1 "
                          "for 'Split AC Unit'. Tracked as one line with a count, not one row per physical unit.",
            ),
        ),
        migrations.AddField(
            model_name="propertyasset",
            name="department",
            field=models.CharField(
                choices=[
                    ("frontdesk", "Front Desk"),
                    ("kitchen", "Kitchen"),
                    ("bar", "Bar"),
                    ("housekeeping", "Housekeeping (incl. all guest rooms)"),
                    ("shared", "Shared / Common Area — visible centrally only"),
                ],
                default="shared",
                max_length=15,
                help_text="Whose day-to-day view this shows up in. Room-tied assets are almost always "
                          "'housekeeping' — she's the one who notices/reports damage during cleaning. Front "
                          "Desk/Manager/Owner always see everything regardless of this tag (the central, "
                          "unrestricted view).",
            ),
        ),
        migrations.AlterField(
            model_name="propertyasset",
            name="category",
            field=models.CharField(
                choices=[
                    ("appliance", "Appliance (AC, TV, Fridge...)"),
                    ("electrical", "Electrical (Socket, Switch, Wiring...)"),
                    ("plumbing", "Plumbing (Tap, Shower, Toilet...)"),
                    ("furniture", "Furniture"),
                    ("fixture", "Fixture (Light, Fan, Door, Window...)"),
                    ("linen", "Linen / Soft Furnishing (Pillow, Duvet, Curtain...)"),
                    ("other", "Other"),
                ],
                default="other", max_length=20,
            ),
        ),
        migrations.RunPython(backfill_hotel_from_room, noop_reverse),

        # AssetIssueReport: add the Manager/Owner clearance gate
        migrations.RunPython(remap_in_progress_status, noop_reverse),
        migrations.AlterField(
            model_name="assetissuereport",
            name="status",
            field=models.CharField(
                choices=[
                    ("reported", "Reported"),
                    ("cleared_for_repair", "Cleared for Repair"),
                    ("rejected", "Rejected"),
                    ("fixed", "Fixed"),
                ],
                default="reported", max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="assetissuereport",
            name="cleared_by",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="asset_issues_cleared", to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="assetissuereport",
            name="cleared_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="assetissuereport",
            name="clearance_note",
            field=models.CharField(
                blank=True, max_length=255,
                help_text="Why this was cleared for repair, or why it was rejected.",
            ),
        ),
    ]
