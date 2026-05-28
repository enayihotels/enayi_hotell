"""Enayi Hotels — Branch Views"""
from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import Hotel
from .serializers import HotelSerializer


class HotelListView(generics.ListAPIView):
    serializer_class   = HotelSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Hotel.objects.filter(is_active=True).prefetch_related("images")

    def get_serializer_context(self):
        return {"request": self.request}


class HotelDetailView(generics.RetrieveAPIView):
    serializer_class   = HotelSerializer
    permission_classes = [AllowAny]
    lookup_field       = "slug"

    def get_queryset(self):
        return Hotel.objects.filter(is_active=True).prefetch_related("images")

    def get_serializer_context(self):
        return {"request": self.request}
