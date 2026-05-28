"""Enayi Hotels — Events Serializers"""
from rest_framework import serializers
from .models import EventHall, EventHallImage, EventBooking


class EventHallImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model  = EventHallImage
        fields = ["id", "image_url", "caption", "is_primary", "sort_order"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url if obj.image else None


class EventHallSerializer(serializers.ModelSerializer):
    images = EventHallImageSerializer(many=True, read_only=True)

    class Meta:
        model  = EventHall
        fields = [
            "id", "name", "slug", "description",
            "capacity_seated", "capacity_cocktail", "capacity_banquet",
            "size_sqm", "floor",
            "price_per_hour", "price_half_day", "price_full_day", "price_weekend",
            "deposit_percent",
            "has_projector", "has_sound_system", "has_microphone", "has_wifi",
            "has_ac", "has_stage", "has_dance_floor", "has_parking",
            "images",
        ]


class EventBookingSerializer(serializers.ModelSerializer):
    organizer_name = serializers.SerializerMethodField()
    hall_name      = serializers.CharField(source="hall.name", read_only=True)
    balance_due    = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model  = EventBooking
        fields = [
            "id", "booking_reference", "organizer", "organizer_name",
            "hall", "hall_name",
            "event_name", "event_type", "event_date", "start_time", "end_time", "setup_time",
            "expected_guests", "setup_style",
            "catering_required", "catering_notes", "decoration_required",
            "photography_required", "mc_required", "live_band_required", "dj_required",
            "special_requests", "contact_phone", "contact_email",
            "hall_rate", "extras_cost", "catering_cost", "tax_amount",
            "discount_amount", "total_amount", "deposit_amount", "amount_paid", "balance_due",
            "status", "notes", "cancelled_at", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "booking_reference", "organizer", "organizer_name", "hall_name",
            "hall_rate", "extras_cost", "tax_amount", "total_amount", "deposit_amount",
            "balance_due", "cancelled_at", "created_at", "updated_at",
        ]

    def get_organizer_name(self, obj):
        return obj.organizer.get_full_name() if obj.organizer else ""


class CreateEventBookingSerializer(serializers.Serializer):
    hall_id              = serializers.UUIDField()
    event_name           = serializers.CharField(max_length=300)
    event_type           = serializers.ChoiceField(choices=[
        "wedding","corporate","birthday","graduation","naming","burial","product_launch","concert","custom"
    ])
    event_date           = serializers.DateField()
    start_time           = serializers.TimeField()
    end_time             = serializers.TimeField()
    setup_time           = serializers.TimeField()
    expected_guests      = serializers.IntegerField(min_value=1)
    setup_style          = serializers.ChoiceField(choices=["theatre","classroom","banquet","boardroom","cocktail","u_shape"], default="theatre")
    catering_required    = serializers.BooleanField(default=False, required=False)
    catering_notes       = serializers.CharField(default="", required=False, allow_blank=True)
    decoration_required  = serializers.BooleanField(default=False, required=False)
    photography_required = serializers.BooleanField(default=False, required=False)
    mc_required          = serializers.BooleanField(default=False, required=False)
    live_band_required   = serializers.BooleanField(default=False, required=False)
    dj_required          = serializers.BooleanField(default=False, required=False)
    special_requests     = serializers.CharField(default="", required=False, allow_blank=True)
    contact_phone        = serializers.CharField(max_length=20, default="", required=False, allow_blank=True)
    contact_email        = serializers.EmailField(required=False, allow_blank=True, default="")

    def validate(self, data):
        from django.utils import timezone
        if data["event_date"] < timezone.now().date():
            raise serializers.ValidationError({"event_date": "Event date cannot be in the past."})
        if data["start_time"] >= data["end_time"]:
            raise serializers.ValidationError({"end_time": "End time must be after start time."})
        return data


class EventAvailabilitySerializer(serializers.Serializer):
    event_date = serializers.DateField()
    hall_id    = serializers.UUIDField(required=False)