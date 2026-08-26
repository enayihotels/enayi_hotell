"""Enayi Hotels — Property & Asset Maintenance Views"""
from django.utils import timezone
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import PropertyAsset, AssetIssueReport
from .serializers import (
    PropertyAssetSerializer, PropertyAssetWriteSerializer, AssetIssueReportSerializer,
)

# Which department(s) a role's dedicated Assets view is scoped to.
# Bar/Kitchen see ONLY their own department. Housekeeper sees ONLY
# room-tied (Housekeeping) assets. Front Desk sees its own tag PLUS
# room-tied assets (Adrian confirmed Front Desk should see room items,
# same as Housekeeper) PLUS Shared/common-area assets, since Front
# Desk physically works those spaces (Adrian confirmed this too).
# Manager/Admin are NOT in this dict on purpose — they get the full,
# unrestricted "central place" view across every department, which is
# what makes it central.
ROLE_DEPARTMENTS = {
    "staff":         [PropertyAsset.FRONTDESK, PropertyAsset.HOUSEKEEPING, PropertyAsset.SHARED],
    "bar_staff":     [PropertyAsset.BAR],
    "kitchen_staff": [PropertyAsset.KITCHEN],
    "housekeeper":   [PropertyAsset.HOUSEKEEPING],
    "laundry_staff": [PropertyAsset.LAUNDRY],
}


def _can_view_assets(user):
    """Manager, Owner (unrestricted central view) — plus Front
    Desk/Bar/Kitchen/Housekeeping, each scoped to their own
    department(s) via ROLE_DEPARTMENTS below. Front Desk used to be
    lumped in with Manager/Owner as "unrestricted" via is_hotel_staff
    — that was the bug that let Front Desk see Bar/Kitchen assets. It
    is now scoped the same way as the other department roles."""
    return user.role in ["manager", "admin"] or user.role in ROLE_DEPARTMENTS


def _can_report_issue(user):
    """Same broad set as viewing — anyone who can see an asset can
    report it damaged. Reporting is deliberately NOT restricted to
    "your own department's assets only" — a Kitchen Staff member who
    notices a broken corridor light on the way to a room service
    delivery should still be able to flag it, even though corridor
    lighting isn't tagged to her department."""
    return _can_view_assets(user)


def _can_clear_or_reject(user):
    """The approval gate Adrian asked for — Manager or Owner only.
    Front Desk deliberately does NOT get this, even though Front Desk
    can view/report/manage assets generally — clearing a repair is a
    supervisory decision, not a day-to-day front-desk task."""
    return user.role in ["manager", "admin"]


def _can_mark_fixed(user):
    """Manager/Owner, OR the specific department role that owns the
    asset being closed out — a Kitchen Staff member should be able to
    confirm "yes, the fridge repair guy came and fixed it" without
    needing a Manager to do it for her. Front Desk is included via
    ROLE_DEPARTMENTS now, same as Bar/Kitchen/Housekeeping. Checked
    per-asset in the view itself, not here, since it depends on which
    asset's issue is being closed."""
    return user.role in ["manager", "admin"] or user.role in ROLE_DEPARTMENTS


def _effective_hotel(user, requested_hotel_id=None):
    """Same rule as everywhere else branch-scoped in this codebase:
    Owner sees every branch (optionally narrowed via ?hotel=), Front
    Desk/Manager/Bar/Kitchen/Housekeeping are locked to their own
    account's branch regardless of what's requested."""
    if user.role == "admin":
        return requested_hotel_id or None
    if user.requires_branch:
        return str(user.hotel_id) if user.hotel_id else False
    return None


