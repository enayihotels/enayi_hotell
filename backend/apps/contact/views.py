"""Enayi Hotels — Public Contact Form Views"""
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from .models import ContactMessage
from .serializers import ContactMessageSerializer
from .email_utils import send_contact_notification


class ContactMessageCreateView(generics.CreateAPIView):
    """POST /api/v1/contact/
    Public — no login required, this is the marketing site's contact
    form. Saves the message first (so it's never lost even if email
    delivery has a problem), then emails it to enayihotels@gmail.com.
    """
    serializer_class = ContactMessageSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contact_message = serializer.save()

        sent = send_contact_notification(contact_message)
        contact_message.emailed = sent
        contact_message.save(update_fields=["emailed"])

        return Response(
            {"success": True, "message": "Message sent! We'll respond within 24 hours."},
            status=201,
        )
