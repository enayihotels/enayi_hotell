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


def _can_manage(user):
    """Front Desk Staff, Manager, or Owner — the same tier that already
    manages Rooms and Bookings. Room/property fixtures are their domain
    the same way check-in/out already is."""
    return user.is_hotel_staff or user.role in ["manager", "admin"]


class PropertyAssetListView(generics.ListCreateAPIView):
    serializer_class = PropertyAssetSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        if not _can_manage(self.request.user):
            return PropertyAsset.objects.none()
        qs = PropertyAsset.objects.select_related("room").prefetch_related("issue_reports")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        room_id = self.request.query_params.get("room")
        if room_id:
            qs = qs.filter(room_id=room_id)
        return qs

    def create(self, request, *args, **kwargs):
        if not _can_manage(request.user):
            return Response({"error": "Only Front Desk Staff, Manager, or Owner can add assets."}, status=403)
        serializer = PropertyAssetWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        asset = serializer.save()
        return Response(PropertyAssetSerializer(asset).data, status=201)


class PropertyAssetDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = PropertyAsset.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return PropertyAssetWriteSerializer if self.request.method in ["PUT", "PATCH"] else PropertyAssetSerializer

    def update(self, request, *args, **kwargs):
        if not _can_manage(request.user):
            return Response({"error": "Only Front Desk Staff, Manager, or Owner can edit assets."}, status=403)
        response = super().update(request, *args, **kwargs)
        return Response(PropertyAssetSerializer(self.get_object()).data, status=response.status_code)

    def destroy(self, request, *args, **kwargs):
        if not _can_manage(request.user):
            return Response({"error": "Only Front Desk Staff, Manager, or Owner can delete assets."}, status=403)
        return super().destroy(request, *args, **kwargs)


class ReportAssetIssueView(APIView):
    """POST /api/v1/assets/<id>/report-issue/
    Marks the asset Broken and opens a new issue report. If there's
    already an open (unfixed) issue on this asset, this just adds
    another report rather than silently ignoring it — worth knowing if
    the same thing keeps getting reported broken."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not _can_manage(request.user):
            return Response({"error": "Only Front Desk Staff, Manager, or Owner can report an issue."}, status=403)
        try:
            asset = PropertyAsset.objects.get(id=pk)
        except PropertyAsset.DoesNotExist:
            return Response({"error": "Asset not found."}, status=404)

        description = request.data.get("issue_description", "").strip()
        if not description:
            return Response({"error": "issue_description is required."}, status=400)

        issue = AssetIssueReport.objects.create(
            asset=asset, issue_description=description,
            reported_by=request.user, status=AssetIssueReport.REPORTED,
        )
        asset.status = "broken"
        asset.save(update_fields=["status", "updated_at"])

        return Response(PropertyAssetSerializer(asset).data, status=201)


class ResolveAssetIssueView(APIView):
    """POST /api/v1/assets/issues/<id>/resolve/
    Marks the specific issue report Fixed, and — only if this was the
    asset's last remaining open issue — sets the asset itself back to
    Working. An asset with two open issues doesn't get marked Working
    just because one of them was closed."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not _can_manage(request.user):
            return Response({"error": "Only Front Desk Staff, Manager, or Owner can resolve an issue."}, status=403)
        try:
            issue = AssetIssueReport.objects.select_related("asset").get(id=pk)
        except AssetIssueReport.DoesNotExist:
            return Response({"error": "Issue report not found."}, status=404)

        if issue.status == AssetIssueReport.FIXED:
            return Response({"error": "This issue was already marked fixed."}, status=400)

        issue.status = AssetIssueReport.FIXED
        issue.fixed_by = request.user
        issue.fixed_at = timezone.now()
        issue.fix_notes = request.data.get("fix_notes", "")
        issue.save()

        asset = issue.asset
        if not asset.issue_reports.exclude(status=AssetIssueReport.FIXED).exists():
            asset.status = "working"
            asset.save(update_fields=["status", "updated_at"])

        return Response(PropertyAssetSerializer(asset).data)
