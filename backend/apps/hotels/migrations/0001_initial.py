import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Hotel",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=120)),
                ("branch", models.CharField(choices=[("zaramaganda", "Zaramaganda"), ("fwawei", "Fwawei")], max_length=20, unique=True)),
                ("slug", models.SlugField(unique=True)),
                ("tagline", models.CharField(blank=True, max_length=200)),
                ("description", models.TextField(blank=True)),
                ("address", models.CharField(blank=True, max_length=255)),
                ("city", models.CharField(default="Jos", max_length=80)),
                ("state", models.CharField(default="Plateau State", max_length=80)),
                ("phone", models.CharField(blank=True, max_length=30)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("whatsapp", models.CharField(blank=True, max_length=30)),
                ("latitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("longitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("cover_image", models.ImageField(blank=True, null=True, upload_to="hotels/covers/%Y/%m/")),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("is_primary", models.BooleanField(default=False, help_text="Featured / default branch on the public site")),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Hotel Branch",
                "verbose_name_plural": "Hotel Branches",
                "db_table": "hotels",
                "ordering": ["sort_order", "name"],
            },
        ),
        migrations.CreateModel(
            name="HotelImage",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("image", models.ImageField(upload_to="hotels/gallery/%Y/%m/")),
                ("caption", models.CharField(blank=True, max_length=300)),
                ("is_cover", models.BooleanField(default=False, help_text="Use as the branch's headline photo")),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                ("hotel", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="images", to="hotels.hotel")),
            ],
            options={
                "db_table": "hotel_images",
                "ordering": ["-is_cover", "sort_order", "uploaded_at"],
            },
        ),
    ]
