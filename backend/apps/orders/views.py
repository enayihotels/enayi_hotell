
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from django.db import transaction

from rest_framework import generics, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from django_filters.rest_framework import DjangoFilterBackend

from .models import MenuCategory, MenuItem, Order, OrderItem
from .serializers import (
    MenuCategorySerializer,
    MenuItemSerializer,
    OrderSerializer,
    CreateOrderSerializer,
    UpdateOrderStatusSerializer,
)


class MenuCategoryListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = MenuCategorySerializer

    def get_queryset(self):
        return MenuCategory.objects.filter(
            is_active=True
        ).order_by("sort_order")


class MenuItemListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = MenuItemSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = [
        "category",
        "is_available",
        "is_halal",
        "is_vegetarian",
        "is_vegan",
    ]
    search_fields = ["name", "description"]

    def get_queryset(self):
        return MenuItem.objects.filter(
            is_available=True
        ).select_related(
            "category"
        ).order_by(
            "category__sort_order",
            "sort_order",
            "name"
        )

    def get_serializer_context(self):
        return {"request": self.request}


class MenuItemDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = MenuItemSerializer
    queryset = MenuItem.objects.select_related("category")

    def get_serializer_context(self):
        return {"request": self.request}


class OrderListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.is_hotel_staff:
            qs = Order.objects.all().select_related(
                "guest",
                "room"
            ).prefetch_related(
                "items__menu_item"
            ).order_by(
                "-created_at"
            )
        else:
            qs = Order.objects.filter(
                guest=request.user
            ).select_related(
                "room"
            ).prefetch_related(
                "items__menu_item"
            ).order_by(
                "-created_at"
            )

        return Response(
            OrderSerializer(qs, many=True).data
        )

    def post(self, request):
        s = CreateOrderSerializer(data=request.data)

        if not s.is_valid():
            return Response(s.errors, status=400)

        data = s.validated_data
        room = None

        if data.get("room_id"):
            from apps.rooms.models import Room

            try:
                room = Room.objects.get(
                    id=data["room_id"]
                )

            except Room.DoesNotExist:
                pass

        # Auto-link this order to the guest's current stay — the same
        # way real room service "charges it to the room" without the
        # guest having to specify anything. Without this, orders were
        # never tied to any booking, which meant the checkout-approval
        # fraud check couldn't see unpaid food/drink charges at all.
        # Prefer an active (checked-in) stay; fall back to a confirmed
        # booking not yet checked in. A guest with neither (e.g. a
        # walk-in restaurant customer) still gets a valid order — just
        # with no linked booking, which is correct for that case.
        from apps.bookings.models import Booking
        booking = (Booking.objects
                   .filter(guest=request.user, status="checked_in")
                   .order_by("-actual_check_in")
                   .first()
                   or Booking.objects
                   .filter(guest=request.user, status="confirmed")
                   .order_by("-created_at")
                   .first())
        if booking and not room:
            room = booking.room

        try:
            with transaction.atomic():
                order = Order.objects.create(
                    guest=request.user,
                    booking=booking,
                    source=data["source"],
                    special_instructions=data.get(
                        "special_instructions",
                        ""
                    ),
                    room=room
                )

                total = 0

                for item_data in data["items"]:

                    try:
                        menu_item = MenuItem.objects.get(
                            id=item_data["menu_item"],
                            is_available=True
                        )

                    except MenuItem.DoesNotExist:
                        # Raising inside the atomic block rolls back the
                        # whole order (and any items already created for
                        # it) instead of leaving a broken zero-amount
                        # record behind — the previous version's
                        # order.delete() call here only covered THIS one
                        # failure case; any other exception (like the tax
                        # calculation bug that used to live below) still
                        # left orphaned orders in the database.
                        raise ValueError(f"Menu item {item_data['menu_item']} not found or unavailable.")

                    oi = OrderItem.objects.create(
                        order=order,
                        menu_item=menu_item,
                        quantity=item_data["quantity"],
                        unit_price=menu_item.price,
                        customizations=item_data.get(
                            "customizations",
                            ""
                        )
                    )

                    total += oi.total_price

                order.subtotal = total
                order.tax = round(total * Decimal("7.5") / Decimal("100"), 2)
                order.total_amount = (
                    order.subtotal +
                    order.delivery_charge +
                    order.tax
                )
                order.estimated_delivery = (
                    timezone.now() + timedelta(minutes=30)
                )

                order.save(
                    update_fields=[
                        "subtotal",
                        "tax",
                        "total_amount",
                        "estimated_delivery"
                    ]
                )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=400)

        return Response(
            OrderSerializer(order).data,
            status=201
        )


class MyOrdersView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return Order.objects.filter(
            guest=self.request.user
        ).prefetch_related(
            "items__menu_item"
        ).order_by(
            "-created_at"
        )


class OrderDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        if self.request.user.is_hotel_staff:
            return Order.objects.prefetch_related(
                "items__menu_item"
            )

        return Order.objects.filter(
            guest=self.request.user
        ).prefetch_related(
            "items__menu_item"
        )


class UpdateOrderStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):

        try:
            order = Order.objects.get(id=pk)

        except Order.DoesNotExist:
            return Response(
                {"error": "Order not found."},
                status=404
            )

        # Front desk/manager/admin can update any order. Bar Staff and
        # Kitchen Staff are scoped to their own department's orders only
        # — a bar staffer marking a kitchen order "delivered" (or vice
        # versa) doesn't make sense and would break the stock-linkage
        # below, which infers Bar vs Kitchen from the order itself.
        user = request.user
        can_update = user.is_hotel_staff or user.role in ["manager", "admin"]
        if not can_update and user.role == "bar_staff" and order.source == "bar":
            can_update = True
        if not can_update and user.role == "kitchen_staff" and order.source in ["kitchen", "room_service"]:
            can_update = True
        if not can_update:
            return Response(
                {"error": "You don't have permission to update this order."},
                status=403
            )

        s = UpdateOrderStatusSerializer(data=request.data)

        if not s.is_valid():
            return Response(s.errors, status=400)

        new_status = s.validated_data["status"]

        order.status = new_status

        stock_note = None
        if new_status == "delivered":
            order.delivered_at = timezone.now()
            if not order.stock_deducted:
                stock_note = _deduct_linked_stock(order)
                order.stock_deducted = True

        order.save(
            update_fields=[
                "status",
                "delivered_at",
                "stock_deducted",
            ] if new_status == "delivered" else ["status"]
        )

        response_data = {
            "message": f"Order status updated to '{new_status}'.",
            "order": OrderSerializer(order).data
        }
        if stock_note:
            response_data["stock_note"] = stock_note
        return Response(response_data)


def _deduct_linked_stock(order):
    """Phase 3: when an order is marked Delivered, automatically decrement
    the Bar or Kitchen stock for any items on it that are linked to a
    tracked InventoryItem. Which location to decrement is inferred from
    the linked menu item's category type (drinks/cocktails/mocktails/wine
    -> Bar, everything else -> Kitchen) rather than a separate field to
    keep this simple to set up.

    Deliberately never blocks the order over a stock mismatch — the
    drink or dish has already been served to the guest by the time this
    runs, so refusing to mark it Delivered because the stock count looks
    wrong would be actively unhelpful. Instead it's allowed to go
    negative on purpose: a negative number here is a genuine, visible
    signal that something doesn't add up (a missed requisition, a
    miscount, or worse) — silently floor-clamping it at zero would just
    hide that signal.

    Returns a short human-readable note if anything unusual happened
    (no link, or it went negative), so the person marking it delivered
    gets a heads-up without it being a hard error.
    """
    from apps.inventory.models import StockBalance

    DRINK_TYPES = {"drink", "cocktail", "mocktail", "wine"}
    notes = []

    for item in order.items.select_related("menu_item", "menu_item__category", "menu_item__inventory_item"):
        inv_item = item.menu_item.inventory_item
        if not inv_item:
            continue

        location = StockBalance.BAR if item.menu_item.category.type in DRINK_TYPES else StockBalance.KITCHEN
        balance, _ = StockBalance.objects.get_or_create(item=inv_item, location=location)
        before = balance.quantity
        balance.quantity = float(balance.quantity) - item.quantity
        balance.save()

        if float(balance.quantity) < 0:
            notes.append(
                f"{inv_item.name} at {location.title()} went negative ({before} - {item.quantity} = {balance.quantity}) — worth checking against recent requisitions."
            )

    return " ".join(notes) if notes else None


class KitchenOrdersView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        user = self.request.user
        if not (user.is_hotel_staff or user.role in ["manager", "admin", "kitchen_staff"]):
            return Order.objects.none()

        return Order.objects.filter(
            source__in=["kitchen", "room_service"],
            status__in=[
                "pending",
                "confirmed",
                "preparing",
                "ready",   # was missing — without it, an order that reached
                           # "ready" vanished from this list entirely, with
                           # no way for staff to ever mark it Delivered.
            ]
        ).prefetch_related(
            "items__menu_item"
        ).order_by(
            "created_at"
        )


class BarOrdersView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        user = self.request.user
        if not (user.is_hotel_staff or user.role in ["manager", "admin", "bar_staff"]):
            return Order.objects.none()

        return Order.objects.filter(
            source__in=["bar", "room_service"],   # room_service orders can contain
                                                    # drinks too, and "Room Service" is
                                                    # the default channel guests see —
                                                    # without this, Bar Staff had zero
                                                    # visibility into any drink ordered
                                                    # through the default channel.
            status__in=[
                "pending",
                "confirmed",
                "preparing",
                "ready",   # was missing — same fix as KitchenOrdersView above.
            ]
        ).prefetch_related(
            "items__menu_item"
        ).order_by(
            "created_at"
        )
