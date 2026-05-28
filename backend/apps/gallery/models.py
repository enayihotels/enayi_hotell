"""Enayi Hotels — Gallery & Media"""
import uuid
from django.db import models


class GalleryCategory(models.Model):
    TYPES = [
        ("lobby","Lobby & Reception"),("rooms","Rooms & Suites"),
        ("restaurant","Restaurant & Dining"),("bar","Bar & Lounge"),
        ("events","Event Halls"),("pool","Swimming Pool"),
        ("exterior","Hotel Exterior"),("spa","Spa & Wellness"),
        ("amenities","Amenities"),("surroundings","Jos Surroundings"),
    ]
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name          = models.CharField(max_length=100)
    slug          = models.SlugField(unique=True)
    category_type = models.CharField(max_length=20, choices=TYPES)
    description   = models.TextField(blank=True)
    is_active     = models.BooleanField(default=True)
    sort_order    = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "gallery_categories"
        verbose_name_plural = "Gallery Categories"
        ordering = ["sort_order", "name"]

    def __str__(self): return self.name


class GalleryImage(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category     = models.ForeignKey(GalleryCategory, on_delete=models.PROTECT, related_name="images")
    title        = models.CharField(max_length=200, blank=True)
    description  = models.TextField(blank=True)
    image        = models.ImageField(upload_to="gallery/%Y/%m/")
    alt_text     = models.CharField(max_length=300, blank=True)
    is_featured  = models.BooleanField(default=False, help_text="Show on homepage hero")
    is_active    = models.BooleanField(default=True)
    sort_order   = models.PositiveIntegerField(default=0)
    uploaded_by  = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, related_name="gallery_uploads")
    width        = models.PositiveIntegerField(blank=True, null=True)
    height       = models.PositiveIntegerField(blank=True, null=True)
    file_size_kb = models.PositiveIntegerField(blank=True, null=True)
    uploaded_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gallery_images"
        ordering = ["-is_featured", "sort_order", "-uploaded_at"]

    def __str__(self): return self.title or f"Image {self.id}"

    def save(self, *args, **kwargs):
        if self.image and not self.width:
            try:
                from PIL import Image as PILImage
                img = PILImage.open(self.image)
                self.width, self.height = img.size
                self.file_size_kb = self.image.size // 1024
            except Exception:
                pass
        super().save(*args, **kwargs)
