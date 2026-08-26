"""Laundry-ready notification email for Enayi Hotels.

Sent to the guest's email on file the moment Laundry Staff marks a
ticket ready. Mirrors apps.bookings.checkin_otp_email's styling so
guest-facing emails look consistent across the system.
"""
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.utils import timezone

LAUNDRY_READY_HTML = """
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
  .body {{ padding:40px; }}
  .greeting {{ font-size:16px; color:#111; margin-bottom:8px; }}
  .lead {{ color:#444; font-size:14px; line-height:1.7; margin-bottom:24px; }}
  .details {{ background:#f9f9f9; border-radius:10px; padding:20px 24px; margin-bottom:24px; }}
  .details .row {{ display:flex; justify-content:space-between; font-size:14px; padding:6px 0; color:#333; }}
  .details .label {{ color:#888; }}
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
      Your laundry is ready for pickup{room_line}. Please collect it at your
      earliest convenience.
    </p>
    <div class="details">
      {items_rows}
      <div class="row" style="border-top:1px solid #eee; margin-top:8px; padding-top:10px; font-weight:600;"><span class="label">Total due</span><span>&#8358;{price}</span></div>
      <div class="row"><span class="label">Ready since</span><span>{ready_at}</span></div>
    </div>
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


def send_laundry_ready_email(ticket) -> bool:
    """Sends the "your laundry is ready" email to the guest's address
    on file. Returns True if an email was sent, False otherwise (no
    email on file, or send failed) — the caller decides how to handle
    that, same pattern as send_checkin_otp_email."""
    if not ticket.guest_email:
        return False

    try:
        ready_local = timezone.localtime(ticket.ready_at) if ticket.ready_at else timezone.localtime(timezone.now())
        room_line = f", Room {ticket.room.room_number}" if ticket.room_id else ""

        lines = list(ticket.line_items.all())
        items_rows = "".join(
            f'<div class="row"><span>{l.quantity}x {l.item_name}</span><span>&#8358;{l.unit_price * l.quantity:,.2f}</span></div>'
            for l in lines
        )
        items_text = "\n".join(f"  {l.quantity}x {l.item_name} — NGN {l.unit_price * l.quantity:,.2f}" for l in lines)

        html = LAUNDRY_READY_HTML.format(
            guest_name=ticket.guest_name,
            room_line=room_line,
            items_rows=items_rows,
            price=f"{ticket.total_price:,.2f}",
            ready_at=ready_local.strftime("%b %d, %I:%M %p"),
            hotel_phone=getattr(settings, "HOTEL_PHONE", "+234-800-000-0000"),
            year=timezone.now().year,
        )
        text = (
            f"Enayi Hotels & Suites — Laundry Ready\n"
            f"{'='*40}\n"
            f"Dear {ticket.guest_name},\n\n"
            f"Your laundry is ready for pickup{room_line}.\n\n"
            f"Items:\n{items_text}\n\n"
            f"Total due: NGN {ticket.total_price:,.2f}\n"
            f"Ready since: {ready_local.strftime('%b %d, %I:%M %p')}\n"
            f"{'='*40}\n"
        )

        msg = EmailMultiAlternatives(
            subject="Your laundry is ready — Enayi Hotels",
            body=text,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "Enayi Hotels <noreply@enayihotels.com>"),
            to=[ticket.guest_email],
            reply_to=["info@enayihotels.com"],
        )
        msg.attach_alternative(html, "text/html")
        msg.send(fail_silently=False)
        return True

    except Exception as exc:
        import logging
        logging.getLogger("apps.laundry").error(f"Laundry ready email error for ticket {ticket.id}: {exc}")
        return False
