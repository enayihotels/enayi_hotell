"""Enayi Hotels — Gallery Serializers"""
from rest_framework import serializers
from .models import GalleryCategory, GalleryImage


class GalleryCategorySerializer(serializers.ModelSerializer):
    image_count = serializers.SerializerMethodField()

    class Meta:
        model  = GalleryCategory
        fields = ["id", "name", "slug", "category_type", "description", "is_active", "sort_order", "image_count"]

    def get_image_count(self, obj):
        return obj.images.filter(is_active=True).count()


class GalleryImageSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_type = serializers.CharField(source="category.category_type", read_only=True)
    image_url     = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = GalleryImage
        fields = [
            "id", "category", "category_name", "category_type",
            "title", "description", "image_url",
            "alt_text", "is_featured", "is_active", "sort_order",
            "width", "height", "file_size_kb",
            "uploaded_by_name", "uploaded_at",
        ]
        read_only_fields = ["id", "width", "height", "file_size_kb", "uploaded_at", "uploaded_by_name"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url if obj.image else None

    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.get_full_name() if obj.uploaded_by else "Admin"


class GalleryImageUploadSerializer(serializers.Serializer):
    category  = serializers.UUIDField()
    title     = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    alt_text  = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
    is_featured = serializers.BooleanField(default=False, required=False)
    images    = serializers.ListField(
        child=serializers.ImageField(),
        min_length=1, max_length=20,
    )