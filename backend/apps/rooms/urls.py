from django.urls import path
from . import views
urlpatterns = [
    path("amenities/", views.AmenityListCreateView.as_view(), name="amenities"),    path("categories/",                       views.RoomCategoryListView.as_view(),   name="room-categories"),
    path("categories/<slug:slug>/",           views.RoomCategoryDetailView.as_view(), name="room-category-detail"),
    path("categories/<uuid:cat_id>/images/",  views.RoomImageUploadView.as_view(),    name="room-images-upload"),
    path("categories/<slug:slug>/reviews/", views.RoomReviewListCreateView.as_view(), name="room-reviews"),    path("list/",                             views.RoomListView.as_view(),           name="room-list"),
    path("availability/",                     views.RoomAvailabilityView.as_view(),   name="room-availability"),
    path("branch-availability/",              views.BranchRoomsView.as_view(),        name="branch-availability"),
]
