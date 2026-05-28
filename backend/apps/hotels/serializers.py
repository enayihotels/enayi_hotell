"""Enayi Hotels — Branch Serializers"""
from rest_framework import serializers
from .models import Hotel, HotelImage


class HotelImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model  = HotelImage
        fields = ["id", "image_url", "caption", "is_cover", "sort_order"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url if obj.image else None


class HotelSerializer(serializers.ModelSerializer):
    images          = HotelImageSerializer(many=True, read_only=True)
    cover_image_url = serializers.SerializerMethodField()

    class Meta:
        model  = Hotel
        fields = [
            "id", "name", "branch", "slug", "tagline", "description",
            "address", "city", "state", "phone", "email", "whatsapp",
            "latitude", "longitude", "cover_image_url", "images",
            "is_active", "is_primary", "sort_order",
        ]

    def get_cover_image_url(self, obj):
        request = self.context.get("request")
        if obj.cover_image and request:
            return request.build_absolute_uri(obj.cover_image.url)
        return obj.cover_image.url if obj.cover_image else None
