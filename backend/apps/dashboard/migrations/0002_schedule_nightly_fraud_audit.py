"""Auto-registers the nightly fraud audit as a Celery Beat periodic task,
so it starts running automatically after `migrate` — no manual click
through Django admin needed. Runs at 2:00 AM Africa/Lagos time daily.

Safe to re-run: get_or_create on both the schedule and the task means
this won't create duplicates if the migration re-applies (e.g. on a
fresh DB rebuild).
"""
from django.db import migrations


def create_nightly_schedule(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask    = apps.get_model("django_celery_beat", "PeriodicTask")

    schedule, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="2", day_of_week="*", day_of_month="*", month_of_year="*",
        timezone="Africa/Lagos",
    )
    PeriodicTask.objects.get_or_create(
        name="Nightly fraud-risk audit",
        defaults={
            "crontab": schedule,
            "task": "apps.dashboard.tasks.run_nightly_fraud_audit",
            "enabled": True,
        },
    )


def remove_nightly_schedule(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="Nightly fraud-risk audit").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("dashboard", "0001_initial"),
        ("django_celery_beat", "0018_improve_crontab_helptext"),
    ]

    operations = [
        migrations.RunPython(create_nightly_schedule, remove_nightly_schedule),
    ]
