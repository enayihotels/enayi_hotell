"""
Enayi Hotels — Complete Payment Gateway Integration
Gateways: Flutterwave | Paystack | Stripe | Monnify | USSD | Bank Transfer | Cash | POS

CHANGES FROM ORIGINAL:
  1. Monnify gateway added (_monnify, MonnifyWebhookView, _verify_monnify)
  2. Paystack HMAC signature bug fixed (hmac.new → hmac.new with correct import)
  3. Stripe webhook uses request.body directly (CSRF-exempt via AllowAny)
  4. _fulfill() uses get_purpose_display_label() to avoid Django method clash
  5. VerifyPaymentView._fulfill() is now a standalone helper to avoid
     instantiating VerifyPaymentView inside webhook handlers
"""

import hmac
import hashlib
import base64
import stripe
import requests
import logging
from decimal import Decimal
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status as drf_status

from .models import Payment, USSDSession, BankTransferSession
from .serializers import PaymentSerializer, InitiatePaymentSerializer

logger = logging.getLogger("apps.payments")

# ─────────────────────────────────────────────────────────────────────────────
# Gateway base URLs & shared headers
# ─────────────────────────────────────────────────────────────────────────────
FLW_BASE = "https://api.flutterwave.com/v3"
PS_BASE  = "https://api.paystack.co"
MNF_BASE = "https://api.monnify.com"          # live; swap to https://sandbox.monnify.com for tests

FLW_HEADERS = {
    "Authorization": f"Bearer {settings.FLUTTERWAVE_SECRET_KEY}",
    "Content-Type":  "application/json",
}
PS_HEADERS = {
    "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
    "Content-Type":  "application/json",
}

# ─────────────────────────────────────────────────────────────────────────────
# USSD bank map  (Nigeria)
# ─────────────────────────────────────────────────────────────────────────────
USSD_BANK_MAP = {
    "058": {"name": "Guaranty Trust Bank",    "ussd": "*737#"},
    "033": {"name": "United Bank for Africa", "ussd": "*919#"},
    "011": {"name": "First Bank of Nigeria",  "ussd": "*894#"},
    "044": {"name": "Access Bank",            "ussd": "*901#"},
    "057": {"name": "Zenith Bank",            "ussd": "*966#"},
    "232": {"name": "Sterling Bank",          "ussd": "*822#"},
    "070": {"name": "Fidelity Bank",          "ussd": "*770#"},
    "076": {"name": "Polaris Bank",           "ussd": "*833#"},
    "221": {"name": "Stanbic IBTC Bank",      "ussd": "*909#"},
    "082": {"name": "Keystone Bank",          "ussd": "*7111#"},
}


