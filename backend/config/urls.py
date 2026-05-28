"""Enayi Hotels & Suites — Master URL Configuration"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

schema_view = get_schema_view(
    openapi.Info(
        title="🏨 Enayi Hotels & Suites API",
        default_version="v1",
        description="""
## Enayi Hotels & Suites — Complete Hotel Management API

**📍 Location:** Rayfield Road, Jos, Plateau State, Nigeria

### Available Endpoints:
- 🔐 **Authentication** — Register, Login, JWT, OTP, Password Reset
- 🛏️ **Rooms** — Categories, Availability, Reviews, Images
- 📅 **Bookings** — Create, Check-in, Check-out, Cancel
- 🍽️ **Orders** — Kitchen Menu, Bar Menu, Room Service, Tracking
- 🎪 **Events** — Hall Booking, Packages, Availability
- 💳 **Payments** — Flutterwave, Paystack, Stripe, PayPal, USSD, Transfer
- 🖼️ **Gallery** — Upload, Browse, Featured Images
- 🤖 **AI Concierge** — ARIA Chat, Room Recommendations
- 📊 **Dashboard** — Stats, Reports, Analytics
        """,
        contact=openapi.Contact(email="tech@enayihotels.com"),
        license=openapi.License(name="Proprietary"),
        x_logo={"url": "/static/logo.png"},
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    # ── Admin ──────────────────────────────────────────────
    path("admin/",      admin.site.urls),

    # ── API Docs ───────────────────────────────────────────
    path("api/docs/",   schema_view.with_ui("swagger", cache_timeout=0), name="swagger-ui"),
    path("api/redoc/",  schema_view.with_ui("redoc",   cache_timeout=0), name="redoc"),
    path("api/schema/", schema_view.without_ui(cache_timeout=0),         name="openapi-schema"),

    # ── API v1 ─────────────────────────────────────────────
    path("api/v1/auth/",      include("apps.accounts.urls")),
    path("api/v1/rooms/",     include("apps.rooms.urls")),
    path("api/v1/hotels/",    include("apps.hotels.urls")),
    path("api/v1/bookings/",  include("apps.bookings.urls")),
    path("api/v1/orders/",    include("apps.orders.urls")),
    path("api/v1/events/",    include("apps.events.urls")),
    path("api/v1/payments/",  include("apps.payments.urls")),
    path("api/v1/gallery/",   include("apps.gallery.urls")),
    path("api/v1/ai/",        include("apps.ai_assistant.urls")),
    path("api/v1/dashboard/", include("apps.dashboard.urls")),
]

# ── Static & Media ─────────────────────────────────────
# Static files are served by WhiteNoise (configured in settings/middleware).
# Media (user-uploaded room/gallery images) must be served explicitly. In DEBUG
# Django's static() helper handles it; in production we route /media/ through
# Django's serve view so seed images load on Render without an S3 bucket.
# (Fine for a low-traffic test; move to S3/Cloudinary for real production scale.)
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL,  document_root=settings.MEDIA_ROOT)
else:
    from django.views.static import serve as _serve
    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", _serve, {"document_root": settings.MEDIA_ROOT}),
    ]

# Admin Branding
admin.site.site_header  = "🏨 Enayi Hotels & Suites"
admin.site.site_title   = "Enayi Hotels Admin"
admin.site.index_title  = "Hotel Management Portal — Jos, Plateau State"
