from django.urls import path
from .views import BookingReceiptView, OrderReceiptView, DailyReportView

urlpatterns = [
    path("receipt/booking/<uuid:booking_id>/", BookingReceiptView.as_view(), name="booking-receipt"),
    path("receipt/order/<uuid:order_id>/",     OrderReceiptView.as_view(),   name="order-receipt"),
    path("daily/",                             DailyReportView.as_view(),    name="daily-report"),
]
