"""Runs the nightly fraud audit synchronously, no Celery required.

This is the actual mechanism that runs in production: your Render setup
deliberately doesn't run a Celery worker/beat process (see render.yaml),
so the @shared_task version only fires if you later add a worker. This
management command works right now with just the existing web service,
triggered by a Render Cron Job (see render.yaml addition in the README).

Usage:
    python manage.py run_fraud_audit
    python manage.py run_fraud_audit --hours 48
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Runs a fraud-risk audit sweep over the last N hours (default 24) and emails managers/admins."

    def add_arguments(self, parser):
        parser.add_argument("--hours", type=int, default=24, help="How many hours back to audit.")

    def handle(self, *args, **options):
        from apps.dashboard.tasks import run_fraud_audit

        report = run_fraud_audit(hours=options["hours"], triggered_by="scheduled")
        self.stdout.write(self.style.SUCCESS(
            f"Fraud audit complete: {report.flagged_count} item(s) flagged. Report id: {report.id}"
        ))
