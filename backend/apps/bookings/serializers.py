"""Enayi Hotels — Bookings Serializers"""
from rest_framework import serializers
from django.utils import timezone
from .models import Booking
from apps.rooms.serializers import RoomSerializer
from apps.accounts.serializers import UserSerializer


class BookingSerializer(serializers.ModelSerializer):
    guest_name  = serializers.SerializerMethodField()
    room_detail = serializers.SerializerMethodField()
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_fully_paid = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Booking
        fields = [
            "id", "booking_reference", "guest", "guest_name", "room", "room_detail",
            "check_in", "check_out", "actual_check_in", "actual_check_out",
            "adults", "children", "status", "source",
            "room_rate_per_night", "total_nights", "subtotal",
            "tax_amount", "discount_amount", "total_amount",
            "amount_paid", "balance_due", "is_fully_paid",
            "special_requests", "breakfast_included", "airport_pickup",
            "late_checkout", "early_checkin",
            "cancellation_reason", "cancelled_at", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "booking_reference", "guest_name", "room_detail",
            "total_nights", "subtotal", "tax_amount", "total_amount",
            "balance_due", "is_fully_paid", "actual_check_in", "actual_check_out",
            "cancelled_at", "created_at", "updated_at",
        ]

    def get_guest_name(self, obj):
        return obj.guest.get_full_name() if obj.guest else ""

    def get_room_detail(self, obj):
        if obj.room:
            return {
                "id":            str(obj.room.id),
                "room_number":   obj.room.room_number,
                "category_name": obj.room.category.name,
                "floor":         obj.room.floor,
                "view_type":     obj.room.view_type,
            }
        return None


class CreateBookingSerializer(serializers.Serializer):
    """Create a booking — auto-assigns an available room in the chosen branch.

    `hotel_id` is the branch (Zaramaganda / Fwawei). When given, the room rate
    is that branch's price for the class, and only rooms at that branch are used.
    It stays optional so older calls that omit it keep working.
    """
    category_id        = serializers.UUIDField()
    hotel_id           = serializers.UUIDField(required=False)
    check_in           = serializers.DateField()
    check_out          = serializers.DateField()
    adults             = serializers.IntegerField(min_value=1, max_value=10, default=1)
    children           = serializers.IntegerField(min_value=0, max_value=5, default=0)
    special_requests   = serializers.CharField(max_length=1000, default="", required=False, allow_blank=True)
    breakfast_included = serializers.BooleanField(default=False, required=False)
    airport_pickup     = serializers.BooleanField(default=False, required=False)
    late_checkout      = serializers.BooleanField(default=False, required=False)
    early_checkin      = serializers.BooleanField(default=False, required=False)

    def validate(self, data):
        today = timezone.now().date()
        if data["check_in"] < today:
            raise serializers.ValidationError({"check_in": "Check-in cannot be in the past."})
        if data["check_in"] >= data["check_out"]:
            raise serializers.ValidationError({"check_out": "Check-out must be after check-in."})
        return data

    def create(self, validated_data):
        from apps.rooms.models import RoomCategory, Room
        from apps.hotels.models import Hotel

        request   = self.context.get("request")
        check_in  = validated_data["check_in"]
        check_out = validated_data["check_out"]

        try:
            category = RoomCategory.objects.get(id=validated_data["category_id"], is_active=True)
        except RoomCategory.DoesNotExist:
            raise serializers.ValidationError({"category_id": "Room class not found."})

        hotel = None
        if validated_data.get("hotel_id"):
            try:
                hotel = Hotel.objects.get(id=validated_data["hotel_id"], is_active=True)
            except Hotel.DoesNotExist:
                raise serializers.ValidationError({"hotel_id": "Branch not found."})

        # Rooms already taken for any overlapping, active booking.
        taken = Booking.objects.filter(
            status__in=["pending", "confirmed", "checked_in"],
            check_in__lt=check_out, check_out__gt=check_in,
        ).values_list("room_id", flat=True)

        rooms = Room.objects.filter(category=category, status="available").exclude(id__in=taken)
        if hotel:
            rooms = rooms.filter(hotel=hotel)
        room = rooms.order_by("floor", "room_number").first()

        if not room:
            where = f" at {hotel.name}" if hotel else ""
            raise serializers.ValidationError(
                {"detail": f"No {category.name} rooms are available{where} for those dates."}
            )

        # Branch-specific nightly rate (falls back to the class default).
        rate = category.get_current_price(hotel or room.hotel)

        booking = Booking.objects.create(
            guest=request.user,
            room=room,
            hotel=hotel or room.hotel,
            check_in=check_in,
            check_out=check_out,
            adults=validated_data.get("adults", 1),
            children=validated_data.get("children", 0),
            special_requests=validated_data.get("special_requests", ""),
            breakfast_included=validated_data.get("breakfast_included", False),
            airport_pickup=validated_data.get("airport_pickup", False),
            late_checkout=validated_data.get("late_checkout", False),
            early_checkin=validated_data.get("early_checkin", False),
            room_rate_per_night=rate,
            status="pending",
        )

        # Hold the room so it shows as occupied right away.
        room.status = "reserved"
        room.save(update_fields=["status"])
        return booking


class CancelBookingSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")