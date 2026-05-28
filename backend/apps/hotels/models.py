"""Enayi Hotels — Branches / Properties

A `Hotel` is a physical branch of Enayi Hotels & Suites.
Currently two branches exist: Zaramaganda and Fwawei.
Room *classes* (RoomCategory) are shared across branches, but each branch
prices them independently — see apps.rooms.models.RoomCategoryPrice.
"""
import uuid
from django.db import models


class Hotel(models.Model):
    ZARAMAGANDA = "zaramaganda"
    FWAWEI      = "fwawei"
    BRANCHES = [
        (ZARAMAGANDA, "Zaramaganda"),
        (FWAWEI,      "Fwawei"),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=120)                       # "Enayi Hotels & Suites — Fwawei"
    branch      = models.CharField(max_length=20, choices=BRANCHES, unique=True)
    slug        = models.SlugField(unique=True)
    tagline     = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    address     = models.CharField(max_length=255, blank=True)
    city        = models.CharField(max_length=80, default="Jos")
    state       = models.CharField(max_length=80, default="Plateau State")
    phone       = models.CharField(max_length=30, blank=True)
    email       = models.EmailField(blank=True)
    whatsapp    = models.CharField(max_length=30, blank=True)
    latitude    = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude   = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    cover_image = models.ImageField(upload_to="hotels/covers/%Y/%m/", blank=True, null=True)
    is_active   = models.BooleanField(default=True, db_index=True)
    is_primary  = models.BooleanField(default=False, help_text="Featured / default branch on the public site")
    sort_order  = models.PositiveIntegerField(default=0)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hotels"
        verbose_name = "Hotel Branch"
        verbose_name_plural = "Hotel Branches"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name or self.get_branch_display()


class HotelImage(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel       = models.ForeignKey(Hotel, on_delete=models.CASCADE, related_name="images")
    image       = models.ImageField(upload_to="hotels/gallery/%Y/%m/")
    caption     = models.CharField(max_length=300, blank=True)
    is_cover    = models.BooleanField(default=False, help_text="Use as the branch's headline photo")
    sort_order  = models.PositiveIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "hotel_images"
        ordering = ["-is_cover", "sort_order", "uploaded_at"]

    def __str__(self):
        return self.caption or f"Image for {self.hotel}"
