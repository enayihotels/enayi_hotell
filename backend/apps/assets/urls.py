from django.urls import path
from . import views

urlpatterns = [
    path("",                       views.PropertyAssetListView.as_view(),   name="assets-list"),
    path("<uuid:pk>/",             views.PropertyAssetDetailView.as_view(), name="asset-detail"),
    path("<uuid:pk>/report-issue/", views.ReportAssetIssueView.as_view(),   name="asset-report-issue"),
    path("issues/<uuid:pk>/resolve/", views.ResolveAssetIssueView.as_view(), name="asset-issue-resolve"),
]
