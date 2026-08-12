
from rest_framework import generics, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend

from .models import GalleryCategory, GalleryImage
from .serializers import GalleryCategorySerializer, GalleryImageSerializer


class GalleryCategoryListView(generics.ListCreateAPIView):
    """Public GET; staff-only POST to add a new category."""
    permission_classes = [AllowAny]

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

    def get_serializer_class(self):
        return GalleryCategorySerializer

    def get_queryset(self):
        qs = GalleryCategory.objects.order_by("sort_order")
        if self.request.method == "GET" and not (self.request.user.is_authenticated and self.request.user.is_hotel_staff):
            qs = qs.filter(is_active=True)
        return qs

    def create(self, request, *args, **kwargs):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=403)
        from django.utils.text import slugify
        data = request.data.copy()
        if not data.get("slug") and data.get("name"):
            data["slug"] = slugify(data["name"])
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        return Response(GalleryCategorySerializer(category).data, status=201)


class GalleryCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Public GET by pk; staff-only PATCH/DELETE."""
    serializer_class = GalleryCategorySerializer
    queryset = GalleryCategory.objects.all()

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=403)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        return Response(GalleryCategorySerializer(category).data)

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_hotel_staff:
            return Response({"error": "Staff only."}, status=403)
        instance = self.get_object()
        from django.db.models import ProtectedError
        try:
            instance.delete()
        except ProtectedError:
            return Response(
                {"error": "This category has images in it. Delete or reassign those images first, or set it to inactive instead."},
                status=400,
            )
        return Response(status=204)


class GalleryImageListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = GalleryImageSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]

    filterset_fields = [
        "category",
        "is_featured",
        "category__category_type"
    ]

    search_fields = [
        "title",
        "description",
        "alt_text"
    ]

    def get_queryset(self):
        return GalleryImage.objects.filter(
            is_active=True
        ).select_related(
            "category",
            "uploaded_by"
        ).order_by(
            "-is_featured",
            "sort_order",
            "-uploaded_at"
        )

    def get_serializer_context(self):
        return {"request": self.request}


class FeaturedImagesView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = GalleryImageSerializer

    def get_queryset(self):
        return GalleryImage.objects.filter(
            is_active=True,
            is_featured=True
        ).select_related(
            "category"
        ).order_by(
            "sort_order"
        )[:20]

    def get_serializer_context(self):
        return {"request": self.request}


class GalleryImageDetailView(generics.RetrieveDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = GalleryImageSerializer

    def get_queryset(self):
        return GalleryImage.objects.select_related(
            "category",
            "uploaded_by"
        )

    def get_serializer_context(self):
        return {"request": self.request}

    def perform_destroy(self, instance):
        if not self.request.user.is_hotel_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only staff can delete images.")

        instance.image.delete(save=False)
        instance.delete()


class GalleryImageUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if not request.user.is_hotel_staff:
            return Response(
                {"error": "Permission denied."},
                status=403
            )

        cat_id = request.data.get("category")

        if not cat_id:
            return Response(
                {"error": "category is required."},
                status=400
            )

        try:
            category = GalleryCategory.objects.get(id=cat_id)

        except GalleryCategory.DoesNotExist:
            return Response(
                {"error": "Category not found."},
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
            from apps.rooms.image_utils import optimize_image_file
            img = optimize_image_file(img)
            gi = GalleryImage.objects.create(
                category=category,
                image=img,
                title=request.data.get("title", ""),
                alt_text=request.data.get("alt_text", ""),
                is_featured=request.data.get(
                    "is_featured",
                    "false"
                ).lower() == "true",
                uploaded_by=request.user,
            )

            created.append(
                GalleryImageSerializer(
                    gi,
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
