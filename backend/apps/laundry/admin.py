from django.contrib import admin
from .models import LaundryPriceItem, LaundryTicket, LaundryTicketItem


@admin.register(LaundryPriceItem)
class LaundryPriceItemAdmin(admin.ModelAdmin):
    list_display = ["name", "hotel", "price", "is_active", "created_at"]
    list_filter = ["hotel", "is_active"]
    search_fields = ["name"]


class LaundryTicketItemInline(admin.TabularInline):
    model = LaundryTicketItem
    extra = 0
    readonly_fields = ["item_name", "unit_price", "quantity"]
    can_delete = False


@admin.register(LaundryTicket)
class LaundryTicketAdmin(admin.ModelAdmin):
    list_display = ["guest_name", "hotel", "room", "status", "total_price", "created_at", "ready_at"]
    list_filter = ["status", "hotel"]
    search_fields = ["guest_name", "guest_email", "guest_phone"]
    inlines = [LaundryTicketItemInline]
