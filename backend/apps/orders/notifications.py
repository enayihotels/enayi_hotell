"""
Instant SMS + email notifications to Kitchen/Bar Staff the moment a
guest places a new order — so they don't have to keep the app open and
refresh to check for new work. Split by what's actually in the order:
a food item notifies that branch's Kitchen Staff, a drink item notifies
that branch's Bar Staff, and an order with both notifies both groups.

Scoped strictly to the order's own branch (order.hotel) — Rayfield
orders never notify Zarmaganda staff and vice versa, same rule as
everywhere else in the app.

Nothing here ever blocks or fails an order. A guest's order is already
committed to the database by the time this runs; if Termii is down, a
staff member has no phone number on file, or the email server hiccups,
the order still succeeds — we just log it and move on. This mirrors
the existing fail_silently=True pattern already used for OTP emails
(see apps.accounts.views.send_otp).
"""
import logging
import requests
from django.conf import settings
from django.core.mail import send_mail

from .views import FOOD_TYPES, DRINK_TYPES

logger = logging.getLogger(__name__)

TERMII_SMS_URL = "https://api.ng.termii.com/api/sms/send"


def _send_sms(phone, message):
    """Best-effort SMS via Termii. phone is whatever's stored on the
    User (django-phonenumber-field, E.164 like '+2348131831326') —
    Termii wants it without the leading '+'. Returns True/False, never
    raises — callers treat this as fire-and-forget."""
    if not settings.TERMII_API_KEY:
        logger.info("Termii not configured (no TERMII_API_KEY) — skipping SMS to %s", phone)
        return False
    if not phone:
        return False

    digits = str(phone).lstrip("+")
    try:
        resp = requests.post(
            TERMII_SMS_URL,
            json={
                "api_key": settings.TERMII_API_KEY,
                "to": digits,
                "from": settings.TERMII_SENDER_ID,
                "sms": message,
                "type": "plain",
                "channel": "generic",
            },
            timeout=10,
        )
        if resp.status_code >= 400:
            logger.warning("Termii SMS to %s failed: %s %s", digits, resp.status_code, resp.text[:300])
            return False
        return True
    except requests.RequestException as exc:
        logger.warning("Termii SMS to %s raised %s", digits, exc)
        return False


def _notify_staff(staff_user, order, label):
    """SMS + email one staff member about one order. label is 'food' or 'drink'."""
    room_bit = f" for Room {order.room.room_number}" if order.room else ""
    sms_text = (
        f"Enayi Hotels: New {label} order {order.order_number}{room_bit}. "
        f"Check the app for details."
    )
    _send_sms(staff_user.phone, sms_text)

    if staff_user.email:
        try:
            send_mail(
                f"New {label.title()} Order — {order.order_number}",
                f"A new {label} order just came in{room_bit}.\n\n"
                f"Order: {order.order_number}\n"
                f"Branch: {order.hotel.name if order.hotel_id else 'N/A'}\n\n"
                f"Open the app to see the full order and mark it as you go.\n\n"
                f"Enayi Hotels & Suites",
                settings.DEFAULT_FROM_EMAIL, [staff_user.email], fail_silently=True,
            )
        except Exception:
            logger.exception("Order-notification email to %s failed", staff_user.email)


def notify_new_order(order):
    """Call this once, right after an Order (with its items) is fully
    committed. Figures out which roles need notifying from what's
    actually in the order, and messages every matching staff member at
    that branch — not just one person, so nobody misses it because the
    one person on duty happened to be busy."""
    if not order.hotel_id:
        return

    from apps.accounts.models import User

    item_types = set(
        order.items.select_related("menu_item__category")
        .values_list("menu_item__category__type", flat=True)
    )
    has_food = bool(item_types & FOOD_TYPES)
    has_drink = bool(item_types & DRINK_TYPES)

    if has_food:
        kitchen_staff = User.objects.filter(
            role="kitchen_staff", hotel_id=order.hotel_id, is_active=True,
        )
        for staff_user in kitchen_staff:
            _notify_staff(staff_user, order, "food")

    if has_drink:
        bar_staff = User.objects.filter(
            role="bar_staff", hotel_id=order.hotel_id, is_active=True,
        )
        for staff_user in bar_staff:
            _notify_staff(staff_user, order, "drink")
