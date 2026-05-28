# Generated migration — adds Monnify support to payments
# Run: python manage.py migrate payments

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0001_initial"),
    ]

    operations = [
        # ── Add monnify_transaction_ref field ──────────────────────────────
        migrations.AddField(
            model_name="payment",
            name="monnify_transaction_ref",
            field=models.CharField(blank=True, max_length=300),
        ),

        # ── Update method field choices to include Monnify ─────────────────
        migrations.AlterField(
            model_name="payment",
            name="method",
            field=models.CharField(
                choices=[
                    ("flutterwave",   "Flutterwave"),
                    ("paystack",      "Paystack"),
                    ("stripe",        "Stripe"),
                    ("monnify",       "Monnify"),
                    ("paypal",        "PayPal"),
                    ("ussd",          "USSD"),
                    ("bank_transfer", "Bank Transfer"),
                    ("cash",          "Cash"),
                    ("pos",           "POS"),
                ],
                max_length=30,
            ),
        ),
    ]