from django.urls import path
from . import views

urlpatterns = [
    path("prices/",                       views.LaundryPriceItemListView.as_view(),   name="laundry-prices"),
    path("prices/<uuid:pk>/",             views.LaundryPriceItemDetailView.as_view(), name="laundry-price-detail"),
    path("tickets/",                      views.LaundryTicketListCreateView.as_view(), name="laundry-tickets"),
    path("my-tickets/",                   views.MyLaundryTicketsView.as_view(),        name="laundry-my-tickets"),
    path("reconciliation/",               views.LaundryReconciliationView.as_view(),   name="laundry-reconciliation"),
    path("tickets/<uuid:pk>/mark-ready/", views.MarkLaundryReadyView.as_view(),        name="laundry-mark-ready"),
]
