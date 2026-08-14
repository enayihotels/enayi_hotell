from rest_framework import serializers
from .models import InventoryCategory, InventoryItem, StockBalance


class InventoryCategorySerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = InventoryCategory
        fields = ["id", "name", "slug", "description", "is_active", "item_count"]

    def get_item_count(self, obj):
        return obj.items.filter(is_active=True).count()


class StockBalanceSerializer(serializers.ModelSerializer):
    location_display = serializers.CharField(source="get_location_display", read_only=True)
    is_low = serializers.BooleanField(read_only=True)

    class Meta:
        model = StockBalance
        fields = ["id", "location", "location_display", "quantity", "is_low", "updated_at"]


class InventoryItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    balances = StockBalanceSerializer(many=True, read_only=True)
    # Convenience: total across every location, for a quick "how much do
    # we have of this, anywhere" figure on list views.
    total_quantity = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = [
            "id", "name", "sku", "category", "category_name", "unit", "cost_price",
            "sale_price", "reorder_threshold", "expiry_tracked", "is_active",
            "balances", "total_quantity", "created_at", "updated_at",
        ]
        read_only_fields = ["sku"]

    def get_total_quantity(self, obj):
        return sum(float(b.quantity) for b in obj.balances.all())


class InventoryItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryItem
        fields = [
            "id", "name", "category", "unit", "cost_price", "sale_price",
            "reorder_threshold", "expiry_tracked", "is_active",
        ]
