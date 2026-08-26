"""Enayi Hotels — Payment Serializers"""
from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Payment
        fields = [
            "id",
            "transaction_reference",
            "purpose",
            "method",
            "gateway",
            "amount",
            "currency",
            "status",
            "narration",
            # Gateway refs
            "flw_ref",
            "paystack_ref",
            "stripe_session_id",
            "paypal_order_id",
            "monnify_transaction_ref",   # ← NEW
            # Offline methods
            "ussd_code",
            "ussd_bank",
            "virtual_acct_num",
            "virtual_acct_bk",
            # Timestamps
            "verified_at",
            "created_at",
        ]
        read_only_fields = fields


class AdminPaymentSerializer(serializers.ModelSerializer):
    """Same as PaymentSerializer, plus who the payment belongs to — for the
    staff-only admin payments list, which spans every guest."""
    guest_name  = serializers.SerializerMethodField()
    guest_email = serializers.CharField(source="guest.email", read_only=True, default=None)

    class Meta:
        model  = Payment
        fields = [
            "id", "transaction_reference", "guest_name", "guest_email",
            "purpose", "method", "gateway", "amount", "currency", "status",
            "narration", "verified_at", "created_at", "metadata",
        ]
        read_only_fields = fields

    def get_guest_name(self, obj):
        return obj.guest.get_full_name() if obj.guest_id else "—"


class InitiatePaymentSerializer(serializers.Serializer):
    PURPOSE_CHOICES = [
        ("booking", "Booking"),
        ("order",   "Order"),
        ("event",   "Event"),
        ("gym",     "Gym"),
        ("laundry", "Laundry"),
    ]
    # ── CHANGE: Monnify added to METHOD_CHOICES ──────────────────────────────
    METHOD_CHOICES = [
        ("flutterwave",   "Flutterwave"),
        ("paystack",      "Paystack"),
        ("stripe",        "Stripe"),
        ("monnify",       "Monnify"),       # ← NEW
        ("paypal",        "PayPal"),
        ("ussd",          "USSD"),
        ("bank_transfer", "Bank Transfer"),
        ("cash",          "Cash"),
        ("pos",           "POS"),
    ]

    purpose   = serializers.ChoiceField(choices=PURPOSE_CHOICES)
    method    = serializers.ChoiceField(choices=METHOD_CHOICES)
    amount    = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=1)
    currency  = serializers.CharField(max_length=5, default="NGN",  required=False)
    narration = serializers.CharField(max_length=300, default="",   required=False)
    bank_code = serializers.CharField(max_length=10,                required=False)   # USSD
    metadata  = serializers.DictField(required=False, default=dict)