from django.urls import path
from . import views
urlpatterns = [
    path("chat/",                      views.ARIAConciergeView.as_view(),     name="aria-chat"),
    path("history/",                   views.ChatHistoryView.as_view(),       name="aria-history"),
    path("history/<uuid:session_id>/", views.ChatHistoryView.as_view(),       name="aria-session"),
    path("recommend/",                 views.RoomRecommendationView.as_view(),name="aria-recommend"),
]
