from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("hotels", "0001_initial"),
        ("gallery", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="galleryimage",
            name="hotel",
            field=models.ForeignKey(
                blank=True,
                help_text="Which branch this photo is of. Blank = not yet assigned / applies to both.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="gallery_images",
                to="hotels.hotel",
            ),
        ),
    ]
