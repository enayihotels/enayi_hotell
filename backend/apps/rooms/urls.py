from django.urls import path
from . import views
urlpatterns = [
    path("amenities/", views.AmenityListCreateView.as_view(), name="amenities"),    path("categories/",                       views.RoomCategoryListView.as_view(),   name="room-categories"),
    path("categories/<slug:slug>/",           views.RoomCategoryDetailView.as_view(), name="room-category-detail"),
    path("categories/<uuid:cat_id>/images/",  views.RoomImageUploadView.as_view(),    name="room-images-upload"),
    path("images/<uuid:pk>/",  views.RoomImageDeleteView.as_view(),    name="room-image-delete"),
    path("categories/<slug:slug>/reviews/", views.RoomReviewListCreateView.as_view(), name="room-reviews"),    path("list/",                             views.RoomListView.as_view(),           name="room-list"),
    path("list/<uuid:pk>/",                   views.RoomDetailView.as_view(),         name="room-detail"),
    path("list/<uuid:room_id>/photos/",       views.RoomPhotoListUploadView.as_view(), name="room-photos"),
    path("photos/<uuid:pk>/",                 views.RoomPhotoDeleteView.as_view(),    name="room-photo-delete"),
    path("availability/",                     views.RoomAvailabilityView.as_view(),   name="room-availability"),
    path("branch-availability/",              views.BranchRoomsView.as_view(),        name="branch-availability"),
]
