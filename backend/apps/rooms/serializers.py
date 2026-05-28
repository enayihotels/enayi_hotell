"""Enayi Hotels — Rooms Serializers"""
from rest_framework import serializers
from .models import RoomCategory, Room, RoomImage, RoomReview, Amenity


class AmenitySerializer(serializers.ModelSerializer):
    class Meta:
        model  = Amenity
        fields = ["id", "name", "icon", "category", "is_premium"]


class RoomImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model  = RoomImage
        fields = ["id", "image_url", "caption", "is_primary", "sort_order"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url if obj.image else None


class RoomReviewSerializer(serializers.ModelSerializer):
    guest_name = serializers.SerializerMethodField()

    class Meta:
        model  = RoomReview
        fields = [
            "id", "guest_name", "rating", "cleanliness", "comfort",
            "service", "title", "body", "created_at",
        ]
        read_only_fields = ["id", "guest_name", "created_at"]

    def get_guest_name(self, obj):
        if obj.guest:
            return obj.guest.get_full_name()
        return "Anonymous Guest"


class RoomCategorySerializer(serializers.ModelSerializer):
    amenities       = AmenitySerializer(many=True, read_only=True)
    images          = RoomImageSerializer(many=True, read_only=True)
    avg_rating      = serializers.FloatField(read_only=True)
    available_rooms = serializers.IntegerField(read_only=True)
    current_price   = serializers.SerializerMethodField()
    branch_prices   = serializers.SerializerMethodField()

    class Meta:
        model  = RoomCategory
        fields = [
            "id", "name", "slug", "tagline", "description", "long_description",
            "base_price", "weekend_price", "holiday_price", "current_price",
            "branch_prices",
            "max_adults", "max_children", "bed_type", "num_beds", "room_size_sqm",
            "num_bathrooms", "has_living_room", "has_kitchen", "has_balcony",
            "amenities", "images", "avg_rating", "available_rooms", "sort_order",
        ]

    def get_current_price(self, obj):
        # Optional ?hotel=<id|branch> narrows the price to a branch.
        return str(obj.get_current_price(self._requested_hotel(obj)))

    def get_branch_prices(self, obj):
        out = []
        for bp in obj.branch_prices.filter(is_active=True).select_related("hotel"):
            out.append({
                "hotel":          str(bp.hotel_id),
                "branch":         bp.hotel.branch,
                "branch_name":    bp.hotel.name,
                "base_price":     str(bp.base_price),
                "weekend_price":  str(bp.weekend_price),
                "holiday_price":  str(bp.holiday_price),
                "breakfast_price": str(bp.breakfast_price),
                "current_price":  str(bp.get_current_price()),
                "current_price_with_breakfast": str(bp.price_with_breakfast()),
            })
        return out

    def _requested_hotel(self, obj):
        """Resolve ?hotel=<uuid|branch-slug> from the request, if present.

        Lets the front page request a single branch's price, e.g.
        /api/v1/rooms/categories/?hotel=fwawei. Without it, the category's
        own default price is used (unchanged behaviour).
        """
        from django.db.models import Q
        request = self.context.get("request")
        if not request:
            return None
        params = getattr(request, "query_params", None) or getattr(request, "GET", {})
        key = params.get("hotel") or params.get("branch")
        if not key:
            return None
        lookup = Q(hotel__branch=key)
        try:
            import uuid as _uuid
            lookup |= Q(hotel_id=_uuid.UUID(str(key)))
        except (ValueError, AttributeError, TypeError):
            pass
        bp = (obj.branch_prices.filter(is_active=True)
                 .select_related("hotel")
                 .filter(lookup)
                 .first())
        return bp.hotel if bp else None


class RoomCategoryWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = RoomCategory
        fields = [
            "name", "slug", "tagline", "description", "long_description",
            "base_price", "weekend_price", "holiday_price",
            "max_adults", "max_children", "bed_type", "num_beds", "room_size_sqm",
            "num_bathrooms", "has_living_room", "has_kitchen", "has_balcony",
            "is_active", "sort_order",
        ]


class RoomSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    branch_name   = serializers.CharField(source="hotel.name", read_only=True, default=None)
    branch        = serializers.CharField(source="hotel.branch", read_only=True, default=None)
    current_price = serializers.SerializerMethodField()

    class Meta:
        model  = Room
        fields = [
            "id", "room_number", "hotel", "branch", "branch_name",
            "category", "category_name", "floor",
            "status", "is_smoking", "has_balcony", "view_type",
            "current_price", "last_cleaned",
        ]

    def get_current_price(self, obj):
        return str(obj.get_current_price())


class AvailabilityCheckSerializer(serializers.Serializer):
    check_in    = serializers.DateField()
    check_out   = serializers.DateField()
    adults      = serializers.IntegerField(min_value=1, max_value=10, default=1)
    children    = serializers.IntegerField(min_value=0, max_value=5, default=0)
    category_id = serializers.UUIDField(required=False)
    hotel_id    = serializers.UUIDField(required=False)

    def validate(self, data):
        from django.utils import timezone
        if data["check_in"] >= data["check_out"]:
            raise serializers.ValidationError("Check-out must be after check-in.")
        if data["check_in"] < timezone.now().date():
            raise serializers.ValidationError("Check-in cannot be in the past.")
        return data
