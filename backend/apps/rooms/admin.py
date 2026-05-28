from django.contrib import admin
from .models import Amenity, RoomCategory, Room, RoomImage, RoomReview, RoomCategoryPrice


class RoomImageInline(admin.TabularInline):
    model = RoomImage
    extra = 1
    fields = ["image", "caption", "is_primary", "sort_order"]


class RoomCategoryPriceInline(admin.TabularInline):
    model = RoomCategoryPrice
    extra = 0
    fields = ["hotel", "base_price", "weekend_price", "holiday_price", "breakfast_price", "is_active"]


class AmenityAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "is_premium"]
    list_filter = ["category", "is_premium"]


class RoomCategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "base_price", "weekend_price", "max_adults", "available_rooms", "is_active", "sort_order"]
    list_filter = ["is_active", "bed_type"]
    prepopulated_fields = {"slug": ("name",)}
    inlines = [RoomCategoryPriceInline, RoomImageInline]
    filter_horizontal = ["amenities"]


class RoomAdmin(admin.ModelAdmin):
    list_display = ["room_number", "hotel", "category", "floor", "status", "has_balcony", "view_type"]
    list_filter = ["hotel", "status", "floor", "category"]
    search_fields = ["room_number"]


class RoomCategoryPriceAdmin(admin.ModelAdmin):
    list_display = ["category", "hotel", "base_price", "weekend_price", "holiday_price", "breakfast_price", "is_active"]
    list_filter = ["hotel", "is_active"]
    search_fields = ["category__name"]


class RoomReviewAdmin(admin.ModelAdmin):
    list_display = ["room_category", "guest", "rating", "is_approved", "created_at"]
    list_filter = ["is_approved", "rating"]
    actions = ["approve_reviews"]

    def approve_reviews(self, request, qs):
        qs.update(is_approved=True)

    approve_reviews.short_description = "Approve selected reviews"


for model, admin_class in [
    (Amenity, AmenityAdmin),
    (RoomCategory, RoomCategoryAdmin),
    (Room, RoomAdmin),
    (RoomCategoryPrice, RoomCategoryPriceAdmin),
    (RoomReview, RoomReviewAdmin),
]:
    try:
        admin.site.unregister(model)
    except admin.sites.NotRegistered:
        pass

    admin.site.register(model, admin_class)
