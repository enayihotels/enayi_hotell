from django.contrib import admin
from .models import Booking, CheckoutApprovalRequest

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ["booking_reference","guest","room","check_in","check_out","status","total_amount","amount_paid","is_fully_paid"]
    list_filter  = ["status","source","breakfast_included"]
    search_fields= ["booking_reference","guest__email","guest__first_name","guest__last_name","room__room_number"]
    readonly_fields = ["booking_reference","total_nights","subtotal","tax_amount","total_amount","created_at","updated_at"]
    date_hierarchy = "check_in"
    ordering = ["-created_at"]


@admin.register(CheckoutApprovalRequest)
class CheckoutApprovalRequestAdmin(admin.ModelAdmin):
    list_display = ["booking","requested_by","balance_due_at_request","status","decided_by","decided_at","created_at"]
    list_filter  = ["status"]
    search_fields = ["booking__booking_reference","requested_by__email","decided_by__email"]
    readonly_fields = ["id","booking","requested_by","balance_due_at_request","created_at"]
    ordering = ["-created_at"]