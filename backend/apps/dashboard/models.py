"""Enayi Hotels — Dashboard Models

Stores nightly AI-generated fraud-risk audit reports (see tasks.py).
"""
import uuid
from django.db import models


class FraudAuditReport(models.Model):
    """One nightly (or manually triggered) fraud-risk sweep. `raw_signals`
    holds the actual structured numbers the audit found — the LLM summary
    is a human-readable gloss on top, not the source of truth, so nothing
    here depends on the AI call succeeding to still be useful.
    """
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report_date   = models.DateField(db_index=True)
    period_start  = models.DateTimeField()
    period_end    = models.DateTimeField()
    flagged_count = models.PositiveIntegerField(default=0)
    raw_signals   = models.JSONField(default=dict)
    summary_text  = models.TextField(blank=True)
    ai_generated  = models.BooleanField(default=False)  # False if the LLM call failed/was skipped — raw_signals still usable
    triggered_by  = models.CharField(max_length=20, default="scheduled", choices=[("scheduled", "Scheduled"), ("manual", "Manual")])
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "fraud_audit_reports"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Fraud audit {self.report_date} — {self.flagged_count} flagged"