class PropertyAssetListView(generics.ListCreateAPIView):
    serializer_class = PropertyAssetSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if not _can_view_assets(user):
            return PropertyAsset.objects.none()

        effective = _effective_hotel(user, self.request.query_params.get("hotel"))
        if effective is False:
            return PropertyAsset.objects.none()

        qs = PropertyAsset.objects.select_related("room", "hotel").prefetch_related("issue_reports")
        if effective:
            qs = qs.filter(hotel_id=effective)

        # Front Desk/Bar/Kitchen/Housekeeping only ever see their own
        # department's assets (Front Desk's set includes Shared and
        # room-tied Housekeeping assets too, see ROLE_DEPARTMENTS) —
        # Manager/Admin see everything (the central, unrestricted view
        # this whole system is meant to also provide).
        depts = ROLE_DEPARTMENTS.get(user.role)
        if depts:
            qs = qs.filter(department__in=depts)

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        room_id = self.request.query_params.get("room")
        if room_id:
            qs = qs.filter(room_id=room_id)
        department_filter = self.request.query_params.get("department")
        if department_filter:
            qs = qs.filter(department=department_filter)
        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        if not user.role in ["manager", "admin"]:
            return Response({"error": "Only a Manager or the Owner can add assets."}, status=403)

        if user.role == "admin":
            hotel_id = request.data.get("hotel")
            if not hotel_id:
                return Response({"error": "hotel is required."}, status=400)
        else:
            if not user.hotel_id:
                return Response({"error": "Your account has no branch assigned yet — ask the Owner to set one before you can add assets."}, status=403)
            hotel_id = user.hotel_id

        serializer = PropertyAssetWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        asset = serializer.save(hotel_id=hotel_id)
        return Response(PropertyAssetSerializer(asset).data, status=201)


class PropertyAssetDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not _can_view_assets(user):
            return PropertyAsset.objects.none()
        effective = _effective_hotel(user, self.request.query_params.get("hotel"))
        if effective is False:
            return PropertyAsset.objects.none()
        qs = PropertyAsset.objects.select_related("room", "hotel")
        if effective:
            qs = qs.filter(hotel_id=effective)
        depts = ROLE_DEPARTMENTS.get(user.role)
        if depts:
            qs = qs.filter(department__in=depts)
        return qs

    def get_serializer_class(self):
        return PropertyAssetWriteSerializer if self.request.method in ["PUT", "PATCH"] else PropertyAssetSerializer

    def update(self, request, *args, **kwargs):
        if not request.user.role in ["manager", "admin"]:
            return Response({"error": "Only a Manager or the Owner can edit assets."}, status=403)
        response = super().update(request, *args, **kwargs)
        return Response(PropertyAssetSerializer(self.get_object()).data, status=response.status_code)

    def destroy(self, request, *args, **kwargs):
        if not request.user.role in ["manager", "admin"]:
            return Response({"error": "Only a Manager or the Owner can delete assets."}, status=403)
        return super().destroy(request, *args, **kwargs)


class ReportAssetIssueView(APIView):
    """POST /api/v1/assets/<id>/report-issue/
    Marks the asset Broken and opens a new issue report, sitting at
    "Reported" until a Manager/Owner reviews it. If there's already an
    open (unfixed/uncleared) issue on this asset, this just adds
    another report rather than silently ignoring it — worth knowing if
    the same thing keeps getting reported broken."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if not _can_report_issue(user):
            return Response({"error": "You don't have permission to report an issue."}, status=403)
        try:
            asset = PropertyAsset.objects.get(id=pk)
        except PropertyAsset.DoesNotExist:
            return Response({"error": "Asset not found."}, status=404)

        if user.role != "admin" and user.hotel_id and str(asset.hotel_id) != str(user.hotel_id):
            return Response({"error": "That asset isn't at your branch."}, status=403)

        description = request.data.get("issue_description", "").strip()
        if not description:
            return Response({"error": "issue_description is required."}, status=400)

        issue = AssetIssueReport.objects.create(
            asset=asset, issue_description=description,
            reported_by=user, status=AssetIssueReport.REPORTED,
        )
        asset.status = "broken"
        asset.save(update_fields=["status", "updated_at"])

        return Response(PropertyAssetSerializer(asset).data, status=201)


class ClearAssetIssueView(APIView):
    """POST /api/v1/assets/issues/<id>/clear/
    The approval gate — Manager/Owner only. Moves a Reported issue to
    Cleared for Repair, with a note on why. This does NOT mark the
    asset fixed — repair still has to actually happen and get
    confirmed separately via ResolveAssetIssueView."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not _can_clear_or_reject(request.user):
            return Response({"error": "Only a Manager or the Owner can clear an issue for repair."}, status=403)
        try:
            issue = AssetIssueReport.objects.select_related("asset").get(id=pk)
        except AssetIssueReport.DoesNotExist:
            return Response({"error": "Issue report not found."}, status=404)
        if issue.status != AssetIssueReport.REPORTED:
            return Response({"error": f"This issue is already '{issue.get_status_display()}' — nothing to clear."}, status=400)

        issue.status = AssetIssueReport.CLEARED_FOR_REPAIR
        issue.cleared_by = request.user
        issue.cleared_at = timezone.now()
        issue.clearance_note = request.data.get("clearance_note", "")
        issue.save()

        return Response(AssetIssueReportSerializer(issue).data)


