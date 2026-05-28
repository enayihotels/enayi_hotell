"""Enayi Hotels — Rooms Views"""
from rest_framework import generics, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from .models import RoomCategory, Room, RoomImage, RoomReview, Amenity
from .serializers import (
    RoomCategorySerializer, RoomCategoryWriteSerializer, RoomSerializer,
    RoomImageSerializer, RoomReviewSerializer, AmenitySerializer, AvailabilityCheckSerializer,
)

class AmenityListCreateView(generics.ListCreateAPIView):
    queryset = Amenity.objects.all()
    serializer_class = AmenitySerializer
    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

class RoomCategoryListView(generics.ListAPIView):
    serializer_class = RoomCategorySerializer
    permission_classes = [AllowAny]
    def get_queryset(self):
        return RoomCategory.objects.filter(is_active=True).prefetch_related("amenities","images","reviews","rooms")
    def get_serializer_context(self): return {"request": self.request}

class RoomCategoryDetailView(generics.RetrieveAPIView):
    serializer_class = RoomCategorySerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"
    def get_queryset(self):
        return RoomCategory.objects.filter(is_active=True).prefetch_related("amenities","images","reviews","rooms")
    def get_serializer_context(self): return {"request": self.request}

class RoomListView(generics.ListAPIView):
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["status","floor","category"]
    search_fields = ["room_number"]
    def get_queryset(self):
        if self.request.user.is_hotel_staff:
            return Room.objects.select_related("category").all()
        return Room.objects.filter(status="available").select_related("category")

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
            ri = RoomImage.objects.create(room_category=category,image=img,caption=request.data.get("caption",""),is_primary=len(created)==0 and not category.images.filter(is_primary=True).exists())
            created.append(RoomImageSerializer(ri,context={"request":request}).data)
        return Response({"uploaded":len(created),"images":created},status=201)

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

        hotel_q = Q(hotel__branch=key)
        try:
            hotel_q |= Q(hotel_id=_uuid.UUID(str(key)))
        except (ValueError, TypeError, AttributeError):
            pass

        rooms = (Room.objects.filter(hotel_q)
                 .select_related("category", "hotel")
                 .order_by("category__sort_order", "floor", "room_number"))

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
                "room_number": room.room_number,
                "floor": room.floor,
                "status": room.status,
                "is_occupied": occupied,
                "label": "Occupied" if occupied else "Available",
            })
            entry["total_count"] += 1
            if not occupied:
                entry["free_count"] += 1

        return Response({"classes": list(grouped.values())})
