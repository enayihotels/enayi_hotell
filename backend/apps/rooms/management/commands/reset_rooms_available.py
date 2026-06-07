"""
Management command: reset_rooms_available
Sets ALL rooms to status=available so booking works immediately.
Run once after initial deploy: python manage.py reset_rooms_available
"""
from django.core.management.base import BaseCommand
from apps.rooms.models import Room


class Command(BaseCommand):
    help = "Reset all rooms to available status"

    def handle(self, *args, **options):
        total  = Room.objects.count()
        updated = Room.objects.exclude(status="available").update(status="available")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {updated} of {total} rooms reset to available."
            )
        )
