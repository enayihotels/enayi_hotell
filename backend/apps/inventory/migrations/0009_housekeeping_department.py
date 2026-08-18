from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0008_inventorycategory_department"),
    ]

    operations = [
        # department's max_length needed to grow from 10 to 15 to fit
        # "housekeeping" (12 chars) as a choice value.
        migrations.AlterField(
            model_name="inventorycategory",
            name="department",
            field=models.CharField(
                choices=[
                    ("bar", "Bar only"),
                    ("kitchen", "Kitchen only"),
                    ("housekeeping", "Housekeeping only"),
                    ("shared", "Shared / Store only"),
                ],
                default="shared",
                max_length=15,
                help_text="Who requests items in this category from the Store. 'Bar only' / 'Kitchen only' / "
                          "'Housekeeping only' hides it from every OTHER department's Inventory screen — a "
                          "Kitchen Staff account never sees a Bar-only or Housekeeping-only category and vice "
                          "versa. 'Shared / Store only' is visible to all of them (or none, if it's something "
                          "only the Store Keeper handles directly, like cleaning supplies).",
            ),
        ),
        # location's max_length was already 20, plenty of room for
        # "housekeeping" (12 chars) — only the choices list changes.
        migrations.AlterField(
            model_name="stockbalance",
            name="location",
            field=models.CharField(
                choices=[
                    ("store", "Store"),
                    ("bar", "Bar"),
                    ("kitchen", "Kitchen"),
                    ("housekeeping", "Housekeeping"),
                ],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="stockadjustmentlog",
            name="location",
            field=models.CharField(
                choices=[
                    ("store", "Store"),
                    ("bar", "Bar"),
                    ("kitchen", "Kitchen"),
                    ("housekeeping", "Housekeeping"),
                ],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="stockrequisition",
            name="destination",
            field=models.CharField(
                choices=[
                    ("bar", "Bar"),
                    ("kitchen", "Kitchen"),
                    ("housekeeping", "Housekeeping"),
                ],
                max_length=20,
            ),
        ),
    ]
