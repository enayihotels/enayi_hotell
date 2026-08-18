"""Enayi Hotels — Store & Inventory Views (Phase 1: catalog + balances)"""
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import InventoryCategory, InventoryItem, StockBalance, StockRequisition, StockAdjustmentLog
from .serializers import (
    InventoryCategorySerializer, InventoryItemSerializer,
    InventoryItemWriteSerializer, StockBalanceSerializer, StockRequisitionSerializer,
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
    Staff owns 'kitchen' — manager/admin can adjust any of them (at
    their own branch; Admin at any branch)."""
    if user.role in ["manager", "admin"]:
        return True
    return {
        "store_keeper":  StockBalance.STORE,
        "bar_staff":     StockBalance.BAR,
        "kitchen_staff": StockBalance.KITCHEN,
    }.get(user.role) == location

def _effective_hotel(user, requested_hotel_id=None):
    """The single most important rule in this file: which branch's data
    a request is allowed to touch.

    - Owner/Admin sees every branch — can optionally narrow to one via
      a `?hotel=`/`hotel` param, but isn't required to.
    - Everyone else (Manager, Front Desk Staff, Store Keeper, Bar
      Staff, Kitchen Staff) is locked to their OWN account's `hotel`,
      full stop — a requested_hotel_id from the client is deliberately
      ignored for them, so there's no way to pass a different branch's
      ID and touch its stock. An account of a branch-requiring role
      with no branch assigned yet gets None back, which every caller
      here treats as "show/do nothing" rather than "show everything".
    """
    if user.role == "admin":
        return requested_hotel_id or None
    if user.requires_branch:
        return str(user.hotel_id) if user.hotel_id else False  # False = blocked, not "no filter"
    return None


# Kept for backward compatibility in case anything else imports these,
# but the department filter below now uses InventoryCategory.department
# directly rather than inferring from a linked MenuItem — simpler,
# explicit, and works even for items that are never listed on the guest
# menu at all (e.g. raw kitchen ingredients).
DRINK_TYPES = {"drink", "cocktail", "mocktail", "wine"}
FOOD_TYPES = {"food", "breakfast", "dessert", "snack"}


class InventoryCategoryListView(generics.ListCreateAPIView):
    serializer_class = InventoryCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not _can_view_inventory(user):
            return InventoryCategory.objects.none()
        effective = _effective_hotel(user, self.request.query_params.get("hotel"))
        if effective is False:
            return InventoryCategory.objects.none()
        qs = InventoryCategory.objects.all()
        if effective:
            qs = qs.filter(hotel_id=effective)

        # Same department scoping as the items themselves — a Kitchen
        # Staff account shouldn't see a "Beer & Spirits" category tab
        # sitting there with nothing in it just because the items
        # underneath got filtered out; hide the category entirely.
        if user.role == "bar_staff":
            qs = qs.exclude(department=InventoryCategory.KITCHEN)
        elif user.role == "kitchen_staff":
            qs = qs.exclude(department=InventoryCategory.BAR)

        return qs

    def create(self, request, *args, **kwargs):
        if not _can_manage_catalog(request.user):
            return Response({"error": "Only the Store Keeper, Manager, or Owner can add categories."}, status=403)
        if request.user.role == "admin":
            hotel_id = request.data.get("hotel")
            if not hotel_id:
                return Response({"error": "hotel is required."}, status=400)
        else:
            if not request.user.hotel_id:
                return Response({"error": "Your account has no branch assigned yet — ask the Owner to set one before you can add categories."}, status=403)
            hotel_id = request.user.hotel_id
        data = request.data.copy()
        if not data.get("slug") and data.get("name"):
            data["slug"] = slugify(data["name"])
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(hotel_id=hotel_id)
        return Response(serializer.data, status=201)


class InventoryCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = InventoryCategorySerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "slug"

    def get_queryset(self):
        # Scoping by branch BEFORE the slug lookup happens matters here:
        # slug is only unique WITHIN one branch now (two branches can
        # both have "soft-drinks"), so an unscoped lookup could grab the
        # wrong branch's category, or crash on finding two matches.
        user = self.request.user
        if not _can_view_inventory(user):
            return InventoryCategory.objects.none()
        effective = _effective_hotel(user, self.request.query_params.get("hotel"))
        if effective is False:
            return InventoryCategory.objects.none()
        qs = InventoryCategory.objects.all()
        if effective:
            qs = qs.filter(hotel_id=effective)
        return qs

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
        user = self.request.user
        if not _can_view_inventory(user):
            return InventoryItem.objects.none()
        effective = _effective_hotel(user, self.request.query_params.get("hotel"))
        if effective is False:
            return InventoryItem.objects.none()
        qs = InventoryItem.objects.select_related("category", "hotel").prefetch_related("balances")
        if effective:
            qs = qs.filter(hotel_id=effective)
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__slug=category)

        # Bar/Kitchen Staff only see items in categories tagged for their
        # own department — InventoryCategory.department is the explicit
        # source of truth now (Store Keeper sets this when creating a
        # category). 'shared' categories stay visible to both.
        if user.role == "bar_staff":
            qs = qs.exclude(category__department=InventoryCategory.KITCHEN)
        elif user.role == "kitchen_staff":
            qs = qs.exclude(category__department=InventoryCategory.BAR)

        return qs

    def create(self, request, *args, **kwargs):
        if not _can_manage_catalog(request.user):
            return Response({"error": "Only the Store Keeper, Manager, or Owner can add items."}, status=403)
        if request.user.role == "admin":
            hotel_id = request.data.get("hotel")
            if not hotel_id:
                return Response({"error": "hotel is required."}, status=400)
        else:
            if not request.user.hotel_id:
                return Response({"error": "Your account has no branch assigned yet — ask the Owner to set one before you can add items."}, status=403)
            hotel_id = request.user.hotel_id

        # The category picked also needs to belong to this same branch —
        # otherwise an item could end up pointing at another branch's
        # category, which would be a quiet way for branch data to bleed
        # into each other despite everything else here being scoped.
        category_id = request.data.get("category")
        if category_id and not InventoryCategory.objects.filter(id=category_id, hotel_id=hotel_id).exists():
            return Response({"error": "That category doesn't belong to this branch."}, status=400)

        serializer = InventoryItemWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save(hotel_id=hotel_id)
        # New items start with a zero balance at every location WITHIN
        # THEIR OWN BRANCH ONLY — items no longer span branches at all,
        # so there's nothing to create anywhere else.
        for loc, _ in StockBalance.LOCATION_CHOICES:
            StockBalance.objects.get_or_create(item=item, hotel_id=hotel_id, location=loc)
        return Response(InventoryItemSerializer(item, context={"request": request}).data, status=201)


class InventoryItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not _can_view_inventory(user):
            return InventoryItem.objects.none()
        effective = _effective_hotel(user, self.request.query_params.get("hotel"))
        if effective is False:
            return InventoryItem.objects.none()
        qs = InventoryItem.objects.select_related("category", "hotel").prefetch_related("balances")
        if effective:
            qs = qs.filter(hotel_id=effective)

        # Same department scoping as InventoryItemListView above — a
        # Kitchen Staff account hitting a bar item's detail URL directly
        # should get a 404, not a peek at bar-only stock.
        if user.role == "bar_staff":
            qs = qs.exclude(category__department=InventoryCategory.KITCHEN)
        elif user.role == "kitchen_staff":
            qs = qs.exclude(category__department=InventoryCategory.BAR)

        return qs

    def update(self, request, *args, **kwargs):
        if not _can_manage_catalog(request.user):
            return Response({"error": "Only the Store Keeper, Manager, or Owner can edit items."}, status=403)
        response = super().update(request, *args, **kwargs)
        return Response(InventoryItemSerializer(self.get_object(), context={"request": request}).data, status=response.status_code)

    def destroy(self, request, *args, **kwargs):
        if not _can_manage_catalog(request.user):
            return Response({"error": "Only the Store Keeper, Manager, or Owner can delete items."}, status=403)
        return super().destroy(request, *args, **kwargs)


class ListOnGuestMenuView(APIView):
    """POST /api/v1/inventory/items/<id>/list-on-menu/

    The bridge between the Store's internal catalog and what guests
    actually see on the Food & Bar ordering page. These were always two
    separate systems on purpose (not every stock item should be
    guest-orderable, and not every menu item maps to a single tracked
    item) — but setting one up from the other by hand in Django admin
    was needless duplicate work for the common case of "this bottled
    drink should just be orderable." This does it in one step instead.

    Body: { menu_category_id? | (new_category_name & new_category_type),
            guest_price, description? }
    Creates a MenuItem linked back to this InventoryItem via its
    existing `inventory_item` FK, so Phase 3's auto stock-deduction on
    delivery works immediately with zero extra setup.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not _can_manage_catalog(request.user):
            return Response({"error": "Only the Store Keeper, Manager, or Owner can list items on the guest menu."}, status=403)

        try:
            item = InventoryItem.objects.get(id=pk)
        except InventoryItem.DoesNotExist:
            return Response({"error": "Item not found."}, status=404)

        if request.user.role != "admin" and str(item.hotel_id) != str(request.user.hotel_id):
            return Response({"error": "That item belongs to a different branch than your account."}, status=403)

        if item.menu_items.exists():
            return Response({"error": f"{item.name} is already listed on the guest menu."}, status=400)

        from apps.orders.models import MenuCategory, MenuItem

        category_id = request.data.get("menu_category_id")
        if category_id:
            try:
                category = MenuCategory.objects.get(id=category_id, hotel_id=item.hotel_id)
            except MenuCategory.DoesNotExist:
                return Response({"error": "Menu category not found for this branch."}, status=404)
        else:
            new_name = request.data.get("new_category_name")
            new_type = request.data.get("new_category_type")
            if not new_name or not new_type:
                return Response({"error": "Provide either menu_category_id or both new_category_name and new_category_type."}, status=400)
            category, _ = MenuCategory.objects.get_or_create(
                name=new_name, hotel_id=item.hotel_id, defaults={"type": new_type}
            )

        guest_price = request.data.get("guest_price")
        if guest_price is None:
            return Response({"error": "guest_price is required."}, status=400)
        try:
            guest_price = float(guest_price)
        except (TypeError, ValueError):
            return Response({"error": "guest_price must be a number."}, status=400)

        menu_item = MenuItem.objects.create(
            name=item.name,
            hotel_id=item.hotel_id,
            category=category,
            description=request.data.get("description") or item.name,
            price=guest_price,
            inventory_item=item,
            is_available=True,
        )

        return Response({
            "message": f"{item.name} is now on the guest menu under {category.name}.",
            "menu_item_id": str(menu_item.id),
            "menu_category_id": str(category.id),
            "menu_category_name": category.name,
        }, status=201)


class StockBalanceListView(APIView):
    """GET /api/v1/inventory/balances/?location=store&hotel=<id> —
    every item's stock at a given location (or every location, if
    omitted), scoped to the caller's own branch. Owner/Admin sees every
    branch by default, or can narrow to one with ?hotel=."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _can_view_inventory(request.user):
            return Response({"error": "Inventory access only."}, status=403)

        effective = _effective_hotel(request.user, request.query_params.get("hotel"))
        if effective is False:
            return Response([])  # branch-requiring role, no branch assigned — see nothing, not everything

        location = request.query_params.get("location")
        qs = StockBalance.objects.select_related("item", "item__category", "hotel")
        if effective:
            qs = qs.filter(hotel_id=effective)
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
    Body: {item, location, delta, reason, hotel (Admin only)}
    `delta` can be positive (stock received/found) or negative (used up,
    spoiled, broken). This is the Phase 1 stand-in for direct
    corrections at the location you own — Phase 2 adds a proper
    request-and-fulfill flow specifically for Store -> Bar/Kitchen
    transfers, which is a different, more accountable path than a
    simple self-adjustment.

    Branch is deliberately taken from the ADJUSTING USER's own account
    for every role except Admin, never from the request body — a Store
    Keeper at Fwavwei must never be able to touch Zarmaganda's stock by
    passing a different hotel id, whether by mistake or otherwise. Only
    Admin/Owner may specify which branch, since they're the one role
    that genuinely operates across all of them.
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

        if request.user.role == "admin":
            hotel_id = request.data.get("hotel")
            if not hotel_id:
                return Response({"error": "hotel is required."}, status=400)
        else:
            if request.user.requires_branch and not request.user.hotel_id:
                return Response({"error": "Your account has no branch assigned yet — ask the Owner to set one before you can adjust stock."}, status=403)
            hotel_id = request.user.hotel_id

        try:
            delta = float(delta)
        except (TypeError, ValueError):
            return Response({"error": "delta must be a number."}, status=400)

        try:
            item = InventoryItem.objects.get(id=item_id)
        except InventoryItem.DoesNotExist:
            return Response({"error": "Item not found."}, status=404)

        balance, _ = StockBalance.objects.get_or_create(item=item, hotel_id=hotel_id, location=location)
        new_qty = float(balance.quantity) + delta
        if new_qty < 0:
            return Response({"error": f"That would take {item.name} at {location} below zero (currently {balance.quantity})."}, status=400)

        balance.quantity = new_qty
        balance.save()

        StockAdjustmentLog.objects.create(
            item=item, hotel_id=hotel_id, location=location, delta=delta, resulting_quantity=new_qty,
            reason=reason, adjusted_by=request.user,
        )

        return Response(StockBalanceSerializer(balance).data)


class StockRequisitionListCreateView(generics.ListCreateAPIView):
    """Phase 2: the request side. Bar/Kitchen staff request items from
    the Store; everyone on the same team AT THE SAME BRANCH sees the
    same pending list (not just their own requests), so anyone can
    follow up. Store Keeper sees every pending request across both
    departments AT THEIR OWN BRANCH, since they're the one fulfilling
    them. Manager sees their own branch's requests; Owner sees every
    branch's.
    """
    serializer_class = StockRequisitionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        qs = StockRequisition.objects.select_related("item", "requested_by", "decided_by", "hotel")

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        effective = _effective_hotel(user, self.request.query_params.get("hotel"))
        if effective is False:
            return StockRequisition.objects.none()
        if effective:
            qs = qs.filter(hotel_id=effective)
        # else: Admin with no ?hotel= narrows nothing — sees every branch

        if user.role in ["manager", "admin", "store_keeper"]:
            return qs
        if user.role == "bar_staff":
            return qs.filter(destination=StockBalance.BAR)
        if user.role == "kitchen_staff":
            return qs.filter(destination=StockBalance.KITCHEN)
        return StockRequisition.objects.none()

    def create(self, request, *args, **kwargs):
        user = request.user
        destination = {"bar_staff": StockBalance.BAR, "kitchen_staff": StockBalance.KITCHEN}.get(user.role)
        if not destination:
            return Response({"error": "Only Bar Staff or Kitchen Staff can request items from the Store."}, status=403)
        if not user.hotel_id:
            return Response({"error": "Your account has no branch assigned yet — ask the Owner to set one before you can request stock."}, status=403)

        data = request.data.copy()
        data["destination"] = destination
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(requested_by=user, status=StockRequisition.PENDING, hotel_id=user.hotel_id)
        return Response(serializer.data, status=201)


class StockRequisitionDecideView(APIView):
    """POST /api/v1/inventory/requisitions/<id>/decide/
    Body: {action: 'fulfill'|'reject', quantity_fulfilled (if fulfilling), note}

    Fulfilling is the moment stock actually moves — Store goes down,
    the requesting department goes up, both by the SAME confirmed
    amount AT THE SAME BRANCH as the requisition itself, inside one
    transaction so it's never possible to end up with one side updated
    and not the other, or moving the wrong branch's stock.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role not in ["store_keeper", "manager", "admin"]:
            return Response({"error": "Only the Store Keeper, Manager, or Owner can fulfill or reject requests."}, status=403)

        try:
            req = StockRequisition.objects.select_related("item").get(id=pk)
        except StockRequisition.DoesNotExist:
            return Response({"error": "Request not found."}, status=404)

        if request.user.role != "admin":
            if not request.user.hotel_id or str(request.user.hotel_id) != str(req.hotel_id):
                return Response({"error": "This request belongs to a different branch than your account."}, status=403)

        if req.status != StockRequisition.PENDING:
            return Response({"error": f"This request was already {req.status}."}, status=400)

        action = request.data.get("action")
        note = request.data.get("note", "")

        if action == "reject":
            req.status = StockRequisition.REJECTED
            req.decided_by = request.user
            req.note_from_fulfiller = note
            req.decided_at = timezone.now()
            req.save()
            return Response(StockRequisitionSerializer(req).data)

        if action == "fulfill":
            qty = request.data.get("quantity_fulfilled", req.quantity_requested)
            try:
                qty = float(qty)
            except (TypeError, ValueError):
                return Response({"error": "quantity_fulfilled must be a number."}, status=400)
            if qty <= 0:
                return Response({"error": "quantity_fulfilled must be greater than zero."}, status=400)

            with transaction.atomic():
                store_balance = StockBalance.objects.select_for_update().get_or_create(
                    item=req.item, hotel_id=req.hotel_id, location=StockBalance.STORE)[0]
                if float(store_balance.quantity) < qty:
                    return Response({
                        "error": f"Store only has {store_balance.quantity} {req.item.unit}(s) of {req.item.name} at this branch — can't fulfill {qty}."
                    }, status=400)

                dest_balance = StockBalance.objects.select_for_update().get_or_create(
                    item=req.item, hotel_id=req.hotel_id, location=req.destination)[0]

                store_balance.quantity = float(store_balance.quantity) - qty
                store_balance.save()
                dest_balance.quantity = float(dest_balance.quantity) + qty
                dest_balance.save()

                req.status = StockRequisition.FULFILLED
                req.quantity_fulfilled = qty
                req.decided_by = request.user
                req.note_from_fulfiller = note
                req.decided_at = timezone.now()
                req.save()

            return Response(StockRequisitionSerializer(req).data)

        return Response({"error": "action must be 'fulfill' or 'reject'."}, status=400)
