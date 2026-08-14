from django.urls import path
from . import views

urlpatterns = [
    path("categories/",                  views.InventoryCategoryListView.as_view(),   name="inventory-categories"),
    path("categories/<slug:slug>/",      views.InventoryCategoryDetailView.as_view(), name="inventory-category-detail"),
    path("items/",                       views.InventoryItemListView.as_view(),       name="inventory-items"),
    path("items/<uuid:pk>/",             views.InventoryItemDetailView.as_view(),     name="inventory-item-detail"),
    path("balances/",                    views.StockBalanceListView.as_view(),        name="inventory-balances"),
    path("balances/adjust/",             views.AdjustStockView.as_view(),             name="inventory-adjust"),
]
