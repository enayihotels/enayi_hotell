from django.contrib import admin
from .models import ChatSession, ChatMessage

class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    extra = 0
    readonly_fields = ["role","content","tokens","created_at"]
    can_delete = False

@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ["user","title","is_active","created_at","updated_at"]
    list_filter  = ["is_active"]
    search_fields= ["user__email","title"]
    inlines = [ChatMessageInline]

@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ["session","role","tokens","created_at"]
    list_filter  = ["role"]