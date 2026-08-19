from rest_framework import serializers
from .models import InventoryCategory, InventoryItem, StockBalance, StockRequisition


class InventoryCategorySerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()
    hotel_name = serializers.CharField(source="hotel.name", read_only=True)

    class Meta:
        model = InventoryCategory
        fields = ["id", "hotel", "hotel_name", "name", "slug", "description", "department", "is_active", "item_count"]
        read_only_fields = ["hotel"]

    def get_item_count(self, obj):
        return obj.items.filter(is_active=True).count()


class StockBalanceSerializer(serializers.ModelSerializer):
    location_display = serializers.CharField(source="get_location_display", read_only=True)
    hotel_name = serializers.CharField(source="hotel.name", read_only=True)
    hotel_branch = serializers.CharField(source="hotel.branch", read_only=True)
    is_low = serializers.BooleanField(read_only=True)

    class Meta:
        model = StockBalance
        fields = ["id", "hotel", "hotel_name", "hotel_branch", "location", "location_display", "quantity", "is_low", "updated_at"]


class InventoryItemSerializer(serializers.ModelSerializer):
    category_name       = serializers.CharField(source="category.name", read_only=True)
    # Include the category's department tag so the frontend can filter items
    # by location-to-department mapping (e.g. "Bar only" shows only items
    # whose category is tagged department='bar') without a second API call.
    category_department = serializers.CharField(source="category.department", read_only=True)
    hotel_name          = serializers.CharField(source="hotel.name", read_only=True)
    balances            = serializers.SerializerMethodField()
    # Convenience: total across every location AT THE VISIBLE BRANCH(ES)
    # ONLY — a branch-scoped user must never see a number that secretly
    # includes another branch's stock folded in.
    total_quantity      = serializers.SerializerMethodField()
    on_guest_menu       = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = [
            "id", "hotel", "hotel_name", "name", "sku", "category", "category_name",
            "category_department", "unit", "cost_price",
            "sale_price", "reorder_threshold", "expiry_tracked", "is_active",
            "balances", "total_quantity", "on_guest_menu", "created_at", "updated_at",
        ]
        read_only_fields = ["sku", "hotel"]

    def _visible_balances(self, obj):
        from .views import _effective_hotel
        request = self.context.get("request")
        if not request:
            return obj.balances.none()
        hotel_id = self.context.get("hotel_override") or request.query_params.get("hotel")
        effective = _effective_hotel(request.user, hotel_id)
        if effective is False:
            return obj.balances.none()  # branch-requiring role, no branch assigned yet
        if effective is None and request.user.role != "admin":
            return obj.balances.none()
        qs = obj.balances.all()
        if effective:
            qs = qs.filter(hotel_id=effective)
        return qs

    def get_balances(self, obj):
        return StockBalanceSerializer(self._visible_balances(obj), many=True).data

    def get_total_quantity(self, obj):
        return sum(float(b.quantity) for b in self._visible_balances(obj))

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
    hotel_name = serializers.CharField(source="hotel.name", read_only=True)
    store_available = serializers.SerializerMethodField()

    class Meta:
        model = StockRequisition
        fields = [
            "id", "item", "item_name", "item_unit", "item_sku", "hotel", "hotel_name",
            "destination", "destination_display",
            "quantity_requested", "quantity_fulfilled", "status", "status_display",
            "requested_by", "requested_by_name", "note_from_requester",
            "decided_by", "decided_by_name", "note_from_fulfiller", "decided_at",
            "store_available", "created_at",
        ]
        read_only_fields = ["status", "quantity_fulfilled", "decided_by", "note_from_fulfiller", "decided_at", "requested_by", "hotel"]

    def get_decided_by_name(self, obj):
        return obj.decided_by.get_full_name() if obj.decided_by_id else None

    def get_store_available(self, obj):
        # Must match the SAME branch as the requisition itself — the store
        # could easily have stock at the OTHER branch too, and showing that
        # number here would be actively misleading about what's actually
        # available to fulfill this specific request.
        bal = obj.item.balances.filter(location=StockBalance.STORE, hotel_id=obj.hotel_id).first()
        return float(bal.quantity) if bal else 0
