from django.contrib import admin
from .models import FraudAuditReport


@admin.register(FraudAuditReport)
class FraudAuditReportAdmin(admin.ModelAdmin):
    list_display = ["report_date", "flagged_count", "triggered_by", "ai_generated", "created_at"]
    list_filter  = ["triggered_by", "ai_generated"]
    readonly_fields = ["id", "report_date", "period_start", "period_end", "flagged_count", "raw_signals", "summary_text", "ai_generated", "triggered_by", "created_at"]
    ordering = ["-created_at"]
