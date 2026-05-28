"""Enayi Hotels — Orders Serializers"""
from rest_framework import serializers
from .models import MenuCategory, MenuItem, Order, OrderItem


class MenuCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model  = MenuCategory
        fields = ["id", "name", "type", "icon", "description", "is_active", "sort_order"]


class MenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_type = serializers.CharField(source="category.type", read_only=True)
    image_url     = serializers.SerializerMethodField()

    class Meta:
        model  = MenuItem
        fields = [
            "id", "category", "category_name", "category_type",
            "name", "description", "price", "image_url",
            "is_available", "is_vegetarian", "is_vegan", "is_halal",
            "is_gluten_free", "is_spicy", "allergens", "calories",
            "preparation_time", "sort_order",
        ]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None


class OrderItemSerializer(serializers.ModelSerializer):
    menu_item_name  = serializers.CharField(source="menu_item.name", read_only=True)
    menu_item_price = serializers.DecimalField(source="menu_item.price", max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model  = OrderItem
        fields = [
            "id", "menu_item", "menu_item_name", "menu_item_price",
            "quantity", "unit_price", "total_price", "customizations", "is_ready",
        ]
        read_only_fields = ["id", "total_price", "is_ready"]


class OrderItemCreateSerializer(serializers.Serializer):
    menu_item      = serializers.UUIDField()
    quantity       = serializers.IntegerField(min_value=1, max_value=20)
    customizations = serializers.CharField(max_length=500, default="", required=False, allow_blank=True)


class OrderSerializer(serializers.ModelSerializer):
    items      = OrderItemSerializer(many=True, read_only=True)
    guest_name = serializers.SerializerMethodField()
    room_number= serializers.SerializerMethodField()

    class Meta:
        model  = Order
        fields = [
            "id", "order_number", "guest", "guest_name", "room", "room_number",
            "source", "status", "items", "special_instructions",
            "subtotal", "delivery_charge", "tax", "total_amount",
            "is_paid", "estimated_delivery", "delivered_at",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "order_number", "guest", "guest_name", "room_number",
            "subtotal", "tax", "total_amount", "created_at", "updated_at",
        ]

    def get_guest_name(self, obj):
        return obj.guest.get_full_name() if obj.guest else ""

    def get_room_number(self, obj):
        return obj.room.room_number if obj.room else None


class CreateOrderSerializer(serializers.Serializer):
    source               = serializers.ChoiceField(
        choices=["kitchen","bar","room_service","restaurant","poolside","event"],
        default="room_service",
    )
    items                = OrderItemCreateSerializer(many=True)
    special_instructions = serializers.CharField(max_length=1000, default="", required=False, allow_blank=True)
    room_id              = serializers.UUIDField(required=False)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("At least one item is required.")
        return items


class UpdateOrderStatusSerializer(serializers.Serializer):
    STATUS_CHOICES = ["pending","confirmed","preparing","ready","delivered","cancelled"]
    status = serializers.ChoiceField(choices=STATUS_CHOICES)