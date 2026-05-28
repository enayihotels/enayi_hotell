from django.urls import path
from . import views

urlpatterns = [
    path("",               views.HotelListView.as_view(),   name="hotels"),
    path("<slug:slug>/",   views.HotelDetailView.as_view(), name="hotel-detail"),
]
