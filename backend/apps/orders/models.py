"""Enayi Hotels — Food & Drink Orders (Kitchen + Bar)"""
import uuid, random, string
from django.db import models


class MenuCategory(models.Model):
    TYPES = [
        ("food","Food / Kitchen"),("drink","Drink / Beverage"),
        ("cocktail","Cocktail & Bar"),("mocktail","Mocktail"),
        ("wine","Wine & Spirits"),("dessert","Dessert"),
        ("breakfast","Breakfast"),("snack","Snacks & Sides"),
    ]
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name       = models.CharField(max_length=100)
    type       = models.CharField(max_length=20, choices=TYPES)
    icon       = models.CharField(max_length=100, blank=True)
    description= models.TextField(blank=True)
    is_active  = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "menu_categories"
        verbose_name_plural = "Menu Categories"
        ordering = ["sort_order", "name"]

    def __str__(self): return f"{self.name} ({self.get_type_display()})"


class MenuItem(models.Model):
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category         = models.ForeignKey(MenuCategory, on_delete=models.PROTECT, related_name="items")
    name             = models.CharField(max_length=200)
    description      = models.TextField()
    price            = models.DecimalField(max_digits=10, decimal_places=2)
    image            = models.ImageField(upload_to="menu/%Y/%m/", blank=True, null=True)
    is_available     = models.BooleanField(default=True, db_index=True)
    is_vegetarian    = models.BooleanField(default=False)
    is_vegan         = models.BooleanField(default=False)
    is_halal         = models.BooleanField(default=True)
    is_gluten_free   = models.BooleanField(default=False)
    is_spicy         = models.BooleanField(default=False)
    allergens        = models.CharField(max_length=500, blank=True)
    calories         = models.PositiveIntegerField(blank=True, null=True)
    preparation_time = models.PositiveIntegerField(default=20, help_text="Minutes")
    sort_order       = models.PositiveIntegerField(default=0)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "menu_items"
        ordering = ["category", "sort_order", "name"]

    def __str__(self): return f"{self.name} — ₦{self.price:,.0f}"


class Order(models.Model):
    PENDING   = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY     = "ready"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (PENDING,"Pending"),(CONFIRMED,"Confirmed"),(PREPARING,"Preparing"),
        (READY,"Ready"),(DELIVERED,"Delivered"),(CANCELLED,"Cancelled"),
    ]
    SOURCE_CHOICES = [
        ("kitchen","Kitchen"),("bar","Bar"),("room_service","Room Service"),
        ("restaurant","Restaurant"),("poolside","Pool Side"),("event","Event"),
    ]

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_number        = models.CharField(max_length=20, unique=True, editable=False)
    guest               = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="orders")
    booking             = models.ForeignKey("bookings.Booking", on_delete=models.SET_NULL, null=True, blank=True, related_name="orders")
    room                = models.ForeignKey("rooms.Room", on_delete=models.SET_NULL, null=True, blank=True)
    source              = models.CharField(max_length=20, choices=SOURCE_CHOICES, default="room_service")
    status              = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING, db_index=True)
    special_instructions= models.TextField(blank=True)
    subtotal            = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    delivery_charge     = models.DecimalField(max_digits=8,  decimal_places=2, default=0)
    tax                 = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount        = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_paid             = models.BooleanField(default=False)
    estimated_delivery  = models.DateTimeField(blank=True, null=True)
    delivered_at        = models.DateTimeField(blank=True, null=True)
    prepared_by         = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="prepared_orders")
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "orders"
        ordering = ["-created_at"]

    def __str__(self): return f"Order {self.order_number}"

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = "ORD" + "".join(random.choices(string.digits, k=7))
        super().save(*args, **kwargs)

    def recalculate_totals(self):
        items = self.items.all()
        self.subtotal     = sum(i.total_price for i in items)
        self.tax          = round(self.subtotal * 7.5 / 100, 2)
        self.total_amount = self.subtotal + self.delivery_charge + self.tax
        self.save(update_fields=["subtotal","tax","total_amount"])


class OrderItem(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order          = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    menu_item      = models.ForeignKey(MenuItem, on_delete=models.PROTECT, related_name="order_items")
    quantity       = models.PositiveIntegerField(default=1)
    unit_price     = models.DecimalField(max_digits=10, decimal_places=2)
    total_price    = models.DecimalField(max_digits=10, decimal_places=2, editable=False, default=0)
    customizations = models.TextField(blank=True)
    is_ready       = models.BooleanField(default=False)

    class Meta:
        db_table = "order_items"

    def save(self, *args, **kwargs):
        self.total_price = self.unit_price * self.quantity
        super().save(*args, **kwargs)

    def __str__(self): return f"{self.quantity}× {self.menu_item.name}"
