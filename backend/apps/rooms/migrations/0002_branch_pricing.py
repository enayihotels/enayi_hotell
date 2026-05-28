import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0001_initial"),
        ("hotels", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="room",
            name="hotel",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="rooms", to="hotels.hotel",
            ),
        ),
        migrations.CreateModel(
            name="RoomCategoryPrice",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("base_price", models.DecimalField(decimal_places=2, max_digits=12)),
                ("weekend_price", models.DecimalField(decimal_places=2, max_digits=12)),
                ("holiday_price", models.DecimalField(decimal_places=2, max_digits=12)),
                ("breakfast_price", models.DecimalField(decimal_places=2, default=0, max_digits=12, help_text="Per-night surcharge for complimentary breakfast (0 = included/none)")),
                ("is_active", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("category", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="branch_prices", to="rooms.roomcategory")),
                ("hotel", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="room_prices", to="hotels.hotel")),
            ],
            options={
                "verbose_name": "Branch Room Price",
                "verbose_name_plural": "Branch Room Prices",
                "db_table": "room_category_prices",
                "ordering": ["category__sort_order", "category__name"],
            },
        ),
        migrations.AddConstraint(
            model_name="roomcategoryprice",
            constraint=models.UniqueConstraint(fields=("hotel", "category"), name="uniq_price_per_branch_category"),
        ),
    ]
