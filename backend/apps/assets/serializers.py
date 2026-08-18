from rest_framework import serializers
from .models import PropertyAsset, AssetIssueReport


class AssetIssueReportSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.SerializerMethodField()
    cleared_by_name = serializers.SerializerMethodField()
    fixed_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = AssetIssueReport
        fields = [
            "id", "asset", "issue_description", "status", "status_display",
            "reported_by", "reported_by_name", "reported_at",
            "cleared_by", "cleared_by_name", "cleared_at", "clearance_note",
            "fixed_by", "fixed_by_name", "fixed_at", "fix_notes",
        ]
        read_only_fields = ["status", "reported_by", "cleared_by", "cleared_at", "fixed_by", "fixed_at"]

    def get_reported_by_name(self, obj):
        return obj.reported_by.get_full_name() if obj.reported_by_id else None

    def get_cleared_by_name(self, obj):
        return obj.cleared_by.get_full_name() if obj.cleared_by_id else None

    def get_fixed_by_name(self, obj):
        return obj.fixed_by.get_full_name() if obj.fixed_by_id else None


class PropertyAssetSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source="room.room_number", read_only=True)
    hotel_name = serializers.CharField(source="hotel.name", read_only=True)
    department_display = serializers.CharField(source="get_department_display", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    where = serializers.SerializerMethodField()
    open_issue = serializers.SerializerMethodField()
    issue_reports = AssetIssueReportSerializer(many=True, read_only=True)

    class Meta:
        model = PropertyAsset
        fields = [
            "id", "hotel", "hotel_name", "name", "category", "category_display",
            "department", "department_display", "quantity",
            "room", "room_number", "location_note", "where",
            "status", "serial_number", "notes", "open_issue", "issue_reports",
            "created_at", "updated_at",
        ]

    def get_where(self, obj):
        return f"Room {obj.room.room_number}" if obj.room_id else (obj.location_note or "Common area")

    def get_open_issue(self, obj):
        issue = obj.issue_reports.exclude(status__in=["fixed", "rejected"]).order_by("-reported_at").first()
        return AssetIssueReportSerializer(issue).data if issue else None


class PropertyAssetWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PropertyAsset
        fields = ["id", "name", "category", "department", "quantity", "room", "location_note", "serial_number", "notes"]
        # hotel is deliberately NOT a field here — same pattern as
        # InventoryItemWriteSerializer. The view sets it explicitly via
        # serializer.save(hotel_id=...) using the requester's own
        # branch (or Admin's explicit choice), never trusted from the
        # client body directly.

    def validate(self, data):
        if not data.get("room") and not data.get("location_note", "").strip():
            raise serializers.ValidationError("Either pick a room or enter a location note for a common-area asset.")
        return data
