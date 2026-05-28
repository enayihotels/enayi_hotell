
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


class EventHallListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = EventHallSerializer

    def get_queryset(self):
        return EventHall.objects.filter(
            is_active=True
        ).prefetch_related(
            "images"
        ).order_by(
            "sort_order"
        )

    def get_serializer_context(self):
        return {"request": self.request}


class EventHallDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = EventHallSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return EventHall.objects.filter(
            is_active=True
        ).prefetch_related(
            "images"
        )

    def get_serializer_context(self):
        return {"request": self.request}


class EventHallImageUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, hall_id):

        if not request.user.is_hotel_staff:
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
