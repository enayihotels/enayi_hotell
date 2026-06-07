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
    list_filter  = ["hotel", "status", "floor", "category"]
    search_fields = ["room_number"]
    actions = ["mark_available", "mark_maintenance"]

    def mark_available(self, request, queryset):
        updated = queryset.update(status="available")
        self.message_user(request, f"{updated} room(s) marked as available.")
    mark_available.short_description = "Mark selected rooms as Available"

    def mark_maintenance(self, request, queryset):
        updated = queryset.update(status="maintenance")
        self.message_user(request, f"{updated} room(s) marked as under maintenance.")
    mark_maintenance.short_description = "Mark selected rooms as Under Maintenance"


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
