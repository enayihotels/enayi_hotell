"""Dashboard uses inline serialization in most views -- no dedicated
serializers needed there. FraudAuditReport gets a real serializer since
it's a model with a stable shape the frontend needs to consume."""
from rest_framework import serializers
from .models import FraudAuditReport


class FraudAuditReportSerializer(serializers.ModelSerializer):
    class Meta:
        model  = FraudAuditReport
        fields = [
            "id", "report_date", "period_start", "period_end",
            "flagged_count", "raw_signals", "summary_text",
            "ai_generated", "triggered_by", "created_at",
        ]
        read_only_fields = fields
