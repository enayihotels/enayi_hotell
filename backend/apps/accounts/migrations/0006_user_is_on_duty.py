from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_alter_user_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="is_on_duty",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "Only meaningful for Front Desk Staff, Bar Staff, Kitchen Staff, and Housekeeper "
                    "(single-day-shift roles). When a Manager/Admin switches this off — e.g. the "
                    "person called in sick or is traveling — that account is blocked from logging in "
                    "and immediately signed out of any session already open, until switched back on. "
                    "Every login by one of these roles also asks the person to confirm they're on "
                    "duty right now — a reminder, not a hard control; the real enforcement is this "
                    "field and who's allowed to flip it."
                ),
            ),
        ),
    ]
