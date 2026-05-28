from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.shortcuts import get_object_or_404
from .models import Booking
from .serializers import BookingSerializer, CreateBookingSerializer


class BookingListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.is_hotel_staff:
            bookings = Booking.objects.select_related("guest","room","room__category").all()
        else:
            bookings = Booking.objects.filter(guest=request.user)
        serializer = BookingSerializer(bookings, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request):
        serializer = CreateBookingSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            booking = serializer.save()
            return Response(BookingSerializer(booking, context={"request": request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MyBookingsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = BookingSerializer

    def get_queryset(self):
        return Booking.objects.filter(guest=self.request.user).select_related("room","room__category").order_by("-created_at")


class BookingDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = BookingSerializer

    def get_queryset(self):
        if self.request.user.is_hotel_staff:
            return Booking.objects.all()
        return Booking.objects.filter(guest=self.request.user)


class CancelBookingView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk)
        if booking.guest != request.user and not request.user.is_hotel_staff:
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        if booking.status in ["checked_in", "checked_out", "cancelled"]:
            return Response({"error": f"Cannot cancel a booking that is {booking.status}."}, status=status.HTTP_400_BAD_REQUEST)
        booking.status = "cancelled"
        booking.cancellation_reason = request.data.get("reason", "")
        booking.cancelled_at = timezone.now()
        booking.save()
        # Free the room if it was only held/reserved for this booking.
        if booking.room and booking.room.status in ["reserved", "occupied"]:
            booking.room.status = "available"
            booking.room.save(update_fields=["status"])
        return Response({"message": "Booking cancelled.", "booking": BookingSerializer(booking).data})


class CheckInView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=status.HTTP_403_FORBIDDEN)
        booking = get_object_or_404(Booking, pk=pk)
        if booking.status != "confirmed":
            return Response({"error": "Only confirmed bookings can be checked in."}, status=status.HTTP_400_BAD_REQUEST)
        booking.status           = "checked_in"
        booking.actual_check_in  = timezone.now()
        booking.room.status      = "occupied"
        booking.room.save()
        booking.save()
        return Response({"message": f"Guest {booking.guest.get_full_name()} checked in to Room {booking.room.room_number}."})


class CheckOutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=status.HTTP_403_FORBIDDEN)
        booking = get_object_or_404(Booking, pk=pk)
        if booking.status != "checked_in":
            return Response({"error": "Guest is not checked in."}, status=status.HTTP_400_BAD_REQUEST)
        booking.status            = "checked_out"
        booking.actual_check_out  = timezone.now()
        booking.room.status       = "cleaning"
        booking.room.save()
        booking.save()
        booking.guest.add_loyalty_points(100, f"Stay at Room {booking.room.room_number}")
        return Response({"message": f"Guest {booking.guest.get_full_name()} checked out. +100 loyalty points awarded."})


class BookingByReferenceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ref):
        booking = get_object_or_404(Booking, booking_reference=ref.upper())
        if booking.guest != request.user and not request.user.is_hotel_staff:
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        return Response(BookingSerializer(booking, context={"request": request}).data)