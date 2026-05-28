
from django.utils import timezone
from datetime import timedelta

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

        order = Order.objects.create(
            guest=request.user,
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
                order.delete()

                return Response(
                    {
                        "error": f"Menu item {item_data['menu_item']} not found or unavailable."
                    },
                    status=400
                )

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
        order.tax = round(total * 7.5 / 100, 2)
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

        if not request.user.is_hotel_staff:
            return Response(
                {"error": "Staff only."},
                status=403
            )

        try:
            order = Order.objects.get(id=pk)

        except Order.DoesNotExist:
            return Response(
                {"error": "Order not found."},
                status=404
            )

        s = UpdateOrderStatusSerializer(data=request.data)

        if not s.is_valid():
            return Response(s.errors, status=400)

        new_status = s.validated_data["status"]

        order.status = new_status

        if new_status == "delivered":
            order.delivered_at = timezone.now()

        order.save(
            update_fields=[
                "status",
                "delivered_at"
            ] if new_status == "delivered" else ["status"]
        )

        return Response({
            "message": f"Order status updated to '{new_status}'.",
            "order": OrderSerializer(order).data
        })


class KitchenOrdersView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        if not self.request.user.is_hotel_staff:
            return Order.objects.none()

        return Order.objects.filter(
            source__in=["kitchen", "room_service"],
            status__in=[
                "pending",
                "confirmed",
                "preparing"
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
        if not self.request.user.is_hotel_staff:
            return Order.objects.none()

        return Order.objects.filter(
            source="bar",
            status__in=[
                "pending",
                "confirmed",
                "preparing"
            ]
        ).prefetch_related(
            "items__menu_item"
        ).order_by(
            "created_at"
        )
