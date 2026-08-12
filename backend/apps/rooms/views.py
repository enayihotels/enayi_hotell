"""Enayi Hotels — Rooms Views"""
from rest_framework import generics, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import ProtectedError
from django.utils.text import slugify
from django_filters.rest_framework import DjangoFilterBackend
from .models import RoomCategory, Room, RoomImage, RoomReview, Amenity, RoomPhoto
from .serializers import (
    RoomCategorySerializer, RoomCategoryWriteSerializer, RoomSerializer,
    RoomImageSerializer, RoomReviewSerializer, AmenitySerializer, AvailabilityCheckSerializer,
    RoomPhotoSerializer,
)

class AmenityListCreateView(generics.ListCreateAPIView):
    queryset = Amenity.objects.all()
    serializer_class = AmenitySerializer
    pagination_class = None
    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=403)
        return super().create(request, *args, **kwargs)


class AmenityDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Public GET; staff-only PATCH/DELETE."""
    queryset = Amenity.objects.all()
    serializer_class = AmenitySerializer

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=403)
        instance = self.get_object()
        from django.db.models import ProtectedError
        try:
            instance.delete()
        except ProtectedError:
            return Response(
                {"error": "This amenity is assigned to one or more room categories. Remove it from those categories first."},
                status=400,
            )
        except Exception:
            # Amenity<->RoomCategory is a plain M2M, not a FK, so deleting an
            # amenity that's in use just cleanly removes it from those
            # categories automatically — no ProtectedError possible here in
            # practice, but keep the guard for safety if that ever changes.
            return Response({"error": "Could not delete this amenity."}, status=400)
        return Response(status=204)

class RoomCategoryListView(generics.ListCreateAPIView):
    """Public GET (guests browsing rooms); staff-only POST to add a new
    room category/type. Was list-only before — RoomCategoryWriteSerializer
    already existed in this file but nothing ever used it."""
    permission_classes = [AllowAny]
    pagination_class = None

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

    def get_serializer_class(self):
        return RoomCategorySerializer if self.request.method == "GET" else RoomCategoryWriteSerializer

    def get_queryset(self):
        qs = RoomCategory.objects.prefetch_related("amenities","images","reviews","rooms")
        # Guests only ever see active categories; staff managing rooms need to see all of them.
        if self.request.method == "GET" and not (self.request.user.is_authenticated and self.request.user.is_hotel_staff):
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_context(self): return {"request": self.request}

    def create(self, request, *args, **kwargs):
        if not (request.user.is_authenticated and request.user.is_hotel_staff):
            return Response({"error": "Staff only."}, status=status.HTTP_403_FORBIDDEN)
        data = request.data.copy()
        if not data.get("slug") and data.get("name"):
            data["slug"] = slugify(data["name"])
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        return Response(RoomCategorySerializer(category, context={"request": request}).data, status=status.HTTP_201_CREATED)

class RoomCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Public GET by slug; staff-only PATCH/DELETE."""
    lookup_field = "slug"

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

    def get_serializer_class(self):
        return RoomCategorySerializer if self.request.method == "GET" else RoomCategoryWriteSerializer

    def get_queryset(self):
        qs = RoomCategory.objects.prefetch_related("amenities","images","reviews","rooms")
        if self.request.method == "GET" and not (self.request.user.is_authenticated and self.request.user.is_hotel_staff):
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_context(self): return {"request": self.request}

    def update(self, request, *args, **kwargs):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        return Response(RoomCategorySerializer(category, context={"request": request}).data)

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError:
            return Response(
                {"error": "This category has rooms assigned to it. Reassign or delete those rooms first, or set it to inactive instead of deleting."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

class RoomListView(generics.ListCreateAPIView):
    """No pagination — this is a management list for staff (and a small
    browsable list for guests), not a large public catalog. A hotel this
    size (dozens of rooms) should never be silently truncated to the
    first 20 results, which is exactly what the global PageNumberPagination
    default was doing here — rooms sorted alphabetically past the 20th
    (VIP/Suite rooms, or anything newly created) were invisible in the
    admin panel even though they existed correctly in the database.
    """
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["status","floor","category"]
    search_fields = ["room_number"]
    def get_queryset(self):
        if self.request.user.is_hotel_staff:
            return Room.objects.select_related("category").all()
        return Room.objects.filter(status="available").select_related("category")

    def create(self, request, *args, **kwargs):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

class RoomDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Staff-only retrieve/update/delete for an individual room."""
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]
    queryset = Room.objects.select_related("category")

    def update(self, request, *args, **kwargs):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError:
            return Response(
                {"error": "This room has booking history and can't be deleted. Set its status to 'Out of Order' instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

class RoomAvailabilityView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        s = AvailabilityCheckSerializer(data=request.data)
        if not s.is_valid(): return Response(s.errors, status=400)
        data = s.validated_data
        check_in = data["check_in"]; check_out = data["check_out"]; adults = data.get("adults",1)
        from apps.bookings.models import Booking
        booked = Booking.objects.filter(status__in=["confirmed","checked_in"],check_in__lt=check_out,check_out__gt=check_in).values_list("room_id",flat=True)
        qs = Room.objects.filter(status="available").exclude(id__in=booked).select_related("category")
        if data.get("category_id"): qs = qs.filter(category_id=data["category_id"])
        if adults: qs = qs.filter(category__max_adults__gte=adults)
        cats = RoomCategory.objects.filter(is_active=True,rooms__in=qs).distinct().prefetch_related("amenities","images")
        return Response({"check_in":str(check_in),"check_out":str(check_out),"nights":(check_out-check_in).days,"available_categories":RoomCategorySerializer(cats,many=True,context={"request":request}).data})

class RoomImageUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    def post(self, request, cat_id):
        if not request.user.is_hotel_staff: return Response({"error":"Permission denied."},status=403)
        try: category = RoomCategory.objects.get(id=cat_id)
        except RoomCategory.DoesNotExist: return Response({"error":"Not found."},status=404)
        images = request.FILES.getlist("images")
        if not images: return Response({"error":"No images."},status=400)
        created = []
        for img in images:
            from .image_utils import optimize_image_file
            img = optimize_image_file(img)
            ri = RoomImage.objects.create(room_category=category,image=img,caption=request.data.get("caption",""),is_primary=len(created)==0 and not category.images.filter(is_primary=True).exists())
            created.append(RoomImageSerializer(ri,context={"request":request}).data)
        return Response({"uploaded":len(created),"images":created},status=201)


class RoomImageDeleteView(APIView):
    """DELETE /api/v1/rooms/images/<uuid:pk>/ — staff-only."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        if not request.user.is_hotel_staff:
            return Response({"error": "Permission denied."}, status=403)
        try:
            image = RoomImage.objects.get(id=pk)
        except RoomImage.DoesNotExist:
            return Response({"error": "Not found."}, status=404)
        image.image.delete(save=False)
        image.delete()
        return Response(status=204)

class RoomReviewListCreateView(generics.ListCreateAPIView):
    serializer_class = RoomReviewSerializer
    def get_permissions(self): return [AllowAny()] if self.request.method=="GET" else [IsAuthenticated()]
    def get_queryset(self): return RoomReview.objects.filter(room_category__slug=self.kwargs["slug"],is_approved=True).select_related("guest")
    def perform_create(self, serializer): serializer.save(guest=self.request.user,room_category=RoomCategory.objects.get(slug=self.kwargs["slug"]))

class BranchRoomsView(APIView):
    """Room numbers for each class at a branch, with free/occupied status.

    GET /api/v1/rooms/branch-availability/?hotel=<branch-or-id>&category=<slug>

    `hotel` accepts a branch slug ("fwawei") or a Hotel id. `category` is
    optional; without it, every class offered at the branch is returned.
    A room counts as occupied if its status isn't "available" or it has an
    active booking. Public so the booking screen can read it before login.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        import uuid as _uuid
        from django.db.models import Q
        from django.utils import timezone
        from apps.bookings.models import Booking

        key = request.query_params.get("hotel") or request.query_params.get("branch")
        if not key:
            return Response({"detail": "Pass ?hotel=<branch>."}, status=400)

        # Resolve hotel object first — accept either UUID or branch slug
        from apps.hotels.models import Hotel as _Hotel
        hotel_obj_qs = _Hotel.objects.filter(is_active=True)
        try:
            uid = _uuid.UUID(str(key))
            hotel_obj = hotel_obj_qs.filter(id=uid).first()
        except (ValueError, TypeError, AttributeError):
            hotel_obj = hotel_obj_qs.filter(branch=key).first()

        if not hotel_obj:
            # Try name contains
            hotel_obj = hotel_obj_qs.filter(name__icontains=key).first()

        if not hotel_obj:
            return Response(
                {"detail": f"No active branch found for: {key}"},
                status=404,
            )

        # Filter rooms STRICTLY by this hotel only
        rooms = (Room.objects.filter(hotel=hotel_obj)
                 .select_related("category", "hotel")
                 .order_by("category__base_price", "floor", "room_number"))

        cat_slug = request.query_params.get("category")
        if cat_slug:
            rooms = rooms.filter(category__slug=cat_slug)

        today = timezone.now().date()
        booked = set(Booking.objects.filter(
            status__in=["pending", "confirmed", "checked_in"],
            check_out__gte=today,
        ).values_list("room_id", flat=True))

        grouped = {}
        for room in rooms:
            occupied = (room.status != "available") or (room.id in booked)
            entry = grouped.setdefault(room.category.slug, {
                "category": room.category.name,
                "category_slug": room.category.slug,
                "rooms": [], "free_count": 0, "total_count": 0,
            })
            entry["rooms"].append({
                "id":           str(room.id),
                "room_number":  room.room_number,
                "floor":        room.floor,
                "status":       room.status,
                "has_balcony":  room.has_balcony,
                "view_type":    room.view_type,
                "is_available": not occupied,
                "is_occupied":  occupied,
            })
            entry["total_count"] += 1
            if not occupied:
                entry["free_count"] += 1

        # Build response in format expected by frontend
        # Strip branch names from category display names
        import re as _re
        _strip = ["Zaramaganda", "Fwawei", "zaramaganda", "fwawei",
                  "ZARAMAGANDA", "FWAWEI"]
        for cat in grouped.values():
            clean = cat["category"]
            for word in _strip:
                clean = clean.replace(word, "").strip(" -_,.")
            clean = _re.sub(r"\s+", " ", clean).strip()
            cat["category"] = clean if clean else cat["category"]

        categories = list(grouped.values())
        total = sum(c["total_count"] for c in categories)
        free  = sum(c["free_count"]  for c in categories)

        return Response({
            "hotel_id":    str(hotel_obj.id)   if hotel_obj else key,
            "hotel_name":  hotel_obj.name       if hotel_obj else key,
            "branch":      hotel_obj.branch     if hotel_obj else key,
            "total_rooms": total,
            "free_rooms":  free,
            "categories":  categories,
        })


class RoomPhotoListUploadView(APIView):
    """GET/POST /api/v1/rooms/list/<uuid:room_id>/photos/ — staff-only both ways.
    Photos of the specific physical room, not the category."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, room_id):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=403)
        try:
            room = Room.objects.get(id=room_id)
        except Room.DoesNotExist:
            return Response({"error": "Room not found."}, status=404)
        photos = room.photos.all()
        return Response(RoomPhotoSerializer(photos, many=True, context={"request": request}).data)

    def post(self, request, room_id):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=403)
        try:
            room = Room.objects.get(id=room_id)
        except Room.DoesNotExist:
            return Response({"error": "Room not found."}, status=404)
        images = request.FILES.getlist("images")
        if not images:
            return Response({"error": "No images."}, status=400)
        created = []
        for img in images:
            from .image_utils import optimize_image_file
            img = optimize_image_file(img)
            rp = RoomPhoto.objects.create(room=room, image=img, caption=request.data.get("caption", ""))
            created.append(RoomPhotoSerializer(rp, context={"request": request}).data)
        return Response({"uploaded": len(created), "photos": created}, status=201)


class RoomPhotoDeleteView(APIView):
    """DELETE /api/v1/rooms/photos/<uuid:pk>/ — staff-only."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        if not request.user.is_hotel_staff:
            return Response({"error": "Permission denied."}, status=403)
        try:
            photo = RoomPhoto.objects.get(id=pk)
        except RoomPhoto.DoesNotExist:
            return Response({"error": "Not found."}, status=404)
        photo.image.delete(save=False)
        photo.delete()
        return Response(status=204)
