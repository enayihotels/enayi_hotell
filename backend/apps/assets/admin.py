from django.contrib import admin
from .models import PropertyAsset, AssetIssueReport


class AssetIssueReportInline(admin.TabularInline):
    model = AssetIssueReport
    extra = 0
    readonly_fields = ["reported_by", "reported_at", "fixed_by", "fixed_at"]


@admin.register(PropertyAsset)
class PropertyAssetAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "room", "location_note", "status", "updated_at"]
    list_filter = ["category", "status"]
    search_fields = ["name", "serial_number", "room__room_number", "location_note"]
    inlines = [AssetIssueReportInline]


@admin.register(AssetIssueReport)
class AssetIssueReportAdmin(admin.ModelAdmin):
    list_display = ["asset", "status", "reported_by", "reported_at", "fixed_by", "fixed_at"]
    list_filter = ["status"]
    search_fields = ["asset__name", "issue_description"]
