from django.urls import path
from . import views
urlpatterns = [
    path("categories/",         views.GalleryCategoryListView.as_view(),  name="gallery-categories"),
    path("images/",             views.GalleryImageListView.as_view(),     name="gallery-images"),
    path("images/upload/",      views.GalleryImageUploadView.as_view(),   name="gallery-upload"),
    path("images/<uuid:pk>/",   views.GalleryImageDetailView.as_view(),   name="gallery-image-detail"),
    path("featured/",           views.FeaturedImagesView.as_view(),       name="gallery-featured"),
]
