
from django.utils import timezone

from rest_framework import generics, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser

from .models import EventHall, EventHallImage, EventBooking
from .serializers import (
    EventHallSerializer,
    EventBookingSerializer,
    CreateEventBookingSerializer,
    EventAvailabilitySerializer,
    EventHallImageSerializer,
)


class EventHallListView(generics.ListCreateAPIView):
    """Public GET for guests browsing halls; staff-only POST to add a new hall."""
    permission_classes = [AllowAny]

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

    def get_serializer_class(self):
        return EventHallSerializer

    def get_queryset(self):
        qs = EventHall.objects.prefetch_related("images").order_by("sort_order")
        if self.request.method == "GET" and not (self.request.user.is_authenticated and self.request.user.is_hotel_staff):
            qs = qs.filter(is_active=True)
        return qs

    def create(self, request, *args, **kwargs):
        if request.user.role not in ["manager","admin"]:
            return Response({"error": "Staff only."}, status=403)
        from django.utils.text import slugify
        data = request.data.copy()
        if not data.get("slug") and data.get("name"):
            data["slug"] = slugify(data["name"])
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        hall = serializer.save()
        return Response(EventHallSerializer(hall).data, status=201)


class EventHallDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Public GET by slug; staff-only PATCH/DELETE."""
    serializer_class = EventHallSerializer
    lookup_field = "slug"

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

    def get_queryset(self):
        qs = EventHall.objects.prefetch_related("images")
        if self.request.method == "GET" and not (self.request.user.is_authenticated and self.request.user.is_hotel_staff):
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_context(self):
        return {"request": self.request}

    def update(self, request, *args, **kwargs):
        if request.user.role not in ["manager","admin"]:
            return Response({"error": "Staff only."}, status=403)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        hall = serializer.save()
        return Response(EventHallSerializer(hall).data)

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ["manager","admin"]:
            return Response({"error": "Staff only."}, status=403)
        instance = self.get_object()
        from django.db.models import ProtectedError
        try:
            instance.delete()
        except ProtectedError:
            return Response(
                {"error": "This hall has bookings on record. Set it to inactive instead of deleting."},
                status=400,
            )
        return Response(status=204)


class EventHallImageUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, hall_id):

        if request.user.role not in ["manager","admin"]:
            return Response(
                {"error": "Permission denied."},
                status=403
            )

        try:
            hall = EventHall.objects.get(id=hall_id)

        except EventHall.DoesNotExist:
            return Response(
                {"error": "Hall not found."},
                status=404
            )

        images = request.FILES.getlist("images")

        if not images:
            return Response(
                {"error": "No images provided."},
                status=400
            )

        created = []

        for img in images:

            from apps.rooms.image_utils import optimize_image_file
            img = optimize_image_file(img)

            ei = EventHallImage.objects.create(
                hall=hall,
                image=img,
                caption=request.data.get("caption", ""),
                is_primary=(
                    len(created) == 0 and
                    not hall.images.filter(
                        is_primary=True
                    ).exists()
                )
            )

            created.append(
                EventHallImageSerializer(
                    ei,
                    context={"request": request}
                ).data
            )

        return Response(
            {
                "uploaded": len(created),
                "images": created
            },
            status=201
        )


class EventHallImageDeleteView(APIView):
    """DELETE /api/v1/events/halls/images/<uuid:pk>/ — staff-only."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        if request.user.role not in ["manager","admin"]:
            return Response({"error": "Permission denied."}, status=403)
        try:
            image = EventHallImage.objects.get(id=pk)
        except EventHallImage.DoesNotExist:
            return Response({"error": "Not found."}, status=404)
        image.image.delete(save=False)
        image.delete()
        return Response(status=204)


class EventBookingListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        if request.user.is_hotel_staff:

            qs = EventBooking.objects.all().select_related(
                "organizer",
                "hall"
            ).order_by(
                "-created_at"
            )

        else:

            qs = EventBooking.objects.filter(
                organizer=request.user
            ).select_related(
                "hall"
            ).order_by(
                "-created_at"
            )

        return Response(
            EventBookingSerializer(
                qs,
                many=True
            ).data
        )

    def post(self, request):

        s = CreateEventBookingSerializer(
            data=request.data
        )

        if not s.is_valid():
            return Response(s.errors, status=400)

        data = s.validated_data

        try:
            hall = EventHall.objects.get(
                id=data["hall_id"],
                is_active=True
            )

        except EventHall.DoesNotExist:
            return Response(
                {"error": "Hall not found."},
                status=404
            )

        conflict = EventBooking.objects.filter(
            hall=hall,
            event_date=data["event_date"],
            status__in=[
                "confirmed",
                "deposit_paid",
                "fully_paid"
            ]
        ).filter(
            start_time__lt=data["end_time"],
            end_time__gt=data["start_time"]
        ).exists()

        if conflict:
            return Response(
                {
                    "error": "This hall is already booked for that date and time."
                },
                status=400
            )

        from datetime import datetime, date

        start = datetime.combine(
            date.today(),
            data["start_time"]
        )

        end = datetime.combine(
            date.today(),
            data["end_time"]
        )

        hours = max(
            (end - start).seconds / 3600,
            1
        )

        if hours <= 4:
            rate = hall.price_half_day

        elif hours <= 8:
            rate = hall.price_full_day

        else:
            rate = (
                hall.price_full_day +
                hall.price_per_hour * (hours - 8)
            )

        extras = 0

        if data.get("catering_required"):
            extras += (
                5000 *
                data["expected_guests"] // 10
            )

        if data.get("photography_required"):
            extras += 50000

        if data.get("mc_required"):
            extras += 30000

        if data.get("live_band_required"):
            extras += 80000

        if data.get("dj_required"):
            extras += 40000

        if data.get("decoration_required"):
            extras += 40000

        tax = round(
            (rate + extras) * 7.5 / 100,
            2
        )

        total = rate + extras + tax

        deposit = round(
            total * hall.deposit_percent / 100,
            2
        )

        booking = EventBooking.objects.create(
            organizer=request.user,
            hall=hall,

            event_name=data["event_name"],
            event_type=data["event_type"],

            event_date=data["event_date"],
            start_time=data["start_time"],
            end_time=data["end_time"],
            setup_time=data["setup_time"],

            expected_guests=data["expected_guests"],

            setup_style=data.get(
                "setup_style",
                "theatre"
            ),

            catering_required=data.get(
                "catering_required",
                False
            ),

            catering_notes=data.get(
                "catering_notes",
                ""
            ),

            decoration_required=data.get(
                "decoration_required",
                False
            ),

            photography_required=data.get(
                "photography_required",
                False
            ),

            mc_required=data.get(
                "mc_required",
                False
            ),

            live_band_required=data.get(
                "live_band_required",
                False
            ),

            dj_required=data.get(
                "dj_required",
                False
            ),

            special_requests=data.get(
                "special_requests",
                ""
            ),

            contact_phone=data.get(
                "contact_phone",
                ""
            ),

            contact_email=data.get(
                "contact_email",
                ""
            ),

            hall_rate=rate,
            extras_cost=extras,
            tax_amount=tax,
            total_amount=total,
            deposit_amount=deposit,
        )

        return Response(
            EventBookingSerializer(
                booking
            ).data,
            status=201
        )


class MyEventBookingsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EventBookingSerializer

    def get_queryset(self):
        return EventBooking.objects.filter(
            organizer=self.request.user
        ).select_related(
            "hall"
        ).order_by(
            "-created_at"
        )


class EventBookingDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EventBookingSerializer

    def get_queryset(self):

        if self.request.user.is_hotel_staff:

            return EventBooking.objects.select_related(
                "hall",
                "organizer"
            )

        return EventBooking.objects.filter(
            organizer=self.request.user
        ).select_related(
            "hall"
        )


class EventBookingStatusUpdateView(APIView):
    """PATCH /api/v1/events/bookings/<uuid:pk>/status/ — staff-only. Lets a
    manager move a booking through PENDING -> CONFIRMED -> DEPOSIT_PAID ->
    FULLY_PAID -> COMPLETED, or CANCELLED at any point."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if request.user.role not in ["manager","admin"]:
            return Response({"error": "Staff only."}, status=403)

        from django.shortcuts import get_object_or_404
        booking = get_object_or_404(EventBooking, pk=pk)
        new_status = request.data.get("status")
        valid_statuses = dict(EventBooking.STATUS_CHOICES)
        if new_status not in valid_statuses:
            return Response({"error": f"Invalid status. Choose from: {', '.join(valid_statuses)}"}, status=400)

        booking.status = new_status
        booking.save(update_fields=["status"])
        return Response(EventBookingSerializer(booking).data)


class EventAvailabilityView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):

        s = EventAvailabilitySerializer(
            data=request.data
        )

        if not s.is_valid():
            return Response(
                s.errors,
                status=400
            )

        data = s.validated_data
        event_date = data["event_date"]

        booked_hall_ids = EventBooking.objects.filter(
            event_date=event_date,
            status__in=[
                "confirmed",
                "deposit_paid",
                "fully_paid"
            ]
        ).values_list(
            "hall_id",
            flat=True
        )

        if data.get("hall_id"):

            halls = EventHall.objects.filter(
                id=data["hall_id"],
                is_active=True
            ).prefetch_related(
                "images"
            )

        else:

            halls = EventHall.objects.filter(
                is_active=True
            ).exclude(
                id__in=booked_hall_ids
            ).prefetch_related(
                "images"
            )

        return Response({
            "event_date": str(event_date),
            "available_halls": EventHallSerializer(
                halls,
                many=True,
                context={"request": request}
            ).data
        })
