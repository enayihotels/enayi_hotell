"""Enayi Hotels - Dashboard & Analytics Views"""
from django.utils import timezone
from django.db.models import Sum, Count, Avg, Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from datetime import timedelta


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        if not request.user.is_hotel_staff:
            return Response(
                {"error": "Staff only."},
                status=403
            )

        from apps.bookings.models import Booking
        from apps.orders.models import Order
        from apps.events.models import EventBooking
        from apps.payments.models import Payment
        from apps.accounts.models import User
        from apps.rooms.models import Room

        today = timezone.now().date()

        this_month_start = today.replace(day=1)

        last_month_start = (
            this_month_start - timedelta(days=1)
        ).replace(day=1)

        # Rooms
        rooms = Room.objects.all()

        total_rooms = rooms.count()

        occupied_rooms = rooms.filter(
            status="occupied"
        ).count()

        available_rooms = rooms.filter(
            status="available"
        ).count()

        maintenance_rooms = rooms.filter(
            status__in=["maintenance", "out_of_order"]
        ).count()

        occupancy_rate = round(
            occupied_rooms / total_rooms * 100,
            1
        ) if total_rooms else 0

        # Bookings
        all_bookings = Booking.objects.all()

        today_checkins = all_bookings.filter(
            check_in=today,
            status="confirmed"
        ).count()

        today_checkouts = all_bookings.filter(
            check_out=today,
            status="checked_in"
        ).count()

        active_guests = all_bookings.filter(
            status="checked_in"
        ).count()

        pending_bookings = all_bookings.filter(
            status="pending"
        ).count()

        month_bookings = all_bookings.filter(
            created_at__date__gte=this_month_start
        ).count()

        last_month_bookings = all_bookings.filter(
            created_at__date__gte=last_month_start,
            created_at__date__lt=this_month_start
        ).count()

        # Revenue
        month_revenue = Payment.objects.filter(
            status="success",
            created_at__date__gte=this_month_start
        ).aggregate(
            total=Sum("amount")
        )["total"] or 0

        last_month_rev = Payment.objects.filter(
            status="success",
            created_at__date__gte=last_month_start,
            created_at__date__lt=this_month_start
        ).aggregate(
            total=Sum("amount")
        )["total"] or 0

        today_revenue = Payment.objects.filter(
            status="success",
            created_at__date=today
        ).aggregate(
            total=Sum("amount")
        )["total"] or 0

        total_revenue = Payment.objects.filter(
            status="success"
        ).aggregate(
            total=Sum("amount")
        )["total"] or 0

        # Orders
        pending_orders = Order.objects.filter(
            status__in=[
                "pending",
                "confirmed",
                "preparing"
            ]
        ).count()

        month_orders = Order.objects.filter(
            created_at__date__gte=this_month_start
        ).count()

        # Events
        upcoming_events = EventBooking.objects.filter(
            event_date__gte=today,
            status__in=[
                "confirmed",
                "deposit_paid",
                "fully_paid"
            ]
        ).count()

        # Guests
        total_guests = User.objects.filter(
            role="guest"
        ).count()

        new_guests = User.objects.filter(
            role="guest",
            date_joined__date__gte=this_month_start
        ).count()

        rev_growth = 0

        if last_month_rev > 0:
            rev_growth = round(
                (
                    float(month_revenue) -
                    float(last_month_rev)
                ) / float(last_month_rev) * 100,
                1
            )

        return Response({
            "rooms": {
                "total": total_rooms,
                "occupied": occupied_rooms,
                "available": available_rooms,
                "maintenance": maintenance_rooms,
                "occupancy_rate": occupancy_rate
            },

            "bookings": {
                "today_checkins": today_checkins,
                "today_checkouts": today_checkouts,
                "active_guests": active_guests,
                "pending": pending_bookings,
                "this_month": month_bookings,
                "last_month": last_month_bookings
            },

            "revenue": {
                "today": float(today_revenue),
                "this_month": float(month_revenue),
                "last_month": float(last_month_rev),
                "total": float(total_revenue),
                "growth_pct": rev_growth
            },

            "orders": {
                "pending": pending_orders,
                "this_month": month_orders
            },

            "events": {
                "upcoming": upcoming_events
            },

            "guests": {
                "total": total_guests,
                "new_this_month": new_guests
            },
        })


class RevenueReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        if not request.user.is_hotel_staff:
            return Response(
                {"error": "Staff only."},
                status=403
            )

        from apps.payments.models import Payment
        from django.db.models.functions import TruncDay, TruncMonth

        period = request.query_params.get(
            "period",
            "monthly"
        )

        days = int(
            request.query_params.get(
                "days",
                "30"
            )
        )

        since = timezone.now() - timedelta(days=days)

        qs = Payment.objects.filter(
            status="success",
            created_at__gte=since
        )

        if period == "daily":

            data = qs.annotate(
                date=TruncDay("created_at")
            ).values(
                "date"
            ).annotate(
                revenue=Sum("amount"),
                count=Count("id")
            ).order_by("date")

            return Response([
                {
                    "date": str(d["date"].date()),
                    "revenue": float(d["revenue"]),
                    "count": d["count"]
                }
                for d in data
            ])

        else:

            data = qs.annotate(
                month=TruncMonth("created_at")
            ).values(
                "month"
            ).annotate(
                revenue=Sum("amount"),
                count=Count("id")
            ).order_by("month")

            return Response([
                {
                    "month": str(d["month"].date())[:7],
                    "revenue": float(d["revenue"]),
                    "count": d["count"]
                }
                for d in data
            ])


class RecentActivityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        if not request.user.is_hotel_staff:
            return Response(
                {"error": "Staff only."},
                status=403
            )

        from apps.bookings.models import Booking
        from apps.orders.models import Order
        from apps.payments.models import Payment

        limit = int(
            request.query_params.get(
                "limit",
                "20"
            )
        )

        recent_bookings = Booking.objects.select_related(
            "guest",
            "room",
            "room__category"
        ).order_by(
            "-created_at"
        )[:limit // 3]

        recent_orders = Order.objects.select_related(
            "guest",
            "room"
        ).order_by(
            "-created_at"
        )[:limit // 3]

        recent_payments = Payment.objects.select_related(
            "guest"
        ).filter(
            status="success"
        ).order_by(
            "-created_at"
        )[:limit // 3]

        activity = []

        for b in recent_bookings:
            activity.append({
                "type": "booking",
                "id": str(b.id),
                "reference": b.booking_reference,
                "guest": b.guest.get_full_name(),
                "description": f"Room {b.room.room_number} � {b.status}",
                "amount": float(b.total_amount),
                "timestamp": b.created_at.isoformat()
            })

        for o in recent_orders:
            activity.append({
                "type": "order",
                "id": str(o.id),
                "reference": o.order_number,
                "guest": o.guest.get_full_name(),
                "description": f"{o.source} order � {o.status}",
                "amount": float(o.total_amount),
                "timestamp": o.created_at.isoformat()
            })

        for p in recent_payments:
            activity.append({
                "type": "payment",
                "id": str(p.id),
                "reference": p.transaction_reference,
                "guest": p.guest.get_full_name(),
                "description": f"{p.method} � {p.purpose}",
                "amount": float(p.amount),
                "timestamp": p.created_at.isoformat()
            })

        activity.sort(
            key=lambda x: x["timestamp"],
            reverse=True
        )

        return Response(activity[:limit])
