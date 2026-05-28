from django.contrib import admin
from .models import Hotel, HotelImage


class HotelImageInline(admin.TabularInline):
    model = HotelImage
    extra = 1
    fields = ["image", "caption", "is_cover", "sort_order"]


class HotelAdmin(admin.ModelAdmin):
    list_display  = ["name", "branch", "city", "is_primary", "is_active", "sort_order"]
    list_filter   = ["is_active", "is_primary", "branch"]
    search_fields = ["name", "address"]
    prepopulated_fields = {"slug": ("name",)}
    inlines = [HotelImageInline]


try:
    admin.site.unregister(Hotel)
except admin.sites.NotRegistered:
    pass
admin.site.register(Hotel, HotelAdmin)
