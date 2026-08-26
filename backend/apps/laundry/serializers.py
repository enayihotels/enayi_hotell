from rest_framework import serializers
from .models import LaundryPriceItem, LaundryTicket, LaundryTicketItem


class LaundryPriceItemSerializer(serializers.ModelSerializer):
    """Read/write for the price catalog. hotel is set server-side in
    the view, never taken from the request body for non-Admin roles."""

    class Meta:
        model = LaundryPriceItem
        fields = ["id", "name", "price", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Price can't be negative.")
        return value


class LaundryTicketItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = LaundryTicketItem
        fields = ["id", "price_item", "item_name", "unit_price", "quantity", "line_total"]
        read_only_fields = ["id", "item_name", "unit_price", "line_total"]


class LaundryTicketSerializer(serializers.ModelSerializer):
    """Read serializer — what the ticket list/detail actually shows."""
    room_number    = serializers.CharField(source="room.room_number", read_only=True, default=None)
    logged_by_name = serializers.CharField(source="logged_by.get_full_name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    line_items     = LaundryTicketItemSerializer(many=True, read_only=True)

    class Meta:
        model = LaundryTicket
        fields = [
            "id", "room", "room_number", "guest_name", "guest_email", "guest_phone",
            "notes", "total_price", "status", "status_display", "line_items",
            "logged_by_name", "notified", "created_at", "ready_at",
        ]
        read_only_fields = ["id", "total_price", "status", "notified", "created_at", "ready_at"]


class LaundryTicketWriteSerializer(serializers.ModelSerializer):
    """Create serializer. Body shape:
        {
          "room": "<uuid or null>",
          "guest_name": "...", "guest_email": "...", "guest_phone": "...",
          "notes": "...",
          "items": [{"price_item": "<uuid>", "quantity": 3}, ...]
        }
    `items` must reference this branch's own LaundryPriceItem rows —
    total_price and each line's name/unit_price snapshot are computed
    server-side from the catalog, never trusted from the client."""
    items = serializers.ListField(child=serializers.DictField(), write_only=True, allow_empty=False)

    class Meta:
        model = LaundryTicket
        fields = ["room", "guest_name", "guest_email", "guest_phone", "notes", "items"]

    def validate_items(self, value):
        for line in value:
            if "price_item" not in line or "quantity" not in line:
                raise serializers.ValidationError("Each item needs a price_item id and a quantity.")
            try:
                qty = int(line["quantity"])
            except (TypeError, ValueError):
                raise serializers.ValidationError("quantity must be a whole number.")
            if qty < 1:
                raise serializers.ValidationError("quantity must be at least 1.")
        return value
