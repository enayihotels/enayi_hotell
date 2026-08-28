"""Enayi Hotels — Public Contact Form

The public site's "Send Message" form was previously a UI mock — it
never actually called any backend, just faked a delay and showed a
success toast. This is the real endpoint: every submission is both
stored here (so a message survives even if the email happens to fail)
and emailed to enayihotels@gmail.com, which the Owner and Admin have
on their phones' Gmail apps for an instant native notification —
no custom push infrastructure needed.
"""
import uuid
from django.db import models


class ContactMessage(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name       = models.CharField(max_length=150)
    email      = models.EmailField()
    phone      = models.CharField(max_length=30, blank=True)
    subject    = models.CharField(max_length=200, blank=True)
    message    = models.TextField()
    emailed    = models.BooleanField(default=False, help_text="True once the notification email to enayihotels@gmail.com actually sent successfully.")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "contact_messages"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} <{self.email}> — {self.created_at:%b %d, %Y}"
