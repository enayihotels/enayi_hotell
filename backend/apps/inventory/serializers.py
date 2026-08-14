from rest_framework import serializers
from .models import InventoryCategory, InventoryItem, StockBalance, StockRequisition


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
    on_guest_menu = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = [
            "id", "name", "sku", "category", "category_name", "unit", "cost_price",
            "sale_price", "reorder_threshold", "expiry_tracked", "is_active",
            "balances", "total_quantity", "on_guest_menu", "created_at", "updated_at",
        ]
        read_only_fields = ["sku"]

    def get_total_quantity(self, obj):
        return sum(float(b.quantity) for b in obj.balances.all())

    def get_on_guest_menu(self, obj):
        return obj.menu_items.exists()


class InventoryItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryItem
        fields = [
            "id", "name", "category", "unit", "cost_price", "sale_price",
            "reorder_threshold", "expiry_tracked", "is_active",
        ]


class StockRequisitionSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_unit = serializers.CharField(source="item.unit", read_only=True)
    item_sku = serializers.CharField(source="item.sku", read_only=True)
    destination_display = serializers.CharField(source="get_destination_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    requested_by_name = serializers.CharField(source="requested_by.get_full_name", read_only=True)
    decided_by_name = serializers.SerializerMethodField()
    store_available = serializers.SerializerMethodField()

    class Meta:
        model = StockRequisition
        fields = [
            "id", "item", "item_name", "item_unit", "item_sku", "destination", "destination_display",
            "quantity_requested", "quantity_fulfilled", "status", "status_display",
            "requested_by", "requested_by_name", "note_from_requester",
            "decided_by", "decided_by_name", "note_from_fulfiller", "decided_at",
            "store_available", "created_at",
        ]
        read_only_fields = ["status", "quantity_fulfilled", "decided_by", "note_from_fulfiller", "decided_at", "requested_by"]

    def get_decided_by_name(self, obj):
        return obj.decided_by.get_full_name() if obj.decided_by_id else None

    def get_store_available(self, obj):
        bal = obj.item.balances.filter(location=StockBalance.STORE).first()
        return float(bal.quantity) if bal else 0
