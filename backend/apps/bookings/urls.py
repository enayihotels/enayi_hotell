from django.urls import path
from . import views
urlpatterns = [
    path("",                      views.BookingListCreateView.as_view(), name="bookings"),
    path("my/",                   views.MyBookingsView.as_view(),        name="my-bookings"),
    path("<uuid:pk>/",            views.BookingDetailView.as_view(),     name="booking-detail"),
    path("<uuid:pk>/cancel/",     views.CancelBookingView.as_view(),     name="booking-cancel"),
    path("<uuid:pk>/checkin/",    views.CheckInView.as_view(),           name="booking-checkin"),
    path("<uuid:pk>/checkin/send-otp/", views.SendCheckinOtpView.as_view(), name="booking-checkin-send-otp"),
    path("<uuid:pk>/checkin/verify-identity/", views.VerifyGuestIdentityView.as_view(), name="booking-checkin-verify-identity"),
    path("<uuid:pk>/record-payment/", views.RecordManualPaymentView.as_view(), name="booking-record-payment"),
    path("<uuid:pk>/checkout/",   views.CheckOutView.as_view(),          name="booking-checkout"),
    path("ref/<str:ref>/",        views.BookingByReferenceView.as_view(),name="booking-by-ref"),
    path("checkout-approvals/",              views.PendingCheckoutApprovalsView.as_view(), name="checkout-approvals-pending"),
    path("checkout-approvals/<uuid:pk>/decide/", views.ApproveCheckoutView.as_view(),       name="checkout-approval-decide"),
]
