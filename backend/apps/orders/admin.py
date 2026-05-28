from django.contrib import admin
from .models import MenuCategory, MenuItem, Order, OrderItem

@admin.register(MenuCategory)
class MenuCategoryAdmin(admin.ModelAdmin):
    list_display = ["name","type","is_active","sort_order"]
    list_filter  = ["type","is_active"]

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ["total_price"]

@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ["name","category","price","is_available","is_halal","is_vegetarian","preparation_time"]
    list_filter  = ["category","is_available","is_halal","is_vegetarian","is_vegan","is_spicy"]
    search_fields= ["name","description"]

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["order_number","guest","source","status","total_amount","is_paid","created_at"]
    list_filter  = ["status","source","is_paid"]
    search_fields= ["order_number","guest__email","guest__first_name"]
    readonly_fields = ["order_number","subtotal","tax","total_amount","created_at"]
    inlines = [OrderItemInline]