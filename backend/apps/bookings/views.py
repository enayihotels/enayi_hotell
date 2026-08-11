from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.shortcuts import get_object_or_404
from .models import Booking, CheckoutApprovalRequest
from .serializers import (
    BookingSerializer, CreateBookingSerializer,
    CheckoutApprovalRequestSerializer, RequestCheckoutApprovalSerializer,
    DecideCheckoutApprovalSerializer,
)


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
    """Checks a guest out — but only if their balance is fully settled.

    If there's an outstanding balance, this does NOT complete the checkout.
    Instead it creates (or reuses) a CheckoutApprovalRequest and returns
    202 Accepted, so a manager/admin can review and approve it via
    ApproveCheckoutView. This closes the single-staff-member fraud gap
    where a guest could be checked out (and the room freed) without ever
    paying in full.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=status.HTTP_403_FORBIDDEN)
        booking = get_object_or_404(Booking, pk=pk)
        if booking.status != "checked_in":
            return Response({"error": "Guest is not checked in."}, status=status.HTTP_400_BAD_REQUEST)

        if not booking.is_fully_paid:
            existing = booking.checkout_approvals.filter(status=CheckoutApprovalRequest.PENDING).first()
            if existing:
                return Response(
                    {
                        "error": "Outstanding balance — a checkout approval request is already pending manager review.",
                        "approval_request": CheckoutApprovalRequestSerializer(existing).data,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            reason_serializer = RequestCheckoutApprovalSerializer(data=request.data)
            reason_serializer.is_valid(raise_exception=True)
            approval = CheckoutApprovalRequest.objects.create(
                booking=booking,
                requested_by=request.user,
                balance_due_at_request=booking.balance_due,
                reason=reason_serializer.validated_data.get("reason", ""),
            )
            return Response(
                {
                    "error": (
                        f"Guest has an outstanding balance of ₦{booking.balance_due:,.2f}. "
                        "Checkout requires manager approval before it can be completed."
                    ),
                    "approval_request": CheckoutApprovalRequestSerializer(approval).data,
                },
                status=status.HTTP_202_ACCEPTED,
            )

        booking.status            = "checked_out"
        booking.actual_check_out  = timezone.now()
        booking.room.status       = "cleaning"
        booking.room.save()
        booking.save()
        booking.guest.add_loyalty_points(100, f"Stay at Room {booking.room.room_number}")
        return Response({"message": f"Guest {booking.guest.get_full_name()} checked out. +100 loyalty points awarded."})


class PendingCheckoutApprovalsView(generics.ListAPIView):
    """Manager/admin dashboard feed of checkouts awaiting approval."""
    permission_classes = [IsAuthenticated]
    serializer_class    = CheckoutApprovalRequestSerializer

    def get_queryset(self):
        if not (self.request.user.is_authenticated and self.request.user.role in ["manager", "admin"]):
            return CheckoutApprovalRequest.objects.none()
        return (CheckoutApprovalRequest.objects
                .filter(status=CheckoutApprovalRequest.PENDING)
                .select_related("booking", "booking__room", "booking__guest", "requested_by"))


class ApproveCheckoutView(APIView):
    """Manager/admin decides a pending checkout approval request.

    Approving completes the checkout (mirrors CheckOutView's success path).
    Rejecting leaves the booking checked-in so the front desk can collect
    payment before trying again.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role not in ["manager", "admin"]:
            return Response({"error": "Manager/Admin only."}, status=status.HTTP_403_FORBIDDEN)

        approval = get_object_or_404(CheckoutApprovalRequest, pk=pk)
        if approval.status != CheckoutApprovalRequest.PENDING:
            return Response({"error": f"This request was already {approval.status}."}, status=status.HTTP_400_BAD_REQUEST)

        decision_serializer = DecideCheckoutApprovalSerializer(data=request.data)
        decision_serializer.is_valid(raise_exception=True)
        decision = decision_serializer.validated_data["decision"]  # "approve" | "reject"
        note     = decision_serializer.validated_data.get("decision_note", "")

        booking = approval.booking
        approval.decided_by    = request.user
        approval.decision_note = note
        approval.decided_at    = timezone.now()

        if decision == "approve":
            approval.status = CheckoutApprovalRequest.APPROVED
            approval.save()
            booking.status           = "checked_out"
            booking.actual_check_out = timezone.now()
            booking.room.status      = "cleaning"
            booking.room.save()
            booking.save()
            booking.guest.add_loyalty_points(100, f"Stay at Room {booking.room.room_number}")
            return Response({
                "message": f"Checkout approved. Guest {booking.guest.get_full_name()} checked out with an outstanding balance of ₦{approval.balance_due_at_request:,.2f}.",
                "approval_request": CheckoutApprovalRequestSerializer(approval).data,
            })
        else:
            approval.status = CheckoutApprovalRequest.REJECTED
            approval.save()
            return Response({
                "message": "Checkout rejected. Guest remains checked in pending full payment.",
                "approval_request": CheckoutApprovalRequestSerializer(approval).data,
            })


class BookingByReferenceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ref):
        booking = get_object_or_404(Booking, booking_reference=ref.upper())
        if booking.guest != request.user and not request.user.is_hotel_staff:
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        return Response(BookingSerializer(booking, context={"request": request}).data)