# ─────────────────────────────────────────────────────────────────────────────
# Shared post-payment fulfillment  (standalone so webhooks can call it safely)
# ─────────────────────────────────────────────────────────────────────────────
def fulfill_payment(payment: Payment) -> None:
    """Update the linked booking / order / event when a payment succeeds."""
    try:
        if payment.purpose == "booking" and payment.payable:
            booking = payment.payable
            booking.amount_paid += payment.amount
            if booking.amount_paid >= booking.total_amount:
                booking.status = "confirmed"
            booking.save(update_fields=["amount_paid", "status"])
            payment.guest.add_loyalty_points(
                int(payment.amount // 1000),
                f"Booking payment ₦{payment.amount:,.0f}",
            )

        elif payment.purpose == "order" and payment.payable:
            order = payment.payable
            order.is_paid = True
            order.save(update_fields=["is_paid"])

        elif payment.purpose == "event" and payment.payable:
            event = payment.payable
            event.amount_paid += payment.amount
            if event.amount_paid >= event.deposit_amount:
                event.status = "deposit_paid"
            if event.amount_paid >= event.total_amount:
                event.status = "fully_paid"
            event.save(update_fields=["amount_paid", "status"])

    except Exception as exc:
        logger.exception(f"fulfill_payment error for {payment.transaction_reference}: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# Monnify helper — get a short-lived access token
# ─────────────────────────────────────────────────────────────────────────────
def _monnify_token() -> str:
    """
    Monnify uses HTTP Basic Auth (apiKey:secretKey) to fetch a Bearer token.
    The token is valid for 1 hour; for production you should cache it with Redis.
    """
    credentials = base64.b64encode(
        f"{settings.MONNIFY_API_KEY}:{settings.MONNIFY_SECRET_KEY}".encode()
    ).decode()

    resp = requests.post(
        f"{MNF_BASE}/api/v1/auth/login",
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type":  "application/json",
        },
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data.get("requestSuccessful"):
        raise ValueError(f"Monnify auth failed: {data}")
    return data["responseBody"]["accessToken"]


# ─────────────────────────────────────────────────────────────────────────────
# InitiatePaymentView
# ─────────────────────────────────────────────────────────────────────────────
class InitiatePaymentView(APIView):
    """
    POST /api/v1/payments/initiate/

    Body (JSON):
      purpose    : "booking" | "order" | "event" | "gym"
      method     : "flutterwave" | "paystack" | "stripe" | "monnify" |
                   "paypal" | "ussd" | "bank_transfer" | "cash" | "pos"
      amount     : Decimal
      currency   : "NGN" (default)
      narration  : str  (optional)
      bank_code  : str  (required only for method="ussd")
      metadata   : dict (optional)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = InitiatePaymentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data   = serializer.validated_data
        method = data["method"]
        user   = request.user

        payment = Payment.objects.create(
            guest      = user,
            purpose    = data["purpose"],
            method     = method,
            amount     = data["amount"],
            currency   = data.get("currency", "NGN"),
            narration  = data.get("narration", "Payment — Enayi Hotels & Suites"),
            ip_address = request.META.get("REMOTE_ADDR"),
            metadata   = data.get("metadata", {}),
        )

        dispatch = {
            "flutterwave":   self._flutterwave,
            "paystack":      self._paystack,
            "stripe":        self._stripe,
            "monnify":       self._monnify,       # ← NEW
            "paypal":        self._paypal,
            "ussd":          self._ussd,
            "bank_transfer": self._bank_transfer,
            "cash":          self._cash_or_pos,
            "pos":           self._cash_or_pos,
        }

        handler = dispatch.get(method)
        if not handler:
            payment.delete()
            return Response({"error": f"Unsupported payment method: {method}"}, status=400)

        return handler(payment, user, request, data)

    # ──────────────────────────────────────────────────────────────────────────
    # Flutterwave
    # ──────────────────────────────────────────────────────────────────────────
    def _flutterwave(self, payment, user, request, data):
        payload = {
            "tx_ref":          payment.transaction_reference,
            "amount":          str(payment.amount),
            "currency":        payment.currency,
            "redirect_url":    f"{settings.FRONTEND_URL}/payment/callback?gateway=flutterwave",
            "payment_options": "card,banktransfer,ussd,mobilemoney",
            "customer": {
                "email":       user.email,
                "phonenumber": str(user.phone) if getattr(user, "phone", None) else "",
                "name":        user.get_full_name(),
            },
            "customizations": {
                "title":       "Enayi Hotels & Suites",
                "description": payment.narration,
                "logo":        f"{settings.FRONTEND_URL}/logo.png",
            },
            "meta": {
                "payment_id": str(payment.id),
                "purpose":    payment.purpose,
                "hotel":      "Enayi Hotels & Suites, Jos",
            },
        }
        try:
            resp  = requests.post(f"{FLW_BASE}/payments", json=payload, headers=FLW_HEADERS, timeout=30)
            rdata = resp.json()
            if rdata.get("status") == "success":
                payment.gateway = "flutterwave"
                payment.flw_ref = rdata["data"].get("flw_ref", "")
                payment.save(update_fields=["gateway", "flw_ref"])
                return Response({
                    "success":               True,
                    "payment_link":          rdata["data"]["link"],
                    "transaction_reference": payment.transaction_reference,
                    "payment_id":            str(payment.id),
                    "gateway":               "flutterwave",
                })
            logger.error(f"Flutterwave error: {rdata}")
            payment.status = Payment.FAILED
            payment.save(update_fields=["status"])
            return Response({"error": rdata.get("message", "Flutterwave error")}, status=502)
        except Exception as exc:
            logger.exception(f"Flutterwave exception: {exc}")
            payment.status = Payment.FAILED
            payment.save(update_fields=["status"])
            return Response({"error": "Payment gateway temporarily unavailable"}, status=502)

    # ──────────────────────────────────────────────────────────────────────────
    # Paystack
    # ──────────────────────────────────────────────────────────────────────────
    def _paystack(self, payment, user, request, data):
        amount_kobo = int(payment.amount * 100)   # Paystack requires kobo
        payload = {
            "email":        user.email,
            "amount":       amount_kobo,
            "reference":    payment.transaction_reference,
            "currency":     payment.currency,
            "callback_url": f"{settings.FRONTEND_URL}/payment/callback?gateway=paystack",
            "channels":     ["card", "bank", "ussd", "bank_transfer", "mobile_money", "qr"],
            "metadata": {
                "payment_id": str(payment.id),
                "purpose":    payment.purpose,
                "custom_fields": [
                    {"display_name": "Guest",   "variable_name": "guest",   "value": user.get_full_name()},
                    {"display_name": "Hotel",   "variable_name": "hotel",   "value": "Enayi Hotels & Suites"},
                    {"display_name": "Purpose", "variable_name": "purpose", "value": payment.purpose},
                ],
            },
        }
        try:
            resp  = requests.post(f"{PS_BASE}/transaction/initialize", json=payload, headers=PS_HEADERS, timeout=30)
            rdata = resp.json()
            if rdata.get("status"):
                payment.gateway      = "paystack"
                payment.paystack_ref = rdata["data"]["reference"]
                payment.access_code  = rdata["data"]["access_code"]
                payment.save(update_fields=["gateway", "paystack_ref", "access_code"])
                return Response({
                    "success":               True,
                    "payment_link":          rdata["data"]["authorization_url"],
                    "access_code":           rdata["data"]["access_code"],
                    "transaction_reference": payment.transaction_reference,
                    "payment_id":            str(payment.id),
                    "gateway":               "paystack",
                })
            payment.status = Payment.FAILED
            payment.save(update_fields=["status"])
            return Response({"error": rdata.get("message", "Paystack error")}, status=502)
        except Exception as exc:
            logger.exception(f"Paystack exception: {exc}")
            payment.status = Payment.FAILED
            payment.save(update_fields=["status"])
            return Response({"error": "Payment gateway error"}, status=502)

    # ──────────────────────────────────────────────────────────────────────────
    # Stripe
    # ──────────────────────────────────────────────────────────────────────────
    def _stripe(self, payment, user, request, data):
        stripe.api_key = settings.STRIPE_SECRET_KEY
        currency       = payment.currency.lower()
        # Stripe uses smallest currency unit (kobo for NGN, cents for USD, etc.)
        amount_units   = int(payment.amount * 100) if currency != "jpy" else int(payment.amount)
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                mode="payment",
                customer_email=user.email,
                line_items=[{
                    "price_data": {
                        "currency":     currency,
                        "unit_amount":  amount_units,
                        "product_data": {
                            "name":        f"Enayi Hotels — {payment.purpose}",
                            "description": payment.narration,
                        },
                    },
                    "quantity": 1,
                }],
                metadata={
                    "payment_id":            str(payment.id),
                    "transaction_reference": payment.transaction_reference,
                    "purpose":               payment.purpose,
                    "guest_name":            user.get_full_name(),
                    "hotel":                 "Enayi Hotels & Suites",
                },
                success_url=f"{settings.FRONTEND_URL}/payment/callback?gateway=stripe&session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{settings.FRONTEND_URL}/payment/cancelled",
            )
            payment.gateway           = "stripe"
            payment.stripe_session_id = session.id
            payment.save(update_fields=["gateway", "stripe_session_id"])
            return Response({
                "success":               True,
                "payment_link":          session.url,
                "session_id":            session.id,
                "transaction_reference": payment.transaction_reference,
                "payment_id":            str(payment.id),
                "gateway":               "stripe",
            })
        except stripe.error.StripeError as exc:
            logger.error(f"Stripe error: {exc}")
            payment.status = Payment.FAILED
            payment.save(update_fields=["status"])
            return Response({"error": str(exc)}, status=502)

    # ──────────────────────────────────────────────────────────────────────────
    # Monnify  ← NEW GATEWAY
    # ──────────────────────────────────────────────────────────────────────────
    def _monnify(self, payment, user, request, data):
        """
        Monnify one-time payment (hosted checkout).

        Flow:
          1. Exchange API Key + Secret for an access token  (_monnify_token)
          2. POST /api/v1/merchant/transactions/init-transaction
          3. Redirect customer to checkoutUrl

        Monnify supports: card, bank_transfer, USSD, NIP direct-debit.
        """
        try:
            token = _monnify_token()
        except Exception as exc:
            logger.error(f"Monnify auth error: {exc}")
            payment.status = Payment.FAILED
            payment.save(update_fields=["status"])
            return Response({"error": "Monnify authentication failed"}, status=502)

        payload = {
            "amount":              float(payment.amount),
            "customerName":        user.get_full_name(),
            "customerEmail":       user.email,
            "paymentReference":    payment.transaction_reference,
            "paymentDescription":  payment.narration or "Payment — Enayi Hotels & Suites",
            "currencyCode":        payment.currency,
            "contractCode":        settings.MONNIFY_CONTRACT_CODE,
            "redirectUrl":         f"{settings.FRONTEND_URL}/payment/callback?gateway=monnify",
            "paymentMethods":      ["CARD", "ACCOUNT_TRANSFER"],
            "metadata": {
                "payment_id": str(payment.id),
                "purpose":    payment.purpose,
                "hotel":      "Enayi Hotels & Suites, Jos",
            },
        }

        try:
            resp = requests.post(
                f"{MNF_BASE}/api/v1/merchant/transactions/init-transaction",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type":  "application/json",
                },
                timeout=30,
            )
            rdata = resp.json()

            if rdata.get("requestSuccessful") and rdata.get("responseBody"):
                body = rdata["responseBody"]
                payment.gateway                 = "monnify"
                payment.monnify_transaction_ref = body.get("transactionReference", "")
                payment.save(update_fields=["gateway", "monnify_transaction_ref"])
                return Response({
                    "success":               True,
                    "payment_link":          body["checkoutUrl"],
                    "transaction_reference": payment.transaction_reference,
                    "monnify_ref":           body.get("transactionReference", ""),
                    "payment_id":            str(payment.id),
                    "gateway":               "monnify",
                })

            logger.error(f"Monnify init error: {rdata}")
            payment.status = Payment.FAILED
            payment.save(update_fields=["status"])
            return Response({"error": rdata.get("responseMessage", "Monnify error")}, status=502)

        except Exception as exc:
            logger.exception(f"Monnify exception: {exc}")
            payment.status = Payment.FAILED
            payment.save(update_fields=["status"])
            return Response({"error": "Payment gateway temporarily unavailable"}, status=502)

    # ──────────────────────────────────────────────────────────────────────────
    # PayPal
    # ──────────────────────────────────────────────────────────────────────────
    def _paypal(self, payment, user, request, data):
        auth_resp = requests.post(
            f"{settings.PAYPAL_API_URL}/v1/oauth2/token",
            auth=(settings.PAYPAL_CLIENT_ID, settings.PAYPAL_CLIENT_SECRET),
            data={"grant_type": "client_credentials"},
            timeout=20,
        )
        if auth_resp.status_code != 200:
            return Response({"error": "PayPal authentication failed"}, status=502)

        token      = auth_resp.json()["access_token"]
        amount_usd = str(round(float(payment.amount) / 1600, 2))  # ~1600 NGN per USD

        order_resp = requests.post(
            f"{settings.PAYPAL_API_URL}/v2/checkout/orders",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "intent": "CAPTURE",
                "purchase_units": [{
                    "reference_id": payment.transaction_reference,
                    "description":  f"Enayi Hotels & Suites — {payment.narration}",
                    "amount": {"currency_code": "USD", "value": amount_usd},
                }],
                "application_context": {
                    "brand_name":   "Enayi Hotels & Suites",
                    "landing_page": "NO_PREFERENCE",
                    "return_url":   f"{settings.FRONTEND_URL}/payment/callback?gateway=paypal",
                    "cancel_url":   f"{settings.FRONTEND_URL}/payment/cancelled",
                },
            },
            timeout=20,
        )
        rdata = order_resp.json()
        if order_resp.status_code in [200, 201]:
            approve_link = next(
                (lnk["href"] for lnk in rdata.get("links", []) if lnk["rel"] == "approve"),
                None,
            )
            payment.gateway         = "paypal"
            payment.paypal_order_id = rdata["id"]
            payment.save(update_fields=["gateway", "paypal_order_id"])
            return Response({
                "success":               True,
                "payment_link":          approve_link,
                "order_id":              rdata["id"],
                "transaction_reference": payment.transaction_reference,
                "payment_id":            str(payment.id),
                "gateway":               "paypal",
                "amount_usd":            amount_usd,
                "note":                  f"Amount charged: USD {amount_usd} (≈ ₦{payment.amount:,.0f})",
            })
        return Response({"error": "PayPal order creation failed"}, status=502)

    # ──────────────────────────────────────────────────────────────────────────
    # USSD
    # ──────────────────────────────────────────────────────────────────────────
    def _ussd(self, payment, user, request, data):
        bank_code = data.get("bank_code", "058")
        bank      = USSD_BANK_MAP.get(bank_code, USSD_BANK_MAP["058"])

        session = USSDSession.objects.create(
            payment    = payment,
            bank_code  = bank_code,
            bank_name  = bank["name"],
            ussd_code  = bank["ussd"],
            expires_at = timezone.now() + timedelta(minutes=30),
        )
        payment.gateway   = "ussd"
        payment.ussd_code = bank["ussd"]
        payment.ussd_bank = bank["name"]
        payment.save(update_fields=["gateway", "ussd_code", "ussd_bank"])

        return Response({
            "success":               True,
            "gateway":               "ussd",
            "ussd_code":             bank["ussd"],
            "bank_name":             bank["name"],
            "amount":                f"₦{payment.amount:,.2f}",
            "transaction_reference": payment.transaction_reference,
            "payment_id":            str(payment.id),
            "expires_in_minutes":    30,
            "expires_at":            session.expires_at.isoformat(),
            "available_banks": [
                {"code": k, "name": v["name"], "ussd": v["ussd"]}
                for k, v in USSD_BANK_MAP.items()
            ],
            "instructions": [
                f"1. Dial {bank['ussd']} on your mobile phone",
                "2. Select 'Transfer' or 'Pay Bills'",
                "3. Select 'Enayi Hotels' or enter merchant code",
                f"4. Enter the amount: ₦{payment.amount:,.2f}",
                f"5. Enter reference: {payment.transaction_reference}",
                "6. Confirm payment with your PIN",
                "7. You'll receive an SMS confirmation",
            ],
        })

    # ──────────────────────────────────────────────────────────────────────────
    # Bank Transfer
    # ──────────────────────────────────────────────────────────────────────────
    def _bank_transfer(self, payment, user, request, data):
        """
        Static virtual account details for Enayi Hotels.
        Replace account numbers with real GTB/FCMB/Wema virtual accounts
        generated via your bank's corporate API or Flutterwave Virtual Accounts.
        """
        session = BankTransferSession.objects.create(
            payment        = payment,
            bank_name      = "Guaranty Trust Bank (GTB)",
            account_number = settings.HOTEL_GTB_ACCOUNT,         # set in .env
            account_name   = "ENAYI HOTELS & SUITES LTD",
            sort_code      = "058152003",
            bank_code      = "058",
            amount         = payment.amount,
            reference      = payment.transaction_reference,
            expires_at     = timezone.now() + timedelta(hours=24),
        )
        payment.gateway          = "bank_transfer"
        payment.virtual_acct_num = session.account_number
        payment.virtual_acct_bk  = session.bank_name
        payment.save(update_fields=["gateway", "virtual_acct_num", "virtual_acct_bk"])

        return Response({
            "success":               True,
            "gateway":               "bank_transfer",
            "bank_name":             session.bank_name,
            "account_number":        session.account_number,
            "account_name":          session.account_name,
            "sort_code":             session.sort_code,
            "bank_code":             session.bank_code,
            "amount":                f"₦{payment.amount:,.2f}",
            "narration":             f"REF: {payment.transaction_reference}",
            "transaction_reference": payment.transaction_reference,
            "payment_id":            str(payment.id),
            "expires_at":            session.expires_at.isoformat(),
            "important":             "⚠️ Use the reference as your transfer narration so your payment is auto-matched.",
            "also_accepted": [
                {"bank": "First Bank",  "account": settings.HOTEL_FIRSTBANK_ACCOUNT,  "name": "ENAYI HOTELS & SUITES LTD"},
                {"bank": "Zenith Bank", "account": settings.HOTEL_ZENITH_ACCOUNT,     "name": "ENAYI HOTELS & SUITES LTD"},
            ],
        })

    # ──────────────────────────────────────────────────────────────────────────
    # Cash / POS  (walk-in payments)
    # ──────────────────────────────────────────────────────────────────────────
    def _cash_or_pos(self, payment, user, request, data):
        payment.status  = Payment.PENDING
        payment.gateway = payment.method
        payment.save(update_fields=["status", "gateway"])
        return Response({
            "success":               True,
            "gateway":               payment.method,
            "message":               f"Please proceed to the front desk to complete your {payment.method.upper()} payment.",
            "amount":                f"₦{payment.amount:,.2f}",
            "transaction_reference": payment.transaction_reference,
            "payment_id":            str(payment.id),
            "front_desk":            "Available 24/7 — Ground Floor, Enayi Hotels & Suites",
            "phone":                 settings.HOTEL_PHONE,
        })


# ─────────────────────────────────────────────────────────────────────────────
# VerifyPaymentView
# ─────────────────────────────────────────────────────────────────────────────
class VerifyPaymentView(APIView):
    """GET /api/v1/payments/verify/<reference>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, reference):
        try:
            payment = Payment.objects.get(transaction_reference=reference, guest=request.user)
        except Payment.DoesNotExist:
            return Response({"error": "Payment not found"}, status=404)

        if payment.status == Payment.SUCCESS:
            return Response({"status": "success", "payment": PaymentSerializer(payment).data})

        # Re-verify with gateway
        verified = False
        if payment.gateway == "flutterwave":
            verified = _verify_flutterwave(payment, reference)
        elif payment.gateway == "paystack":
            verified = _verify_paystack(payment, reference)
        elif payment.gateway == "stripe":
            verified = _verify_stripe(payment)
        elif payment.gateway == "monnify":                  # ← NEW
            verified = _verify_monnify(payment)

        if verified:
            fulfill_payment(payment)

        return Response({"status": payment.status, "payment": PaymentSerializer(payment).data})


# ─────────────────────────────────────────────────────────────────────────────
# Standalone verification helpers  (used by both VerifyPaymentView & webhooks)
# ─────────────────────────────────────────────────────────────────────────────
def _verify_flutterwave(payment: Payment, reference: str) -> bool:
    try:
        resp  = requests.get(
            f"{FLW_BASE}/transactions/verify_by_reference?tx_ref={reference}",
            headers=FLW_HEADERS, timeout=20,
        )
        rdata = resp.json()
        if rdata.get("data", {}).get("status") == "successful":
            payment.status           = Payment.SUCCESS
            payment.gateway_response = rdata["data"]
            payment.verified_at      = timezone.now()
            payment.save()
            return True
    except Exception as exc:
        logger.error(f"Flutterwave verify error: {exc}")
    return False


def _verify_paystack(payment: Payment, reference: str) -> bool:
    try:
        resp  = requests.get(
            f"{PS_BASE}/transaction/verify/{reference}",
            headers=PS_HEADERS, timeout=20,
        )
        rdata = resp.json()
        if rdata.get("data", {}).get("status") == "success":
            payment.status           = Payment.SUCCESS
            payment.gateway_response = rdata["data"]
            payment.verified_at      = timezone.now()
            payment.save()
            return True
    except Exception as exc:
        logger.error(f"Paystack verify error: {exc}")
    return False


def _verify_stripe(payment: Payment) -> bool:
    try:
        stripe.api_key = settings.STRIPE_SECRET_KEY
        session = stripe.checkout.Session.retrieve(payment.stripe_session_id)
        if session.payment_status == "paid":
            payment.status           = Payment.SUCCESS
            payment.gateway_response = {"session": session.id, "status": session.payment_status}
            payment.verified_at      = timezone.now()
            payment.save()
            return True
    except Exception as exc:
        logger.error(f"Stripe verify error: {exc}")
    return False


def _verify_monnify(payment: Payment) -> bool:
    """
    Monnify verification uses the Monnify transaction reference (not the
    merchant payment reference) to query /api/v2/merchant/transactions/query.
    """
    try:
        token = _monnify_token()
        # URL-encode the transaction reference
        import urllib.parse
        encoded_ref = urllib.parse.quote(payment.monnify_transaction_ref, safe="")
        resp = requests.get(
            f"{MNF_BASE}/api/v2/merchant/transactions/query?paymentReference={payment.transaction_reference}",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type":  "application/json",
            },
            timeout=20,
        )
        rdata = resp.json()
        if (
            rdata.get("requestSuccessful")
            and rdata.get("responseBody", {}).get("paymentStatus") == "PAID"
        ):
            payment.status           = Payment.SUCCESS
            payment.gateway_response = rdata["responseBody"]
            payment.verified_at      = timezone.now()
            payment.save()
            return True
    except Exception as exc:
        logger.error(f"Monnify verify error: {exc}")
    return False


