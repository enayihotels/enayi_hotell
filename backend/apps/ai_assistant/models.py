"""Enayi Hotels — ARIA AI Concierge Models"""
import uuid
from django.db import models


class ChatSession(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="chat_sessions")
    title      = models.CharField(max_length=200, default="New Conversation")
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_sessions"
        ordering = ["-updated_at"]

    def __str__(self): return f"{self.user.get_full_name()} — {self.title}"


class ChatMessage(models.Model):
    ROLES = [("user","User"),("assistant","Assistant"),("system","System")]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session    = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name="messages")
    role       = models.CharField(max_length=20, choices=ROLES)
    content    = models.TextField()
    tokens     = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_messages"
        ordering = ["created_at"]
