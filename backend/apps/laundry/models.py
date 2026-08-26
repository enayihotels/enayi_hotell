"""Enayi Hotels — Laundry Service

Two things live here:

1. LaundryPriceItem — the per-branch price catalog (e.g. "Shirt" =
   #500, "Trouser" = #700). Guests can view this in the app so they
   know what they'll be charged before calling. Only Manager/Owner can
   add or edit prices — same tier as who manages the room catalog or
   Property Assets.

2. LaundryTicket — guests still hand items over in person or by phone
   call, there's no self-service request form. Laundry Staff logs a
   ticket picking items + quantities from the price catalog (which
   computes the total automatically), then marks it ready once done,
   which emails the guest if an address is on file. No wash/dry/iron
   stage tracking in between — a load is either still in progress or
   it's ready, since a full-service load takes about a day anyway.
"""
import uuid
from django.db import models
from django.core.validators import MinValueValidator


class LaundryPriceItem(models.Model):
    """One row per chargeable item type at a branch, e.g. Shirt,
    Trouser, Bedsheet. Branch-specific, same reasoning as
    InventoryCategory/InventoryItem being per-branch — two branches
    can each have their own "Shirt" price without colliding."""
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel      = models.ForeignKey("hotels.Hotel", on_delete=models.CASCADE, related_name="laundry_price_items")
    name       = models.CharField(max_length=100, help_text="e.g. 'Shirt', 'Trouser', 'Bedsheet', 'Suit (2pc)'")
    price      = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    is_active  = models.BooleanField(default=True, help_text="Inactive items stay on old tickets but drop off the guest price list and the staff picker.")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "laundry_price_items"
        ordering = ["name"]
        unique_together = [("hotel", "name")]

    def __str__(self):
        return f"{self.name} — #{self.price} ({self.hotel.get_branch_display()})"


class LaundryTicket(models.Model):
    PENDING = "pending"
    READY   = "ready"
    STATUS_CHOICES = [
        (PENDING, "In Progress"),
        (READY,   "Ready for Pickup"),
    ]

    id     = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel  = models.ForeignKey("hotels.Hotel", on_delete=models.CASCADE, related_name="laundry_tickets")
    room   = models.ForeignKey(
        "rooms.Room", on_delete=models.SET_NULL, null=True, blank=True, related_name="laundry_tickets",
        help_text="Which room the guest is staying in, if known.",
    )
    guest_name  = models.CharField(max_length=150, help_text="Who to address in the ready notification.")
    guest_email = models.EmailField(blank=True, help_text="If left blank, no notification email can be sent — staff must tell the guest directly.")
    guest_phone = models.CharField(max_length=30, blank=True, help_text="Informational only — no SMS is sent from this field.")

    notes = models.TextField(blank=True, help_text="Anything not covered by the line items below, e.g. 'extra starch requested'.")
    total_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Sum of all line items — computed when the ticket is created.")

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING, db_index=True)

    logged_by       = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, related_name="laundry_tickets_logged")
    ready_marked_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="laundry_tickets_marked_ready")

    notified = models.BooleanField(default=False, help_text="True once a ready-notification email actually sent successfully.")

    created_at = models.DateTimeField(auto_now_add=True)
    ready_at   = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "laundry_tickets"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.guest_name} — {self.get_status_display()} ({self.hotel.get_branch_display()})"


class LaundryTicketItem(models.Model):
    """One line on a ticket — e.g. '3x Shirt @ #500'. Snapshots the
    name and unit price at the time of the ticket rather than just
    pointing at LaundryPriceItem, so a later price change (or the
    catalog item being deactivated) never rewrites the price on a
    ticket that already happened."""
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket     = models.ForeignKey(LaundryTicket, on_delete=models.CASCADE, related_name="line_items")
    price_item = models.ForeignKey(LaundryPriceItem, on_delete=models.SET_NULL, null=True, related_name="ticket_lines")
    item_name  = models.CharField(max_length=100, help_text="Snapshot of the price item's name at the time of this ticket.")
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Snapshot of the price at the time of this ticket.")
    quantity   = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])

    class Meta:
        db_table = "laundry_ticket_items"

    @property
    def line_total(self):
        return self.unit_price * self.quantity

    def __str__(self):
        return f"{self.quantity}x {self.item_name} @ #{self.unit_price}"
