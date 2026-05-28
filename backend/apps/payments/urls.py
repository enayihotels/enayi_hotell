"""Enayi Hotels — Payment URL Routes"""
from django.urls import path
from . import views

urlpatterns = [
    # ── Initiate & verify ────────────────────────────────────────────────────
    path("initiate/",               views.InitiatePaymentView.as_view(),    name="payment-initiate"),
    path("verify/<str:reference>/", views.VerifyPaymentView.as_view(),      name="payment-verify"),
    path("history/",                views.PaymentHistoryView.as_view(),     name="payment-history"),
    path("ussd-banks/",             views.USSDBanksView.as_view(),          name="ussd-banks"),

    # ── Webhooks (AllowAny — signature-verified inside each view) ────────────
    path("webhooks/flutterwave/",   views.FlutterwaveWebhookView.as_view(), name="webhook-flutterwave"),
    path("webhooks/paystack/",      views.PaystackWebhookView.as_view(),    name="webhook-paystack"),
    path("webhooks/stripe/",        views.StripeWebhookView.as_view(),      name="webhook-stripe"),
    path("webhooks/monnify/",       views.MonnifyWebhookView.as_view(),     name="webhook-monnify"),  # ← NEW
]