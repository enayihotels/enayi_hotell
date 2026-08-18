from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assets", "0002_hotel_quantity_department_clearance"),
    ]

    operations = [
        migrations.AlterField(
            model_name="propertyasset",
            name="name",
            field=models.CharField(
                help_text="e.g. 'Split AC Unit', 'Wall Socket (near bed)', 'Bathroom Tap', 'Pillow'",
                max_length=150,
            ),
        ),
    ]
