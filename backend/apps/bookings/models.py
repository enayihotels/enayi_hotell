"""Enayi Hotels — Bookings Models"""
import uuid, random, string
from decimal import Decimal, ROUND_HALF_UP
from django.db import models
from django.utils import timezone


class Booking(models.Model):
    PENDING     = "pending"
    CONFIRMED   = "confirmed"
    CHECKED_IN  = "checked_in"
    CHECKED_OUT = "checked_out"
    CANCELLED   = "cancelled"
    NO_SHOW     = "no_show"

    STATUS_CHOICES = [
        (PENDING,"Pending"),(CONFIRMED,"Confirmed"),(CHECKED_IN,"Checked In"),
        (CHECKED_OUT,"Checked Out"),(CANCELLED,"Cancelled"),(NO_SHOW,"No Show"),
    ]
    SOURCE_CHOICES = [
        ("website","Website"),("walk_in","Walk-in"),
        ("phone","Phone"),("agent","Travel Agent"),
    ]

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking_reference   = models.CharField(max_length=20, unique=True, editable=False)
    guest               = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="bookings")
    hotel               = models.ForeignKey("hotels.Hotel", on_delete=models.PROTECT, related_name="bookings", null=True, blank=True)
    room                = models.ForeignKey("rooms.Room", on_delete=models.PROTECT, related_name="bookings")
    check_in            = models.DateField(db_index=True)
    check_out           = models.DateField()
    actual_check_in     = models.DateTimeField(blank=True, null=True)
    actual_check_out    = models.DateTimeField(blank=True, null=True)
    adults              = models.PositiveIntegerField(default=1)
    children            = models.PositiveIntegerField(default=0)
    status              = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING, db_index=True)
    source              = models.CharField(max_length=20, choices=SOURCE_CHOICES, default="website")
    room_rate_per_night = models.DecimalField(max_digits=12, decimal_places=2)
    total_nights        = models.PositiveIntegerField(default=1)
    subtotal            = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount          = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount     = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount        = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_paid         = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    special_requests    = models.TextField(blank=True)
    breakfast_included  = models.BooleanField(default=False)
    airport_pickup      = models.BooleanField(default=False)
    late_checkout       = models.BooleanField(default=False)
    early_checkin       = models.BooleanField(default=False)
    assigned_by         = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_bookings")
    cancellation_reason = models.TextField(blank=True)
    cancelled_at        = models.DateTimeField(blank=True, null=True)
    notes               = models.TextField(blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "bookings"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Booking {self.booking_reference}"

    def save(self, *args, **kwargs):
        if not self.booking_reference:
            self.booking_reference = "ENY" + "".join(random.choices(string.digits, k=8))
        # Derive the branch from the assigned room if not set explicitly.
        if not self.hotel_id and self.room_id:
            self.hotel_id = self.room.hotel_id
        if self.check_in and self.check_out:
            self.total_nights = max((self.check_out - self.check_in).days, 1)
            nights = self.total_nights
            rate = Decimal(str(self.room_rate_per_night or 0))
            self.subtotal = rate * nights
            extras = Decimal("0")
            if self.breakfast_included:
                extras += Decimal(self._breakfast_rate()) * nights
            if self.airport_pickup:     extras += Decimal("8000")
            if self.late_checkout:      extras += Decimal("5000")
            if self.early_checkin:      extras += Decimal("5000")
            discount = Decimal(str(self.discount_amount or 0))
            # No VAT — guests pay the original room rate plus any chosen extras only.
            self.tax_amount   = Decimal("0")
            self.total_amount = self.subtotal + extras - discount
        super().save(*args, **kwargs)

    def _breakfast_rate(self):
        """Per-night breakfast surcharge for this booking's branch + room class.

        Falls back to the historical flat 3500 when no branch price is set.
        """
        default = 3500
        if not (self.hotel_id and self.room_id):
            return default
        try:
            from apps.rooms.models import RoomCategoryPrice
            price = (RoomCategoryPrice.objects
                     .filter(hotel_id=self.hotel_id, category_id=self.room.category_id, is_active=True)
                     .first())
            if price and price.breakfast_price:
                return int(price.breakfast_price)
        except Exception:
            pass
        return default

    @property
    def balance_due(self):
        return max(self.total_amount - self.amount_paid, 0)

    @property
    def is_fully_paid(self):
        return self.amount_paid >= self.total_amount
