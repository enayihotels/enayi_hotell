"""Enayi Hotels — Payments Models
Gateways: Flutterwave | Paystack | Stripe | Monnify | USSD | Bank Transfer | Cash | POS
"""
import uuid
import random
import string
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class Payment(models.Model):
    PENDING   = "pending"
    SUCCESS   = "success"
    FAILED    = "failed"
    REFUNDED  = "refunded"
    ABANDONED = "abandoned"

    STATUS_CHOICES = [
        (PENDING,   "Pending"),
        (SUCCESS,   "Successful"),
        (FAILED,    "Failed"),
        (REFUNDED,  "Refunded"),
        (ABANDONED, "Abandoned"),
    ]

    # ── CHANGE 1: Added "monnify" to METHOD_CHOICES ──────────────────────────
    # PayPal kept for backward-compat; Monnify is the new NGN-native addition.
    METHOD_CHOICES = [
        ("flutterwave",  "Flutterwave"),
        ("paystack",     "Paystack"),
        ("stripe",       "Stripe"),
        ("monnify",      "Monnify"),          # ← NEW
        ("paypal",       "PayPal"),
        ("ussd",         "USSD"),
        ("bank_transfer","Bank Transfer"),
        ("cash",         "Cash"),
        ("pos",          "POS"),
    ]

    PURPOSE_CHOICES = [
        ("booking", "Room Booking"),
        ("order",   "Food/Drink Order"),
        ("event",   "Event Hall"),
        ("gym",     "Gym Session"),
    ]

    id                    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction_reference = models.CharField(max_length=100, unique=True)
    guest                 = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="payments"
    )
    content_type  = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
    object_id     = models.UUIDField(null=True, blank=True)
    payable       = GenericForeignKey("content_type", "object_id")
    purpose       = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    method        = models.CharField(max_length=30, choices=METHOD_CHOICES)
    gateway       = models.CharField(max_length=30, blank=True)
    amount        = models.DecimalField(max_digits=12, decimal_places=2)
    currency      = models.CharField(max_length=10, default="NGN")
    status        = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=PENDING, db_index=True
    )
    narration     = models.CharField(max_length=500, blank=True)

    # ── Gateway reference fields ─────────────────────────────────────────────
    gateway_reference = models.CharField(max_length=300, blank=True)
    gateway_response  = models.JSONField(default=dict, blank=True)
    flw_ref           = models.CharField(max_length=300, blank=True)
    paystack_ref      = models.CharField(max_length=300, blank=True)
    access_code       = models.CharField(max_length=300, blank=True)
    stripe_session_id = models.CharField(max_length=300, blank=True)
    paypal_order_id   = models.CharField(max_length=300, blank=True)

    # ── CHANGE 2: New Monnify-specific field ─────────────────────────────────
    monnify_transaction_ref = models.CharField(max_length=300, blank=True)   # ← NEW

    # ── USSD ─────────────────────────────────────────────────────────────────
    ussd_code = models.CharField(max_length=50,  blank=True)
    ussd_bank = models.CharField(max_length=100, blank=True)

    # ── Bank Transfer ─────────────────────────────────────────────────────────
    virtual_acct_num = models.CharField(max_length=20,  blank=True)
    virtual_acct_bk  = models.CharField(max_length=100, blank=True)

    # ── Meta ─────────────────────────────────────────────────────────────────
    ip_address    = models.GenericIPAddressField(blank=True, null=True)
    metadata      = models.JSONField(default=dict, blank=True)
    verified_at   = models.DateTimeField(blank=True, null=True)
    refunded_at   = models.DateTimeField(blank=True, null=True)
    refund_reason = models.TextField(blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payments"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Payment {self.transaction_reference} — ₦{self.amount:,.0f} [{self.status}]"

    def save(self, *args, **kwargs):
        if not self.transaction_reference:
            self.transaction_reference = "ENY-PAY-" + "".join(
                random.choices(string.ascii_uppercase + string.digits, k=12)
            )
        super().save(*args, **kwargs)

    def get_purpose_display_label(self):
        """Safe helper that won't clash with Django's own get_FOO_display."""
        return dict(self.PURPOSE_CHOICES).get(self.purpose, self.purpose)


class USSDSession(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment      = models.OneToOneField(Payment, on_delete=models.CASCADE, related_name="ussd_session")
    bank_code    = models.CharField(max_length=10)
    bank_name    = models.CharField(max_length=100)
    ussd_code    = models.CharField(max_length=50)
    expires_at   = models.DateTimeField()
    is_completed = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ussd_sessions"

    def __str__(self):
        return f"USSD {self.bank_name} — {self.payment.transaction_reference}"


class BankTransferSession(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment        = models.OneToOneField(Payment, on_delete=models.CASCADE, related_name="transfer_session")
    bank_name      = models.CharField(max_length=100)
    account_number = models.CharField(max_length=20)
    account_name   = models.CharField(max_length=300)
    sort_code      = models.CharField(max_length=20, blank=True)
    bank_code      = models.CharField(max_length=10, blank=True)
    amount         = models.DecimalField(max_digits=12, decimal_places=2)
    reference      = models.CharField(max_length=100, blank=True)
    expires_at     = models.DateTimeField()
    is_completed   = models.BooleanField(default=False)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "bank_transfer_sessions"

    def __str__(self):
        return f"BankTransfer {self.account_number} — {self.payment.transaction_reference}"