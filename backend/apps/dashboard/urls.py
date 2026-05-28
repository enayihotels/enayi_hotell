from django.urls import path
from . import views
urlpatterns = [
    path("stats/",    views.DashboardStatsView.as_view(),  name="dashboard-stats"),
    path("revenue/",  views.RevenueReportView.as_view(),   name="dashboard-revenue"),
    path("activity/", views.RecentActivityView.as_view(),  name="dashboard-activity"),
]
