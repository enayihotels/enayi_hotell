from django.urls import path
from . import views
urlpatterns = [
    path("menu/categories/",   views.MenuCategoryListView.as_view(),   name="menu-categories"),
    path("menu/items/",        views.MenuItemListView.as_view(),        name="menu-items"),
    path("menu/items/<uuid:pk>/", views.MenuItemDetailView.as_view(),   name="menu-item-detail"),
    path("",                   views.OrderListCreateView.as_view(),     name="orders"),
    path("my/",                views.MyOrdersView.as_view(),            name="my-orders"),
    path("<uuid:pk>/",         views.OrderDetailView.as_view(),         name="order-detail"),
    path("<uuid:pk>/status/",  views.UpdateOrderStatusView.as_view(),   name="order-status"),
    path("kitchen/",           views.KitchenOrdersView.as_view(),       name="kitchen-orders"),
    path("bar/",               views.BarOrdersView.as_view(),           name="bar-orders"),
]
