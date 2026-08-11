"""Check-in verification code email utility for Enayi Hotels.

Sent to the guest's registered email when a staff member starts the
check-in process. The guest reads the code back to staff (or shows it on
their phone) — this proves the person checking in is the actual account
holder, not just whoever staff decided to mark as checked in.
"""
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.utils import timezone

CHECKIN_OTP_HTML = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body {{ margin:0; padding:0; background:#f4f4f4; font-family:'Segoe UI',Arial,sans-serif; }}
  .wrap {{ max-width:600px; margin:0 auto; background:#fff; }}
  .header {{ background:#0B1120; padding:32px 40px; text-align:center; }}
  .header h1 {{ color:#C9A227; font-size:28px; margin:0; letter-spacing:2px; }}
  .header p {{ color:#8A9AB5; font-size:12px; margin:8px 0 0; letter-spacing:3px; text-transform:uppercase; }}
  .gold-bar {{ height:3px; background:linear-gradient(90deg,transparent,#C9A227,#E4BB35,#C9A227,transparent); }}
  .body {{ padding:40px; text-align:center; }}
  .greeting {{ font-size:16px; color:#111; margin-bottom:8px; text-align:left; }}
  .lead {{ color:#444; font-size:14px; line-height:1.7; text-align:left; margin-bottom:28px; }}
  .code-box {{ background:#0B1120; border-radius:10px; padding:28px; margin:0 auto 24px; }}
  .code {{ color:#C9A227; font-size:40px; font-weight:800; letter-spacing:10px; }}
  .expiry {{ color:#888; font-size:12px; margin-top:20px; }}
  .footer {{ background:#0B1120; padding:24px 40px; text-align:center; }}
  .footer p {{ color:#8A9AB5; font-size:12px; margin:4px 0; }}
  .footer .phone {{ color:#C9A227; font-size:13px; font-weight:600; }}
  @media (max-width:600px) {{ .body {{ padding:24px; }} .header {{ padding:24px; }} }}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>ENAYI HOTELS</h1>
    <p>&amp; Suites &middot; Jos, Plateau State &middot; Nigeria</p>
  </div>
  <div class="gold-bar"></div>
  <div class="body">
    <p class="greeting">Dear <strong>{guest_name}</strong>,</p>
    <p class="lead">
      Please share this code with our front desk team to complete your
      check-in for booking <strong>{booking_reference}</strong>, Room
      {room_number}.
    </p>
    <div class="code-box"><span class="code">{code}</span></div>
    <p class="expiry">This code expires at {expires_at}. Never share it with anyone except Enayi Hotels front desk staff in person.</p>
  </div>
  <div class="footer">
    <p class="phone">{hotel_phone}</p>
    <p>Enayi Hotels &amp; Suites &middot; Rayfield Road, Jos, Plateau State</p>
    <p>&copy; {year} Enayi Hotels &amp; Suites. All rights reserved.</p>
  </div>
</div>
</body>
</html>
"""


def send_checkin_otp_email(booking, code: str) -> bool:
    """Sends the check-in code to the guest's registered email.
    Returns True if an email was sent, False otherwise (no email on file,
    or send failed) — the caller decides how to handle that.
    """
    guest = booking.guest
    if not guest.email:
        return False

    try:
        expires_local = timezone.localtime(booking.checkin_otp_expires_at)
        html = CHECKIN_OTP_HTML.format(
            guest_name=guest.get_full_name() or guest.email,
            booking_reference=booking.booking_reference,
            room_number=booking.room.room_number if booking.room_id else "—",
            code=code,
            expires_at=expires_local.strftime("%I:%M %p"),
            hotel_phone=getattr(settings, "HOTEL_PHONE", "+234-800-000-0000"),
            year=timezone.now().year,
        )
        text = (
            f"Enayi Hotels & Suites — Check-in Code\n"
            f"{'='*40}\n"
            f"Booking: {booking.booking_reference}\n"
            f"Room: {booking.room.room_number if booking.room_id else '—'}\n"
            f"Your check-in code: {code}\n"
            f"Expires at: {expires_local.strftime('%I:%M %p')}\n"
            f"{'='*40}\n"
            f"Share this code with front desk staff to complete check-in.\n"
        )

        msg = EmailMultiAlternatives(
            subject=f"Your check-in code for {booking.booking_reference} — Enayi Hotels",
            body=text,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "Enayi Hotels <noreply@enayihotels.com>"),
            to=[guest.email],
            reply_to=["info@enayihotels.com"],
        )
        msg.attach_alternative(html, "text/html")
        msg.send(fail_silently=False)
        return True

    except Exception as exc:
        import logging
        logging.getLogger("apps.bookings").error(f"Check-in OTP email error for {booking.booking_reference}: {exc}")
        return False
