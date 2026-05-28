from django.urls import path
from . import views
urlpatterns = [
    path("",                      views.BookingListCreateView.as_view(), name="bookings"),
    path("my/",                   views.MyBookingsView.as_view(),        name="my-bookings"),
    path("<uuid:pk>/",            views.BookingDetailView.as_view(),     name="booking-detail"),
    path("<uuid:pk>/cancel/",     views.CancelBookingView.as_view(),     name="booking-cancel"),
    path("<uuid:pk>/checkin/",    views.CheckInView.as_view(),           name="booking-checkin"),
    path("<uuid:pk>/checkout/",   views.CheckOutView.as_view(),          name="booking-checkout"),
    path("ref/<str:ref>/",        views.BookingByReferenceView.as_view(),name="booking-by-ref"),
]
