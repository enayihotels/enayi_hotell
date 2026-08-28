"""Contact form notification email — styled consistently with the
other guest-facing emails in this codebase (check-in OTP, laundry
ready)."""
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.utils import timezone

# Owner (Patrick Ogwuche) and Admin (Angus Ogwuche) both have this
# inbox on their phones' Gmail apps, which notifies natively the
# instant a new email lands — no custom push infrastructure needed.
CONTACT_NOTIFY_TO = "enayihotels@gmail.com"

CONTACT_HTML = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body {{ margin:0; padding:0; background:#f4f4f4; font-family:'Segoe UI',Arial,sans-serif; }}
  .wrap {{ max-width:600px; margin:0 auto; background:#fff; }}
  .header {{ background:#0B1120; padding:32px 40px; text-align:center; }}
  .header h1 {{ color:#C9A227; font-size:24px; margin:0; letter-spacing:2px; }}
  .header p {{ color:#8A9AB5; font-size:11px; margin:6px 0 0; letter-spacing:2px; text-transform:uppercase; }}
  .gold-bar {{ height:3px; background:linear-gradient(90deg,transparent,#C9A227,#E4BB35,#C9A227,transparent); }}
  .body {{ padding:32px 40px; }}
  .details {{ background:#f9f9f9; border-radius:10px; padding:18px 22px; margin-bottom:20px; }}
  .details .row {{ font-size:14px; padding:6px 0; color:#333; }}
  .details .label {{ color:#888; font-size:11px; text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:2px; }}
  .message {{ white-space:pre-wrap; line-height:1.6; }}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>ENAYI HOTELS</h1>
    <p>New Contact Form Message</p>
  </div>
  <div class="gold-bar"></div>
  <div class="body">
    <div class="details">
      <div class="row"><span class="label">From</span>{name} &lt;{email}&gt;</div>
      {phone_row}
      {subject_row}
      <div class="row"><span class="label">Received</span>{received_at}</div>
    </div>
    <div class="details">
      <span class="label">Message</span>
      <div class="message">{message}</div>
    </div>
    <p style="color:#888; font-size:12px;">Reply directly to this email to respond to {name}.</p>
  </div>
</div>
</body>
</html>
"""


def send_contact_notification(contact_message) -> bool:
    """Emails the new contact message to enayihotels@gmail.com. Returns
    True if it actually sent, False if it failed (message is still
    saved to the database regardless, so nothing is lost even if
    email delivery has a problem)."""
    try:
        received_local = timezone.localtime(contact_message.created_at)
        phone_row = (
            f'<div class="row"><span class="label">Phone</span>{contact_message.phone}</div>'
            if contact_message.phone else ""
        )
        subject_row = (
            f'<div class="row"><span class="label">Subject</span>{contact_message.subject}</div>'
            if contact_message.subject else ""
        )

        html = CONTACT_HTML.format(
            name=contact_message.name,
            email=contact_message.email,
            phone_row=phone_row,
            subject_row=subject_row,
            received_at=received_local.strftime("%b %d, %Y %I:%M %p"),
            message=contact_message.message,
        )
        text = (
            f"New Contact Form Message — Enayi Hotels\n"
            f"{'='*40}\n"
            f"From: {contact_message.name} <{contact_message.email}>\n"
            + (f"Phone: {contact_message.phone}\n" if contact_message.phone else "")
            + (f"Subject: {contact_message.subject}\n" if contact_message.subject else "")
            + f"Received: {received_local.strftime('%b %d, %Y %I:%M %p')}\n\n"
            f"{contact_message.message}\n"
            f"{'='*40}\n"
        )

        subject_line = f"New message from {contact_message.name}" + (
            f" — {contact_message.subject}" if contact_message.subject else ""
        )

        msg = EmailMultiAlternatives(
            subject=subject_line,
            body=text,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "Enayi Hotels <noreply@enayihotels.com>"),
            to=[CONTACT_NOTIFY_TO],
            reply_to=[contact_message.email],
        )
        msg.attach_alternative(html, "text/html")
        msg.send(fail_silently=False)
        return True

    except Exception as exc:
        import logging
        logging.getLogger("apps.contact").error(f"Contact notification email error: {exc}")
        return False
