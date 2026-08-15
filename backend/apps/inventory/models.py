"""Enayi Hotels — Store & Inventory Models

Phase 1 of the inventory system: the item catalog and how much of each
item currently sits in each location (Store, Bar, Kitchen). Movement
BETWEEN locations (Store -> Bar/Kitchen requisitions) is Phase 2 and
lives in its own model once that's built — this file deliberately only
covers "what exists and where," not yet "how it got there."
"""
import uuid
from django.db import models
from django.core.validators import MinValueValidator


class InventoryCategory(models.Model):
    """Groups items for display — e.g. 'Soft Drinks', 'Spirits',
    'Kitchen Ingredients', 'Cleaning Supplies'."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=100, unique=True)
    slug        = models.SlugField(max_length=120, unique=True)
    description = models.CharField(max_length=255, blank=True)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inventory_categories"
        verbose_name_plural = "Inventory categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class InventoryItem(models.Model):
    """A single stock-keeping item in the catalog — e.g. 'Coca-Cola 50cl',
    'Rice 50kg bag', 'Detergent 1L'. This is the master record; how much
    of it sits in each location is tracked separately in StockBalance,
    since the same item can exist in the Store, the Bar, and the Kitchen
    simultaneously with different quantities in each.
    """
    UNIT_CHOICES = [
        ("bottle", "Bottle"), ("can", "Can"), ("crate", "Crate"),
        ("carton", "Carton"), ("bag", "Bag"), ("kg", "Kilogram"),
        ("litre", "Litre"), ("piece", "Piece"), ("pack", "Pack"),
        ("roll", "Roll"), ("bunch", "Bunch"), ("box", "Box"),
    ]

    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name               = models.CharField(max_length=150)
    sku                = models.CharField(max_length=50, unique=True, blank=True,
                                           help_text="Optional internal code. Auto-generated if left blank.")
    category           = models.ForeignKey(InventoryCategory, on_delete=models.PROTECT, related_name="items")
    unit               = models.CharField(max_length=20, choices=UNIT_CHOICES, default="piece")
    cost_price         = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                              validators=[MinValueValidator(0)],
                                              help_text="What the hotel pays to acquire one unit.")
    sale_price         = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True,
                                              validators=[MinValueValidator(0)],
                                              help_text="What a guest is charged for one unit — set for drinks sold at the Bar; leave blank for items that are only consumed, like kitchen ingredients.")
    reorder_threshold  = models.PositiveIntegerField(default=5,
                                              help_text="Flag this item as low-stock at this location when its quantity falls to or below this number.")
    expiry_tracked     = models.BooleanField(default=False,
                                              help_text="Whether individual batches of this item should track an expiry date.")
    is_active          = models.BooleanField(default=True)
    created_at         = models.DateTimeField(auto_now_add=True)
    updated_at         = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inventory_items"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.get_unit_display()})"

    def save(self, *args, **kwargs):
        if not self.sku:
            # Simple, readable auto-SKU — first 3 letters of the category
            # slug + a short random suffix, unique-checked before saving.
            import random, string
            prefix = (self.category.slug[:3] if self.category_id else "itm").upper()
            for _ in range(10):
                candidate = f"{prefix}-{''.join(random.choices(string.digits, k=5))}"
                if not InventoryItem.objects.filter(sku=candidate).exists():
                    self.sku = candidate
                    break
        super().save(*args, **kwargs)


class StockBalance(models.Model):
    """How much of a given item currently sits in a given location.
    One row per (item, location) pair — created on first use, updated
    from then on. This is the live "what do we have, where" table that
    every stock-related screen reads from.
    """
    STORE   = "store"
    BAR     = "bar"
    KITCHEN = "kitchen"
    LOCATION_CHOICES = [
        (STORE,   "Store"),
        (BAR,     "Bar"),
        (KITCHEN, "Kitchen"),
    ]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item       = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="balances")
    hotel      = models.ForeignKey("hotels.Hotel", on_delete=models.CASCADE, related_name="stock_balances", null=True,
                                    help_text="Which branch this stock count belongs to. The same item has "
                                              "an independent quantity at each branch — Coca-Cola at "
                                              "Fwavwei's Bar is a completely different number from "
                                              "Coca-Cola at Zarmaganda's Bar.")
    location   = models.CharField(max_length=20, choices=LOCATION_CHOICES)
    quantity   = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                      validators=[MinValueValidator(0)])
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inventory_stock_balances"
        unique_together = [("item", "hotel", "location")]
        ordering = ["item__name", "hotel__branch", "location"]

    def __str__(self):
        return f"{self.item.name} @ {self.hotel.get_branch_display()} {self.get_location_display()}: {self.quantity}"

    @property
    def is_low(self):
        return self.quantity <= self.item.reorder_threshold


class StockAdjustmentLog(models.Model):
    """Phase 5: every direct stock adjustment (deliveries, corrections,
    spoilage — anything through AdjustStockView) now leaves a permanent
    record of who did it, when, and why. Requisitions (Store -> Bar/
    Kitchen) already had this via StockRequisition; direct adjustments
    at your OWN location never did, which was a real gap for something
    that can move real value with a single API call and no second
    person involved. This feeds the nightly Fraud Audit.
    """
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item                = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="adjustment_logs")
    hotel               = models.ForeignKey("hotels.Hotel", on_delete=models.CASCADE, related_name="stock_adjustment_logs", null=True)
    location            = models.CharField(max_length=20, choices=StockBalance.LOCATION_CHOICES)
    delta               = models.DecimalField(max_digits=12, decimal_places=2)
    resulting_quantity  = models.DecimalField(max_digits=12, decimal_places=2)
    reason              = models.CharField(max_length=255, blank=True)
    adjusted_by         = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, related_name="stock_adjustments_made")
    created_at          = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inventory_stock_adjustment_logs"
        ordering = ["-created_at"]

    def __str__(self):
        sign = "+" if self.delta >= 0 else ""
        return f"{self.item.name} @ {self.get_location_display()}: {sign}{self.delta} by {self.adjusted_by}"


class StockRequisition(models.Model):
    """Phase 2: the actual Store -> Bar/Kitchen movement mechanism.

    Bar Staff or Kitchen Staff requests what they need; the Store Keeper
    (or a manager/owner) fulfills it, confirming the real quantity handed
    over — which might differ from what was requested if the Store
    doesn't have enough. Stock only actually moves at fulfillment time,
    not at request time. This is the "two-person handoff" accountability
    model agreed on: both the requester's and the fulfiller's names are
    on every transfer, without needing a slower manager-approval step
    for something as routine as restocking the bar.
    """
    PENDING   = "pending"
    FULFILLED = "fulfilled"
    REJECTED  = "rejected"
    CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (PENDING,   "Pending"),
        (FULFILLED, "Fulfilled"),
        (REJECTED,  "Rejected"),
        (CANCELLED, "Cancelled"),
    ]

    DESTINATION_CHOICES = [
        (StockBalance.BAR,     "Bar"),
        (StockBalance.KITCHEN, "Kitchen"),
    ]

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item                = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="requisitions")
    hotel               = models.ForeignKey("hotels.Hotel", on_delete=models.CASCADE, related_name="stock_requisitions", null=True,
                                             help_text="Which branch this request and fulfillment moves stock within — a "
                                                       "Bar Staff at Fwavwei can only request from, and be fulfilled by, "
                                                       "Fwavwei's own Store.")
    destination         = models.CharField(max_length=20, choices=DESTINATION_CHOICES)
    quantity_requested  = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    quantity_fulfilled  = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True,
                                               validators=[MinValueValidator(0)])
    status              = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)

    requested_by        = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="stock_requests_made")
    note_from_requester  = models.CharField(max_length=255, blank=True)

    decided_by          = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_requests_decided")
    note_from_fulfiller = models.CharField(max_length=255, blank=True)
    decided_at          = models.DateTimeField(null=True, blank=True)

    created_at          = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inventory_stock_requisitions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.item.name} x{self.quantity_requested} -> {self.get_destination_display()} ({self.status})"
