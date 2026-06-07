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
    """Create a booking — auto-assigns an available room in the chosen branch."""
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
        import re
        from apps.rooms.models import RoomCategory, Room
        from apps.hotels.models import Hotel

        request   = self.context.get("request")
        check_in  = validated_data["check_in"]
        check_out = validated_data["check_out"]

        # Resolve category
        try:
            category = RoomCategory.objects.get(
                id=validated_data["category_id"], is_active=True
            )
        except RoomCategory.DoesNotExist:
            raise serializers.ValidationError({"category_id": "Room class not found."})

        # Resolve hotel/branch
        hotel = None
        if validated_data.get("hotel_id"):
            try:
                hotel = Hotel.objects.get(
                    id=validated_data["hotel_id"], is_active=True
                )
            except Hotel.DoesNotExist:
                raise serializers.ValidationError({"hotel_id": "Branch not found."})

        # Find all equivalent category IDs (handles duplicate names like
        # "STANDARD ROOM FWAWEI" and "STANDARD ROOM ZARAMAGANDA")
        BRANCH_WORDS = ["zaramaganda", "fwawei", "fwavei"]

        def strip_branch(name):
            n = name
            for w in BRANCH_WORDS:
                n = re.sub(w, "", n, flags=re.IGNORECASE)
            return re.sub(r"\s+", " ", n).strip().lower()

        target_clean = strip_branch(category.name)
        equiv_ids = [
            c.id for c in RoomCategory.objects.filter(is_active=True)
            if strip_branch(c.name) == target_clean
        ]
        if category.id not in equiv_ids:
            equiv_ids.append(category.id)

        # Rooms with active overlapping bookings (genuinely taken)
        taken = set(Booking.objects.filter(
            status__in=["pending", "confirmed", "checked_in"],
            check_in__lt=check_out,
            check_out__gt=check_in,
        ).values_list("room_id", flat=True))

        # Auto-reset stale "reserved" rooms at this hotel that have no
        # active booking — fixes the free-tier sleep/wake issue
        if hotel:
            all_active = set(Booking.objects.filter(
                status__in=["pending", "confirmed", "checked_in"],
            ).values_list("room_id", flat=True))
            Room.objects.filter(
                hotel=hotel,
                status="reserved",
            ).exclude(id__in=all_active).update(status="available")

        # Build base queryset: correct category + not taken
        base_qs = Room.objects.filter(
            category_id__in=equiv_ids,
        ).exclude(id__in=taken)

        if hotel:
            base_qs = base_qs.filter(hotel=hotel)

        # Tier 1: available rooms
        room = base_qs.filter(
            status="available"
        ).order_by("floor", "room_number").first()

        # Tier 2: any non-maintenance room (catches cleaning/stale-reserved)
        if not room:
            room = base_qs.exclude(
                status__in=["occupied", "maintenance"]
            ).order_by("floor", "room_number").first()

        # Tier 3: broaden search across all hotel rooms with matching category
        if not room and hotel:
            room = Room.objects.filter(
                hotel=hotel,
                category_id__in=equiv_ids,
            ).exclude(id__in=taken).exclude(
                status__in=["occupied", "maintenance"]
            ).order_by("floor", "room_number").first()

        if not room:
            clean_cat = strip_branch(category.name).title()
            where = f" at {hotel.name}" if hotel else ""
            raise serializers.ValidationError(
                {"detail": (
                    f"No {clean_cat} rooms are currently available{where}. "
                    "Please try different dates or contact us directly."
                )}
            )

        # Get branch-specific rate
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

        room.status = "reserved"
        room.save(update_fields=["status"])
        return booking


class CancelBookingSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
