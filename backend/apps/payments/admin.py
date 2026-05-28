from django.contrib import admin
from .models import Payment, USSDSession, BankTransferSession

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["transaction_reference","guest","purpose","method","gateway","amount","currency","status","created_at"]
    list_filter  = ["status","method","gateway","purpose","currency"]
    search_fields= ["transaction_reference","guest__email","guest__first_name"]
    readonly_fields = ["transaction_reference","created_at","updated_at","gateway_response"]
    date_hierarchy = "created_at"

@admin.register(USSDSession)
class USSDSessionAdmin(admin.ModelAdmin):
    list_display = ["payment","bank_name","ussd_code","is_completed","expires_at"]

@admin.register(BankTransferSession)
class BankTransferAdmin(admin.ModelAdmin):
    list_display = ["payment","bank_name","account_number","amount","is_completed","expires_at"]