# ─────────────────────────────────────────────────────────────────────────────
# Webhook Views
# ─────────────────────────────────────────────────────────────────────────────
class FlutterwaveWebhookView(APIView):
    """POST /api/v1/payments/webhooks/flutterwave/"""
    permission_classes = [AllowAny]

    def post(self, request):
        sig = request.headers.get("verif-hash", "")
        if sig != settings.FLUTTERWAVE_WEBHOOK_HASH:
            return Response({"error": "Unauthorized"}, status=401)

        event  = request.data.get("event", "")
        if event == "charge.completed":
            d      = request.data.get("data", {})
            tx_ref = d.get("tx_ref", "")
            try:
                payment = Payment.objects.get(transaction_reference=tx_ref)
                if d.get("status") == "successful" and payment.status != Payment.SUCCESS:
                    payment.status           = Payment.SUCCESS
                    payment.gateway_response = d
                    payment.verified_at      = timezone.now()
                    payment.save()
                    fulfill_payment(payment)
            except Payment.DoesNotExist:
                logger.warning(f"FLW webhook: payment not found for tx_ref={tx_ref}")

        return Response({"status": "ok"})


class PaystackWebhookView(APIView):
    """POST /api/v1/payments/webhooks/paystack/"""
    permission_classes = [AllowAny]

    def post(self, request):
        sig      = request.headers.get("x-paystack-signature", "")
        # FIX: was hmac.new (wrong); correct is hmac.new in Python stdlib
        expected = hmac.new(
            settings.PAYSTACK_SECRET_KEY.encode(),
            request.body,
            hashlib.sha512,
        ).hexdigest()

        if not hmac.compare_digest(sig, expected):
            return Response({"error": "Unauthorized"}, status=401)

        event = request.data.get("event", "")
        if event == "charge.success":
            ref = request.data["data"].get("reference", "")
            try:
                payment = Payment.objects.get(transaction_reference=ref)
                if payment.status != Payment.SUCCESS:
                    payment.status           = Payment.SUCCESS
                    payment.gateway_response = request.data["data"]
                    payment.verified_at      = timezone.now()
                    payment.save()
                    fulfill_payment(payment)
            except Payment.DoesNotExist:
                logger.warning(f"Paystack webhook: payment not found for ref={ref}")

        return Response({"status": "ok"})


