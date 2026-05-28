"""Enayi Hotels — Rooms & Suites Models"""
import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


class Amenity(models.Model):
    CATEGORIES = [
        ("basic", "Basic"), ("tech", "Technology"), ("comfort", "Comfort"),
        ("bathroom", "Bathroom"), ("entertainment", "Entertainment"),
        ("dining", "Dining"), ("security", "Security"),
    ]
    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name     = models.CharField(max_length=100)
    icon     = models.CharField(max_length=100, default="check")
    category = models.CharField(max_length=20, choices=CATEGORIES, default="basic")
    is_premium = models.BooleanField(default=False)

    class Meta:
        db_table = "amenities"
        verbose_name_plural = "Amenities"
        ordering = ["category", "name"]

    def __str__(self): return self.name


class RoomCategory(models.Model):
    BED_TYPES = [
        ("single","Single"),("double","Double"),("queen","Queen"),
        ("king","King"),("twin","Twin"),("suite","Suite"),
    ]
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name            = models.CharField(max_length=100, unique=True)
    slug            = models.SlugField(unique=True)
    tagline         = models.CharField(max_length=200, blank=True)
    description     = models.TextField()
    long_description= models.TextField(blank=True)
    base_price      = models.DecimalField(max_digits=12, decimal_places=2)
    weekend_price   = models.DecimalField(max_digits=12, decimal_places=2)
    holiday_price   = models.DecimalField(max_digits=12, decimal_places=2)
    max_adults      = models.PositiveIntegerField(default=2)
    max_children    = models.PositiveIntegerField(default=1)
    bed_type        = models.CharField(max_length=20, choices=BED_TYPES, default="king")
    num_beds        = models.PositiveIntegerField(default=1)
    room_size_sqm   = models.DecimalField(max_digits=6, decimal_places=1, default=30)
    num_bathrooms   = models.PositiveIntegerField(default=1)
    has_living_room = models.BooleanField(default=False)
    has_kitchen     = models.BooleanField(default=False)
    has_balcony     = models.BooleanField(default=False)
    amenities       = models.ManyToManyField(Amenity, blank=True, related_name="room_categories")
    thumbnail       = models.ImageField(upload_to="rooms/thumbnails/%Y/%m/", blank=True, null=True)
    is_active       = models.BooleanField(default=True, db_index=True)
    sort_order      = models.PositiveIntegerField(default=0)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "room_categories"
        verbose_name = "Room Category"
        verbose_name_plural = "Room Categories"
        ordering = ["sort_order", "base_price"]

    def __str__(self): return self.name

    def price_for(self, hotel):
        """Return the active per-branch price row for `hotel`, or None.

        `hotel` may be a Hotel instance or its id.
        """
        if hotel is None:
            return None
        hotel_id = getattr(hotel, "id", hotel)
        return self.branch_prices.filter(hotel_id=hotel_id, is_active=True).first()

    def get_current_price(self, hotel=None):
        """Today's nightly rate.

        If a `hotel` (branch) is given and a per-branch price exists, that
        branch's rate is used; otherwise it falls back to this category's
        own base/weekend price. Calling it with no argument behaves exactly
        as before, so existing callers keep working unchanged.
        """
        branch_price = self.price_for(hotel)
        if branch_price:
            return branch_price.get_current_price()
        today = timezone.now().weekday()
        return self.weekend_price if today in [4, 5] else self.base_price

    @property
    def avg_rating(self):
        reviews = self.reviews.filter(is_approved=True)
        if not reviews.exists(): return None
        return round(sum(r.rating for r in reviews) / reviews.count(), 1)

    @property
    def available_rooms(self):
        return self.rooms.filter(status="available").count()


class RoomCategoryPrice(models.Model):
    """Per-branch pricing for a shared room category.

    The same room class (e.g. "Deluxe") can cost a different amount at each
    branch without duplicating the category itself.
    """
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel         = models.ForeignKey("hotels.Hotel", on_delete=models.CASCADE, related_name="room_prices")
    category      = models.ForeignKey(RoomCategory, on_delete=models.CASCADE, related_name="branch_prices")
    base_price    = models.DecimalField(max_digits=12, decimal_places=2)
    weekend_price = models.DecimalField(max_digits=12, decimal_places=2)
    holiday_price = models.DecimalField(max_digits=12, decimal_places=2)
    breakfast_price = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                          help_text="Per-night surcharge for complimentary breakfast (0 = included/none)")
    is_active     = models.BooleanField(default=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "room_category_prices"
        verbose_name = "Branch Room Price"
        verbose_name_plural = "Branch Room Prices"
        ordering = ["category__sort_order", "category__name"]
        constraints = [
            models.UniqueConstraint(fields=["hotel", "category"], name="uniq_price_per_branch_category"),
        ]

    def __str__(self):
        return f"{self.category.name} @ {self.hotel} — ₦{self.base_price}"

    def get_current_price(self):
        today = timezone.now().weekday()
        return self.weekend_price if today in [4, 5] else self.base_price

    def price_with_breakfast(self):
        return self.get_current_price() + (self.breakfast_price or 0)


class Room(models.Model):
    STATUSES = [
        ("available","Available"),("occupied","Occupied"),
        ("maintenance","Maintenance"),("reserved","Reserved"),
        ("cleaning","Cleaning"),("out_of_order","Out of Order"),
    ]
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room_number = models.CharField(max_length=10, unique=True)
    hotel       = models.ForeignKey("hotels.Hotel", on_delete=models.PROTECT, related_name="rooms", null=True, blank=True)
    category    = models.ForeignKey(RoomCategory, on_delete=models.PROTECT, related_name="rooms")
    floor       = models.PositiveIntegerField(default=1)
    status      = models.CharField(max_length=20, choices=STATUSES, default="available", db_index=True)
    is_smoking  = models.BooleanField(default=False)
    has_balcony = models.BooleanField(default=False)
    view_type   = models.CharField(max_length=30, choices=[
        ("garden","Garden"),("city","City"),("pool","Pool"),("courtyard","Courtyard"),
    ], default="city")
    notes       = models.TextField(blank=True)
    last_cleaned= models.DateTimeField(blank=True, null=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rooms"
        ordering = ["floor", "room_number"]

    def __str__(self): return f"Room {self.room_number} ({self.category.name})"

    def get_current_price(self):
        """Branch-aware nightly rate for this physical room."""
        return self.category.get_current_price(self.hotel)


class RoomImage(models.Model):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room_category = models.ForeignKey(RoomCategory, on_delete=models.CASCADE, related_name="images")
    image         = models.ImageField(upload_to="rooms/images/%Y/%m/")
    caption       = models.CharField(max_length=300, blank=True)
    is_primary    = models.BooleanField(default=False)
    sort_order    = models.PositiveIntegerField(default=0)
    uploaded_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "room_images"
        ordering = ["-is_primary", "sort_order"]


class RoomReview(models.Model):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room_category = models.ForeignKey(RoomCategory, on_delete=models.CASCADE, related_name="reviews")
    guest         = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True)
    booking       = models.OneToOneField("bookings.Booking", on_delete=models.SET_NULL, null=True, blank=True)
    rating        = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    cleanliness   = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)], default=5)
    comfort       = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)], default=5)
    service       = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)], default=5)
    title         = models.CharField(max_length=200)
    body          = models.TextField()
    is_approved   = models.BooleanField(default=False)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "room_reviews"

    def __str__(self): return f"Review by {self.guest} — {self.rating}/5"
