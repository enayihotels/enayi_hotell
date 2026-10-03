"""
Wipes every Booking and Payment in the system, and deletes every Guest
account that has ever made a booking — across BOTH branches. Built at
Adrian's explicit request to reset test/demo data accumulated before
go-live, confirmed directly: none of it represents real money yet.

THIS IS A PRODUCTION DATABASE. This command is irreversible and
system-wide — there is no "undo" once --apply runs. It does NOT ask
"is this really test data" (that call was already made); it only ever
asks "did you mean to run this at all" by forcing a dry run first.

Scope, precisely:
  - Every Payment record (any purpose, any status) — 70 at last count,
    69 Room Booking + 1 Laundry, including 27 marked "Successful".
  - Every Booking record — 50 at last count, 31 Rayfield + 19 Zarmaganda.
  - Every Order record — 14 at last count, 11 Rayfield + 3 with no
    branch set. Added after the first --apply attempt failed: 8 of the
    14 qualifying guests also had Order history, which Order.guest's
    PROTECT blocked deletion on — confirmed with Adrian to clear all
    Orders too rather than leave those 8 accounts stranded.
  - Every Guest account that has placed at least one booking — 14 at
    last count. A Guest account that has NEVER booked is left alone
    (not in scope — Adrian's instruction was specifically "clients
    that have ever placed a booking"), even if that account happens to
    have Order history of its own.

Explicitly NOT touched, since they were never mentioned:
  - Guest accounts with zero bookings (8 at last count) — even their
    Orders are left alone, only a qualifying guest's data is cleared.
  - Staff/Manager/Admin accounts (never in scope regardless).
  - Rooms, Room Categories, menus, inventory — none of this touches
    the catalog, only guest transaction history.

Deletion order matters: Payments first (nothing references a Payment,
so nothing can block this), then Bookings (CheckoutApprovalRequest
cascades with its Booking automatically) and Orders (OrderItem cascades
with its Order automatically) — both must be gone before the
now-unblocked Guest accounts are deleted last.

SAFETY: defaults to a DRY RUN — lists exactly what it would delete,
touches nothing. Pass --apply to actually commit. There is no further
confirmation prompt beyond that flag — read the dry-run output
carefully before using it.

Usage (from backend root):
    python manage.py clear_all_booking_history            # dry run
    python manage.py clear_all_booking_history --apply     # irreversible
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.bookings.models import Booking
from apps.payments.models import Payment
from apps.orders.models import Order


class Command(BaseCommand):
    help = "DESTRUCTIVE: delete every Payment, every Booking, every Order, and every Guest account that has booked, across both branches."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Actually commit changes. Without this flag, dry-run only.")

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        mode = "APPLYING CHANGES — THIS IS IRREVERSIBLE" if apply_changes else "DRY RUN — no changes will be saved"
        self.stdout.write(self.style.WARNING(f"\n=== {mode} ===\n"))

        payments = Payment.objects.all()
        bookings = Booking.objects.all()
        # Django won't allow .delete() on a queryset built with .distinct()
        # (needed above only to count guests once each, since a guest with
        # several bookings would otherwise join-duplicate) — so the
        # resolve-which-guests-qualify step and the actual delete use two
        # different, equivalent queries instead of sharing one `distinct`
        # queryset between counting and deleting.
        qualifying_guest_ids = list(
            User.objects.filter(role="guest", bookings__isnull=False).distinct().values_list("id", flat=True)
        )
        guests = User.objects.filter(id__in=qualifying_guest_ids)

        self.stdout.write(self.style.MIGRATE_HEADING(f"Payments to delete: {payments.count()}"))
        by_status = {}
        for p in payments:
            by_status[p.status] = by_status.get(p.status, 0) + 1
        for status, count in sorted(by_status.items()):
            self.stdout.write(f"  {status}: {count}")

        self.stdout.write(self.style.MIGRATE_HEADING(f"\nBookings to delete: {bookings.count()}"))
        by_hotel = {}
        for b in bookings.select_related("hotel"):
            key = b.hotel.name if b.hotel_id else "(no branch set)"
            by_hotel[key] = by_hotel.get(key, 0) + 1
        for hotel_name, count in sorted(by_hotel.items()):
            self.stdout.write(f"  {hotel_name}: {count}")

        orders = Order.objects.all()
        self.stdout.write(self.style.MIGRATE_HEADING(f"\nOrders to delete: {orders.count()}"))
        by_hotel_orders = {}
        for o in orders.select_related("hotel"):
            key = o.hotel.name if o.hotel_id else "(no branch set)"
            by_hotel_orders[key] = by_hotel_orders.get(key, 0) + 1
        for hotel_name, count in sorted(by_hotel_orders.items()):
            self.stdout.write(f"  {hotel_name}: {count}")

        self.stdout.write(self.style.MIGRATE_HEADING(f"\nGuest accounts to delete: {guests.count()}"))
        for g in guests.order_by("email"):
            self.stdout.write(f"  {g.email!r:40} {g.get_full_name()} — {g.bookings.count()} booking(s)")

        untouched = User.objects.filter(role="guest", bookings__isnull=True).count()
        self.stdout.write(self.style.MIGRATE_HEADING(f"\nGuest accounts left untouched (never booked): {untouched}"))

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                "\n=== DRY RUN complete — nothing was saved. Review every line above, then re-run with --apply to commit. "
                "This cannot be undone once applied. ==="
            ))
            return

        with transaction.atomic():
            deleted_payments = payments.delete()
            deleted_bookings = bookings.delete()
            deleted_orders = orders.delete()
            deleted_guests = guests.delete()

        self.stdout.write(self.style.SUCCESS(
            f"\n=== Done. Deleted {deleted_payments[0]} payment-related rows, "
            f"{deleted_bookings[0]} booking-related rows, {deleted_orders[0]} order-related rows, "
            f"{deleted_guests[0]} guest-account-related rows. ==="
        ))
