from django.contrib import admin
from .models import Booking

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ["booking_reference","guest","room","check_in","check_out","status","total_amount","amount_paid","is_fully_paid"]
    list_filter  = ["status","source","breakfast_included"]
    search_fields= ["booking_reference","guest__email","guest__first_name","guest__last_name","room__room_number"]
    readonly_fields = ["booking_reference","total_nights","subtotal","tax_amount","total_amount","created_at","updated_at"]
    date_hierarchy = "check_in"
    ordering = ["-created_at"]