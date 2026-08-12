from django.urls import path
from . import views
urlpatterns = [
    path("halls/",                  views.EventHallListView.as_view(),       name="event-halls"),
    path("halls/<slug:slug>/",      views.EventHallDetailView.as_view(),     name="event-hall-detail"),
    path("halls/<uuid:hall_id>/images/", views.EventHallImageUploadView.as_view(), name="event-hall-images"),
    path("halls/images/<uuid:pk>/", views.EventHallImageDeleteView.as_view(), name="event-hall-image-delete"),
    path("bookings/",               views.EventBookingListCreateView.as_view(), name="event-bookings"),
    path("bookings/my/",            views.MyEventBookingsView.as_view(),     name="my-event-bookings"),
    path("bookings/<uuid:pk>/",     views.EventBookingDetailView.as_view(),  name="event-booking-detail"),
    path("bookings/<uuid:pk>/status/", views.EventBookingStatusUpdateView.as_view(), name="event-booking-status"),
    path("availability/",           views.EventAvailabilityView.as_view(),   name="event-availability"),
]
