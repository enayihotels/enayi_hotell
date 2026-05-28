from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, OTPVerification, LoyaltyTransaction, StaffProfile

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email","first_name","last_name","role","is_verified","loyalty_points","date_joined"]
    list_filter  = ["role","is_verified","is_active","nationality"]
    search_fields= ["email","first_name","last_name","phone"]
    ordering     = ["-date_joined"]
    fieldsets = (
        (None, {"fields": ("email","password")}),
        ("Personal", {"fields": ("first_name","last_name","phone","date_of_birth","nationality","address","city","state","country")}),
        ("ID Verification", {"fields": ("id_type","id_number")}),
        ("Status", {"fields": ("role","is_verified","is_active","is_staff","is_superuser","loyalty_points","newsletter")}),
        ("Dates", {"fields": ("date_joined","last_login","last_login_ip")}),
    )
    add_fieldsets = ((None, {"classes":("wide",),"fields":("email","first_name","last_name","password1","password2","role")}),)
    readonly_fields = ["date_joined","last_login","last_login_ip"]

@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ["user","department","employee_id","shift","is_on_duty"]
    list_filter  = ["department","shift","is_on_duty"]

@admin.register(OTPVerification)
class OTPAdmin(admin.ModelAdmin):
    list_display = ["user","purpose","is_used","expires_at","created_at"]
    list_filter  = ["purpose","is_used"]

@admin.register(LoyaltyTransaction)
class LoyaltyAdmin(admin.ModelAdmin):
    list_display = ["user","points","reason","balance_after","created_at"]
    readonly_fields = ["created_at"]