"""Payment receipt email utility for Enayi Hotels."""
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.utils import timezone


RECEIPT_HTML = """
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
  .greeting {{ font-size:18px; color:#111; margin-bottom:24px; }}
  .receipt-box {{ background:#f9f9f9; border:1px solid #e5e5e5; border-radius:8px; padding:24px; margin:24px 0; }}
  .receipt-title {{ font-size:13px; font-weight:700; color:#C9A227; text-transform:uppercase; letter-spacing:2px; margin-bottom:16px; }}
  .row {{ display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee; font-size:14px; }}
  .row:last-child {{ border-bottom:none; }}
  .row .label {{ color:#666; }}
  .row .value {{ color:#111; font-weight:600; text-align:right; }}
  .total-row {{ background:#0B1120; border-radius:6px; padding:14px 16px; display:flex; justify-content:space-between; margin-top:16px; }}
  .total-row .label {{ color:#8A9AB5; font-size:14px; font-weight:600; }}
  .total-row .value {{ color:#C9A227; font-size:20px; font-weight:700; }}
  .status-badge {{ display:inline-block; background:#10b98120; color:#10b981; border:1px solid #10b98140; border-radius:20px; padding:4px 16px; font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; }}
  .footer {{ background:#0B1120; padding:24px 40px; text-align:center; }}
  .footer p {{ color:#8A9AB5; font-size:12px; margin:4px 0; }}
  .footer .phone {{ color:#C9A227; font-size:13px; font-weight:600; }}
  .divider {{ border:none; border-top:1px solid #eee; margin:24px 0; }}
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
    <p style="color:#444;font-size:14px;line-height:1.7;">
      Thank you for your payment. Your transaction has been processed successfully.
      Please keep this receipt for your records.
    </p>

    <div class="receipt-box">
      <div class="receipt-title">Payment Receipt</div>
      <div class="row"><span class="label">Receipt No.</span><span class="value">{transaction_reference}</span></div>
      <div class="row"><span class="label">Date &amp; Time</span><span class="value">{payment_date}</span></div>
      <div class="row"><span class="label">Guest</span><span class="value">{guest_name}</span></div>
      <div class="row"><span class="label">Email</span><span class="value">{guest_email}</span></div>
      <div class="row"><span class="label">Purpose</span><span class="value">{purpose}</span></div>
      <div class="row"><span class="label">Payment Method</span><span class="value">{method}</span></div>
      <div class="row"><span class="label">Gateway Ref</span><span class="value">{gateway_ref}</span></div>
      <div class="row"><span class="label">Status</span><span class="value"><span class="status-badge">Successful</span></span></div>
      <div class="total-row">
        <span class="label">Amount Paid</span>
        <span class="value">{currency} {amount}</span>
      </div>
    </div>

    <hr class="divider">
    <p style="color:#888;font-size:13px;line-height:1.7;">
      If you have any questions about this transaction, please contact us at
      <a href="mailto:info@enayihotels.com" style="color:#C9A227;">info@enayihotels.com</a>
      or call us at <strong>+234(0)9138943008</strong>.
    </p>
  </div>
  <div class="footer">
    <p class="phone">+234(0)9138943008 &nbsp;&middot;&nbsp; +234(0)901 5636764</p>
    <p>Rayfield Zarmaganda Road, Off Railway Crossing, Jos Plateau State</p>
    <p style="margin-top:12px;color:#555;">&copy; {year} Enayi Hotels &amp; Suites. All rights reserved.</p>
  </div>
</div>
</body>
</html>
"""


def send_payment_receipt(payment):
    """Send a payment receipt email to the guest after successful payment."""
    try:
        guest = payment.guest
        if not guest.email:
            return

        # Build receipt context
        method_labels = {
            "flutterwave": "Flutterwave", "paystack": "Paystack",
            "stripe": "Stripe", "monnify": "Monnify", "paypal": "PayPal",
            "ussd": "USSD", "bank_transfer": "Bank Transfer",
            "cash": "Cash", "pos": "POS / Card Terminal",
        }
        purpose_labels = {
            "booking": "Room Booking", "order": "Food & Drink Order",
            "event": "Event Hall", "gym": "Gym Session",
        }
        gateway_ref = (
            payment.paystack_ref or payment.flw_ref or
            payment.stripe_session_id or payment.paypal_order_id or
            payment.transaction_reference
        )
        html = RECEIPT_HTML.format(
            guest_name=guest.get_full_name() or guest.email,
            guest_email=guest.email,
            transaction_reference=payment.transaction_reference,
            payment_date=timezone.localtime(
                payment.verified_at or payment.created_at
            ).strftime("%d %b %Y, %I:%M %p"),
            purpose=purpose_labels.get(payment.purpose, payment.purpose.title()),
            method=method_labels.get(payment.method, payment.method.title()),
            gateway_ref=gateway_ref or "N/A",
            currency=payment.currency,
            amount=f"{payment.amount:,.2f}",
            year=timezone.now().year,
        )
        text = (
            f"Payment Receipt - Enayi Hotels & Suites\n"
            f"{'='*50}\n"
            f"Guest: {guest.get_full_name()}\n"
            f"Receipt No: {payment.transaction_reference}\n"
            f"Amount: {payment.currency} {payment.amount:,.2f}\n"
            f"Purpose: {purpose_labels.get(payment.purpose, payment.purpose)}\n"
            f"Date: {timezone.localtime(payment.verified_at or payment.created_at).strftime('%d %b %Y %I:%M %p')}\n"
            f"Status: SUCCESSFUL\n"
            f"{'='*50}\n"
            f"Enayi Hotels & Suites, Jos, Plateau State\n"
            f"Tel: +234(0)9138943008 | +234(0)901 5636764\n"
        )

        msg = EmailMultiAlternatives(
            subject=f"Payment Receipt #{payment.transaction_reference} - Enayi Hotels",
            body=text,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "Enayi Hotels <noreply@enayihotels.com>"),
            to=[guest.email],
            reply_to=["info@enayihotels.com"],
        )
        msg.attach_alternative(html, "text/html")
        msg.send(fail_silently=True)

    except Exception as exc:
        import logging
        logging.getLogger("apps.payments").error(f"Receipt email error: {exc}")