class RejectAssetIssueView(APIView):
    """POST /api/v1/assets/issues/<id>/reject/
    The other side of the approval gate — Manager/Owner declines the
    report (e.g. a false alarm, or a decision to decommission instead
    of repair). Puts the asset back to Working, since it's no longer
    flagged as broken and awaiting anything."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not _can_clear_or_reject(request.user):
            return Response({"error": "Only a Manager or the Owner can reject an issue."}, status=403)
        try:
            issue = AssetIssueReport.objects.select_related("asset").get(id=pk)
        except AssetIssueReport.DoesNotExist:
            return Response({"error": "Issue report not found."}, status=404)
        if issue.status != AssetIssueReport.REPORTED:
            return Response({"error": f"This issue is already '{issue.get_status_display()}' — nothing to reject."}, status=400)

        issue.status = AssetIssueReport.REJECTED
        issue.cleared_by = request.user
        issue.cleared_at = timezone.now()
        issue.clearance_note = request.data.get("clearance_note", "")
        issue.save()

        asset = issue.asset
        if not asset.issue_reports.filter(status__in=[AssetIssueReport.REPORTED, AssetIssueReport.CLEARED_FOR_REPAIR]).exists():
            asset.status = "working"
            asset.save(update_fields=["status", "updated_at"])

        return Response(AssetIssueReportSerializer(issue).data)


class ResolveAssetIssueView(APIView):
    """POST /api/v1/assets/issues/<id>/resolve/
    Marks the specific issue report Fixed — but ONLY once it's already
    been Cleared for Repair; a report can't jump straight from
    Reported to Fixed, skipping the approval step entirely. Sets the
    asset itself back to Working only if this was its last remaining
    open (reported/cleared) issue."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if not _can_mark_fixed(user):
            return Response({"error": "You don't have permission to resolve this issue."}, status=403)
        try:
            issue = AssetIssueReport.objects.select_related("asset").get(id=pk)
        except AssetIssueReport.DoesNotExist:
            return Response({"error": "Issue report not found."}, status=404)

        if issue.status == AssetIssueReport.FIXED:
            return Response({"error": "This issue was already marked fixed."}, status=400)
        if issue.status != AssetIssueReport.CLEARED_FOR_REPAIR:
            return Response({"error": "This issue needs to be cleared for repair by a Manager or the Owner before it can be marked fixed."}, status=400)

        asset = issue.asset
        depts = ROLE_DEPARTMENTS.get(user.role)
        if depts and asset.department not in depts and not user.role in ["manager", "admin"]:
            return Response({"error": "That asset isn't in your department."}, status=403)

        issue.status = AssetIssueReport.FIXED
        issue.fixed_by = user
        issue.fixed_at = timezone.now()
        issue.fix_notes = request.data.get("fix_notes", "")
        issue.save()

        if not asset.issue_reports.exclude(status__in=[AssetIssueReport.FIXED, AssetIssueReport.REJECTED]).exists():
            asset.status = "working"
            asset.save(update_fields=["status", "updated_at"])

        return Response(PropertyAssetSerializer(asset).data)
