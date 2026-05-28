from django.contrib import admin
from .models import EventHall, EventHallImage, EventBooking

class EventHallImageInline(admin.TabularInline):
    model = EventHallImage
    extra = 1

@admin.register(EventHall)
class EventHallAdmin(admin.ModelAdmin):
    list_display = ["name","capacity_seated","price_full_day","is_active","sort_order"]
    list_filter  = ["is_active","has_stage","has_dance_floor"]
    prepopulated_fields = {"slug":("name",)}
    inlines = [EventHallImageInline]

@admin.register(EventBooking)
class EventBookingAdmin(admin.ModelAdmin):
    list_display = ["booking_reference","event_name","event_type","organizer","hall","event_date","status","total_amount","amount_paid"]
    list_filter  = ["status","event_type"]
    search_fields= ["booking_reference","event_name","organizer__email"]
    readonly_fields = ["booking_reference","hall_rate","extras_cost","tax_amount","total_amount","deposit_amount","created_at"]
    date_hierarchy = "event_date"