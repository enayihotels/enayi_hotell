"""Enayi Hotels — Store & Inventory Views (Phase 1: catalog + balances)"""
from django.utils.text import slugify
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import InventoryCategory, InventoryItem, StockBalance
from .serializers import (
    InventoryCategorySerializer, InventoryItemSerializer,
    InventoryItemWriteSerializer, StockBalanceSerializer,
)

# Anyone in the inventory system (any department, or manager/admin) can
# VIEW the catalog — Bar Staff needs to see what exists to know what to
# request, even though only the Store Keeper (or manager/admin) can
# actually create/edit/delete catalog items.
def _can_view_inventory(user):
    return user.is_inventory_staff or user.role in ["manager", "admin"]

def _can_manage_catalog(user):
    return user.role in ["store_keeper", "manager", "admin"]

def _can_adjust_location(user, location):
    """Who's allowed to directly adjust the stock balance at a given
    location. Store Keeper owns 'store', Bar Staff owns 'bar', Kitchen
    Staff owns 'kitchen' — manager/admin can adjust any of them."""
    if user.role in ["manager", "admin"]:
        return True
    return {
        "store_keeper":  StockBalance.STORE,
        "bar_staff":     StockBalance.BAR,
        "kitchen_staff": StockBalance.KITCHEN,
    }.get(user.role) == location


class InventoryCategoryListView(generics.ListCreateAPIView):
    serializer_class = InventoryCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return InventoryCategory.objects.all() if _can_view_inventory(self.request.user) else InventoryCategory.objects.none()

    def create(self, request, *args, **kwargs):
        if not _can_manage_catalog(request.user):
            return Response({"error": "Only the Store Keeper, Manager, or Owner can add categories."}, status=403)
        data = request.data.copy()
        if not data.get("slug") and data.get("name"):
            data["slug"] = slugify(data["name"])
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)


class InventoryCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = InventoryCategory.objects.all()
    serializer_class = InventoryCategorySerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "slug"

    def update(self, request, *args, **kwargs):
        if not _can_manage_catalog(request.user):
            return Response({"error": "Only the Store Keeper, Manager, or Owner can edit categories."}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _can_manage_catalog(request.user):
            return Response({"error": "Only the Store Keeper, Manager, or Owner can delete categories."}, status=403)
        instance = self.get_object()
        if instance.items.exists():
            return Response({"error": "This category still has items in it. Move or delete those first."}, status=400)
        return super().destroy(request, *args, **kwargs)


class InventoryItemListView(generics.ListCreateAPIView):
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        if not _can_view_inventory(self.request.user):
            return InventoryItem.objects.none()
        qs = InventoryItem.objects.select_related("category").prefetch_related("balances")
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__slug=category)
        return qs

    def create(self, request, *args, **kwargs):
        if not _can_manage_catalog(request.user):
            return Response({"error": "Only the Store Keeper, Manager, or Owner can add items."}, status=403)
        serializer = InventoryItemWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        # New items start with a zero balance at every location, so they
        # immediately show up correctly everywhere rather than needing a
        # separate first-time setup step.
        for loc, _ in StockBalance.LOCATION_CHOICES:
            StockBalance.objects.get_or_create(item=item, location=loc)
        return Response(InventoryItemSerializer(item).data, status=201)


class InventoryItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = InventoryItem.objects.all()
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return InventoryItemWriteSerializer if self.request.method in ["PUT", "PATCH"] else InventoryItemSerializer

    def update(self, request, *args, **kwargs):
        if not _can_manage_catalog(request.user):
            return Response({"error": "Only the Store Keeper, Manager, or Owner can edit items."}, status=403)
        response = super().update(request, *args, **kwargs)
        return Response(InventoryItemSerializer(self.get_object()).data, status=response.status_code)

    def destroy(self, request, *args, **kwargs):
        if not _can_manage_catalog(request.user):
            return Response({"error": "Only the Store Keeper, Manager, or Owner can delete items."}, status=403)
        return super().destroy(request, *args, **kwargs)


class StockBalanceListView(APIView):
    """GET /api/v1/inventory/balances/?location=store — every item's
    stock at a given location (or every location, if omitted)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _can_view_inventory(request.user):
            return Response({"error": "Inventory access only."}, status=403)
        location = request.query_params.get("location")
        qs = StockBalance.objects.select_related("item", "item__category")
        if location:
            qs = qs.filter(location=location)
        low_only = request.query_params.get("low_only") == "true"
        results = [b for b in qs if (not low_only or b.is_low)]
        data = [{
            **StockBalanceSerializer(b).data,
            "item_id": str(b.item_id),
            "item_name": b.item.name,
            "item_sku": b.item.sku,
            "item_unit": b.item.unit,
            "category_name": b.item.category.name,
        } for b in results]
        return Response(data)


class AdjustStockView(APIView):
    """POST /api/v1/inventory/balances/adjust/
    Body: {item, location, delta, reason}
    `delta` can be positive (stock received/found) or negative (used up,
    spoiled, broken). This is the Phase 1 stand-in for direct
    corrections at the location you own — Phase 2 adds a proper
    request-and-fulfill flow specifically for Store -> Bar/Kitchen
    transfers, which is a different, more accountable path than a
    simple self-adjustment.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        item_id = request.data.get("item")
        location = request.data.get("location")
        delta = request.data.get("delta")
        reason = request.data.get("reason", "")

        if not all([item_id, location, delta is not None]):
            return Response({"error": "item, location, and delta are all required."}, status=400)
        if location not in dict(StockBalance.LOCATION_CHOICES):
            return Response({"error": "Invalid location."}, status=400)
        if not _can_adjust_location(request.user, location):
            return Response({"error": f"You don't have permission to adjust stock at {location}."}, status=403)

        try:
            delta = float(delta)
        except (TypeError, ValueError):
            return Response({"error": "delta must be a number."}, status=400)

        try:
            item = InventoryItem.objects.get(id=item_id)
        except InventoryItem.DoesNotExist:
            return Response({"error": "Item not found."}, status=404)

        balance, _ = StockBalance.objects.get_or_create(item=item, location=location)
        new_qty = float(balance.quantity) + delta
        if new_qty < 0:
            return Response({"error": f"That would take {item.name} at {location} below zero (currently {balance.quantity})."}, status=400)

        balance.quantity = new_qty
        balance.save()
        return Response(StockBalanceSerializer(balance).data)
