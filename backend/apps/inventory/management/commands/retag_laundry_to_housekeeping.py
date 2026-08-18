"""
Retags the "Laundry Supplies" inventory category (detergent, fabric
softener) from department='shared' to department='housekeeping' — it
was seeded before Housekeeping existed as a real department, and
laundry is naturally her domain, not something that should sit
unreachable at Store-only.

Run:
    python manage.py retag_laundry_to_housekeeping

Safe to re-run — no-ops if already tagged correctly.
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Retag Laundry Supplies category to department='housekeeping' at both branches."

    def handle(self, *args, **options):
        from apps.inventory.models import InventoryCategory

        updated = InventoryCategory.objects.filter(name="Laundry Supplies").update(
            department=InventoryCategory.HOUSEKEEPING
        )
        self.stdout.write(self.style.SUCCESS(f"Done — {updated} 'Laundry Supplies' category(ies) retagged to Housekeeping."))
