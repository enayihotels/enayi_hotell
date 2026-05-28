"""Enayi Hotels — AI Assistant Serializers"""
from rest_framework import serializers
from .models import ChatSession, ChatMessage


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ChatMessage
        fields = ["id", "role", "content", "tokens", "created_at"]
        read_only_fields = fields


class ChatSessionSerializer(serializers.ModelSerializer):
    message_count = serializers.SerializerMethodField()

    class Meta:
        model  = ChatSession
        fields = ["session_id", "title", "message_count", "created_at", "updated_at"]
        read_only_fields = fields

    def get_message_count(self, obj):
        return obj.messages.count()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["session_id"] = str(instance.id)
        return data


class ChatInputSerializer(serializers.Serializer):
    message    = serializers.CharField(max_length=2000)
    session_id = serializers.UUIDField(required=False)


class RoomRecommendationInputSerializer(serializers.Serializer):
    budget        = serializers.CharField(required=False, default="flexible")
    guests        = serializers.IntegerField(min_value=1, max_value=10, default=2)
    nights        = serializers.IntegerField(min_value=1, default=1)
    purpose       = serializers.ChoiceField(
        choices=["leisure","business","honeymoon","family","group","celebration"],
        default="leisure",
    )
    special_needs = serializers.CharField(required=False, default="none", allow_blank=True)
    amenities     = serializers.CharField(required=False, default="standard", allow_blank=True)