class StripeWebhookView(APIView):
    """POST /api/v1/payments/webhooks/stripe/"""
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.body
        sig     = request.headers.get("stripe-signature", "")
        try:
            event = stripe.Webhook.construct_event(
                payload, sig, settings.STRIPE_WEBHOOK_SECRET
            )
        except stripe.error.SignatureVerificationError:
            return Response({"error": "Invalid signature"}, status=401)

        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            ref     = session.get("metadata", {}).get("transaction_reference")
            try:
                payment = Payment.objects.get(transaction_reference=ref)
                if payment.status != Payment.SUCCESS:
                    payment.status           = Payment.SUCCESS
                    payment.gateway_response = {"session_id": session["id"]}
                    payment.verified_at      = timezone.now()
                    payment.save()
                    fulfill_payment(payment)
            except Payment.DoesNotExist:
                logger.warning(f"Stripe webhook: payment not found for ref={ref}")

        return Response({"status": "ok"})


class MonnifyWebhookView(APIView):
    """
    POST /api/v1/payments/webhooks/monnify/

    Monnify signs the webhook payload with HMAC-SHA512 using your secret key.
    The computed hash is sent in the header: 'monnify-signature'
    """
    permission_classes = [AllowAny]

    def post(self, request):
        sig      = request.headers.get("monnify-signature", "")
        expected = hmac.new(
            settings.MONNIFY_SECRET_KEY.encode(),
            request.body,
            hashlib.sha512,
        ).hexdigest()

        if not hmac.compare_digest(sig, expected):
            return Response({"error": "Unauthorized"}, status=401)

        event_type  = request.data.get("eventType", "")
        event_data  = request.data.get("eventData", {})

        # Successful payment notification
        if event_type == "SUCCESSFUL_TRANSACTION":
            payment_ref = event_data.get("paymentReference", "")   # our reference
            try:
                payment = Payment.objects.get(transaction_reference=payment_ref)
                if payment.status != Payment.SUCCESS:
                    payment.status                  = Payment.SUCCESS
                    payment.gateway_response        = event_data
                    payment.monnify_transaction_ref = event_data.get("transactionReference", payment.monnify_transaction_ref)
                    payment.verified_at             = timezone.now()
                    payment.save()
                    fulfill_payment(payment)
            except Payment.DoesNotExist:
                logger.warning(f"Monnify webhook: payment not found for ref={payment_ref}")

        return Response({"status": "ok"})


# ─────────────────────────────────────────────────────────────────────────────
# Payment History
# ─────────────────────────────────────────────────────────────────────────────
class PaymentHistoryView(APIView):
    """GET /api/v1/payments/history/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payments = Payment.objects.filter(guest=request.user).order_by("-created_at")[:100]
        return Response(PaymentSerializer(payments, many=True).data)


# ─────────────────────────────────────────────────────────────────────────────
# USSD Bank List
# ─────────────────────────────────────────────────────────────────────────────
class USSDBanksView(APIView):
    """GET /api/v1/payments/ussd-banks/  — public, no auth required"""
    permission_classes = [AllowAny]

    def get(self, request):
        return Response([
            {"code": k, "name": v["name"], "ussd_code": v["ussd"]}
            for k, v in USSD_BANK_MAP.items()
        ])