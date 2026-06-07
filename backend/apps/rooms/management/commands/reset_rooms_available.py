"""
Management command: reset_rooms_available
Sets rooms to available ONLY if they have no active booking.
This prevents rooms that are genuinely reserved from being reset.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Reset rooms to available — skips rooms with active bookings"

    def handle(self, *args, **options):
        from apps.rooms.models import Room
        from apps.bookings.models import Booking

        today = timezone.now().date()

        # Find rooms that have active bookings
        active_booked_ids = set(Booking.objects.filter(
            status__in=["pending", "confirmed", "checked_in"],
        ).values_list("room_id", flat=True))

        # Reset ONLY rooms that have NO active booking
        updated = Room.objects.exclude(
            id__in=active_booked_ids
        ).exclude(
            status="available"
        ).update(status="available")

        # Ensure all actively booked rooms are reserved
        synced = Room.objects.filter(
            id__in=active_booked_ids
        ).exclude(
            status__in=["reserved", "occupied"]
        ).update(status="reserved")

        total = Room.objects.count()
        avail = Room.objects.filter(status="available").count()

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Reset {updated} rooms to available. "
                f"Synced {synced} booked rooms to reserved. "
                f"{avail}/{total} rooms now available."
            )
        )
