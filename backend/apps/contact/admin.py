from django.contrib import admin
from .models import ContactMessage


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "phone", "subject", "emailed", "created_at"]
    list_filter = ["emailed"]
    search_fields = ["name", "email", "message"]
    readonly_fields = ["id", "created_at"]
