"""Enayi Hotels — Event Hall Models"""
import uuid, random, string
from django.db import models


class EventHall(models.Model):
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name             = models.CharField(max_length=200)
    slug             = models.SlugField(unique=True)
    description      = models.TextField()
    capacity_seated  = models.PositiveIntegerField()
    capacity_cocktail= models.PositiveIntegerField()
    capacity_banquet = models.PositiveIntegerField()
    size_sqm         = models.DecimalField(max_digits=8, decimal_places=1)
    floor            = models.PositiveIntegerField(default=1)
    price_per_hour   = models.DecimalField(max_digits=10, decimal_places=2)
    price_half_day   = models.DecimalField(max_digits=10, decimal_places=2)
    price_full_day   = models.DecimalField(max_digits=10, decimal_places=2)
    price_weekend    = models.DecimalField(max_digits=10, decimal_places=2)
    deposit_percent  = models.DecimalField(max_digits=5,  decimal_places=2, default=30)
    has_projector    = models.BooleanField(default=True)
    has_sound_system = models.BooleanField(default=True)
    has_microphone   = models.BooleanField(default=True)
    has_wifi         = models.BooleanField(default=True)
    has_ac           = models.BooleanField(default=True)
    has_stage        = models.BooleanField(default=False)
    has_dance_floor  = models.BooleanField(default=False)
    has_parking      = models.BooleanField(default=True)
    thumbnail        = models.ImageField(upload_to="events/halls/thumbnails/", blank=True, null=True)
    is_active        = models.BooleanField(default=True, db_index=True)
    sort_order       = models.PositiveIntegerField(default=0)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "event_halls"
        ordering = ["sort_order", "name"]

    def __str__(self): return f"{self.name} (cap: {self.capacity_seated})"


class EventHallImage(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hall       = models.ForeignKey(EventHall, on_delete=models.CASCADE, related_name="images")
    image      = models.ImageField(upload_to="events/halls/%Y/%m/")
    caption    = models.CharField(max_length=300, blank=True)
    is_primary = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "event_hall_images"
        ordering = ["-is_primary","sort_order"]


class EventBooking(models.Model):
    PENDING      = "pending"
    CONFIRMED    = "confirmed"
    DEPOSIT_PAID = "deposit_paid"
    FULLY_PAID   = "fully_paid"
    COMPLETED    = "completed"
    CANCELLED    = "cancelled"

    STATUS_CHOICES = [
        (PENDING,"Pending Review"),(CONFIRMED,"Confirmed"),
        (DEPOSIT_PAID,"Deposit Paid"),(FULLY_PAID,"Fully Paid"),
        (COMPLETED,"Completed"),(CANCELLED,"Cancelled"),
    ]
    EVENT_TYPES = [
        ("wedding","Wedding"),("corporate","Corporate/Conference"),
        ("birthday","Birthday"),("graduation","Graduation"),
        ("naming","Naming Ceremony"),("burial","Burial/Memorial"),
        ("product_launch","Product Launch"),("concert","Concert"),
        ("custom","Custom Event"),
    ]
    SETUP_STYLES = [
        ("theatre","Theatre"),("classroom","Classroom"),
        ("banquet","Banquet/Round Tables"),("boardroom","Boardroom"),
        ("cocktail","Cocktail/Standing"),("u_shape","U-Shape"),
    ]

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking_reference   = models.CharField(max_length=20, unique=True, editable=False)
    organizer           = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="event_bookings")
    hall                = models.ForeignKey(EventHall, on_delete=models.PROTECT, related_name="bookings")
    event_name          = models.CharField(max_length=300)
    event_type          = models.CharField(max_length=30, choices=EVENT_TYPES, default="corporate")
    event_date          = models.DateField(db_index=True)
    start_time          = models.TimeField()
    end_time            = models.TimeField()
    setup_time          = models.TimeField()
    expected_guests     = models.PositiveIntegerField()
    setup_style         = models.CharField(max_length=20, choices=SETUP_STYLES, default="theatre")
    catering_required   = models.BooleanField(default=False)
    catering_notes      = models.TextField(blank=True)
    decoration_required = models.BooleanField(default=False)
    photography_required= models.BooleanField(default=False)
    mc_required         = models.BooleanField(default=False)
    live_band_required  = models.BooleanField(default=False)
    dj_required         = models.BooleanField(default=False)
    special_requests    = models.TextField(blank=True)
    contact_phone       = models.CharField(max_length=20, blank=True)
    contact_email       = models.EmailField(blank=True)
    hall_rate           = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    extras_cost         = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    catering_cost       = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount          = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount     = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount        = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deposit_amount      = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_paid         = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status              = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING, db_index=True)
    handled_by          = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="handled_events")
    notes               = models.TextField(blank=True)
    internal_notes      = models.TextField(blank=True)
    cancelled_at        = models.DateTimeField(blank=True, null=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "event_bookings"
        ordering = ["-created_at"]

    def __str__(self): return f"Event: {self.event_name} — {self.event_date} ({self.booking_reference})"

    def save(self, *args, **kwargs):
        if not self.booking_reference:
            self.booking_reference = "EVT" + "".join(random.choices(string.digits, k=8))
        super().save(*args, **kwargs)

    @property
    def balance_due(self): return max(self.total_amount - self.amount_paid, 0)
