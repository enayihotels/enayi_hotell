import django.db.models.deletion
from django.db import migrations, models


def backfill_hotel(apps, schema_editor):
    Booking = apps.get_model("bookings", "Booking")
    Room    = apps.get_model("rooms", "Room")
    room_hotel = dict(Room.objects.values_list("id", "hotel_id"))
    for booking in Booking.objects.filter(hotel__isnull=True).exclude(room__isnull=True):
        hotel_id = room_hotel.get(booking.room_id)
        if hotel_id:
            booking.hotel_id = hotel_id
            booking.save(update_fields=["hotel"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0002_initial"),
        ("rooms", "0003_seed_branch_prices"),
        ("hotels", "0002_seed_branches"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="hotel",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="bookings", to="hotels.hotel",
            ),
        ),
        migrations.RunPython(backfill_hotel, noop),
    ]
