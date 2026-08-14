from django.contrib import admin
from .models import InventoryCategory, InventoryItem, StockBalance


@admin.register(InventoryCategory)
class InventoryCategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "is_active", "created_at"]
    search_fields = ["name", "slug"]
    list_filter = ["is_active"]


class StockBalanceInline(admin.TabularInline):
    model = StockBalance
    extra = 0
    readonly_fields = ["location", "updated_at"]


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ["name", "sku", "category", "unit", "cost_price", "sale_price", "reorder_threshold", "is_active"]
    search_fields = ["name", "sku"]
    list_filter = ["category", "is_active", "expiry_tracked"]
    inlines = [StockBalanceInline]


@admin.register(StockBalance)
class StockBalanceAdmin(admin.ModelAdmin):
    list_display = ["item", "location", "quantity", "is_low", "updated_at"]
    search_fields = ["item__name", "item__sku"]
    list_filter = ["location"]
