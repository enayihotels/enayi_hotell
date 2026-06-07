"""
╔══════════════════════════════════════════════════════╗
║  Enayi Hotels & Suites — Django Settings             ║
║  Location: Rayfield Road, Jos, Plateau State Nigeria ║
╚══════════════════════════════════════════════════════╝
"""

import os
import socket
from pathlib import Path
from datetime import timedelta
import environ
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(DEBUG=(bool, False))
env_file = BASE_DIR / ".env"
if env_file.exists():
    environ.Env.read_env(env_file)

# ─── Core ─────────────────────────────────────────────────
SECRET_KEY    = env("SECRET_KEY", default="django-insecure-dev-key-change-in-production")
DEBUG         = env.bool("DEBUG", default=True)

# On Render the host is "<service>.onrender.com". We accept any *.onrender.com by
# default so the app boots even before you set ALLOWED_HOSTS, plus localhost for dev.
ALLOWED_HOSTS = env.list(
    "ALLOWED_HOSTS",
    default=["localhost", "127.0.0.1", ".onrender.com"],
)

# Trusted origins for any session/CSRF POST (Django admin, etc.).
# Add your own frontend/backend Render URLs via the CSRF_TRUSTED_ORIGINS env var.
CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS",
    default=[
        "https://*.onrender.com",
        "https://*.ngrok-free.app",
        "https://*.ngrok.app",
    ],
)

# Render terminates TLS at its edge and forwards the original scheme in this header.
# Without this, request.is_secure() is False and build_absolute_uri() would emit
# http:// media URLs (causing mixed-content image failures on the HTTPS frontend).
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# ─── Apps ─────────────────────────────────────────────────
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_yasg",
    "storages",
    "imagekit",
    "phonenumber_field",
    "channels",
    "django_celery_beat",
    "django_extensions",
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.rooms",
    "apps.hotels", 
    "apps.bookings",
    "apps.orders",
    "apps.events",
    "apps.payments",
    "apps.gallery",
    "apps.ai_assistant",
    "apps.dashboard",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ─── Middleware ───────────────────────────────────────────
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF      = "config.urls"
WSGI_APPLICATION  = "config.wsgi.application"
ASGI_APPLICATION  = "config.asgi.application"
AUTH_USER_MODEL   = "accounts.User"

# ─── Templates ────────────────────────────────────────────
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [BASE_DIR / "templates"],
    "APP_DIRS": True,
    "OPTIONS": {
        "context_processors": [
            "django.template.context_processors.debug",
            "django.template.context_processors.request",
            "django.contrib.auth.context_processors.auth",
            "django.contrib.messages.context_processors.messages",
        ],
    },
}]

# ─── Database ─────────────────────────────────────────────
# Priority:
#   1. DATABASE_URL  (Render, Heroku, any managed Postgres — recommended in prod)
#   2. Docker compose (host = "db")
#   3. Local Windows / Mac dev (host = "localhost")
def _is_docker():
    """Detect whether we're running inside the docker-compose network."""
    try:
        socket.getaddrinfo("db", 5432, proto=socket.IPPROTO_TCP)
        return True
    except socket.gaierror:
        return False

DATABASE_URL = env("DATABASE_URL", default=None)

if DATABASE_URL:
    # Outside Docker, a compose-style "@db:" host won't resolve — rewrite to localhost.
    if not _is_docker():
        DATABASE_URL = DATABASE_URL.replace("@db:", "@localhost:")
    # On Render the managed Postgres requires SSL; ssl_require is harmless locally.
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            ssl_require=env.bool("DB_SSL_REQUIRE", default=not DEBUG),
        )
    }
else:
    _db_host = "db" if _is_docker() else "localhost"
    DATABASES = {
        "default": {
            "ENGINE":   "django.db.backends.postgresql",
            "NAME":     env("POSTGRES_DB",       default="enayi_hotels"),
            "USER":     env("POSTGRES_USER",     default="enayi_user"),
            "PASSWORD": env("POSTGRES_PASSWORD", default="enayi_pass_2024"),
            "HOST":     env("POSTGRES_HOST",     default=_db_host),
            "PORT":     env("POSTGRES_PORT",     default="5432"),
        }
    }

# ─── Auth ─────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ─── Internationalisation ─────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE     = "Africa/Lagos"
USE_I18N      = True
USE_TZ        = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
PHONENUMBER_DEFAULT_REGION = "NG"

# ─── Static & Media ───────────────────────────────────────
STATIC_URL  = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# CompressedStaticFilesStorage (no manifest) is more forgiving than the manifest
# variant: a single missing/renamed asset reference won't crash collectstatic or
# 500 the page. Ideal for a fast, error-free test deployment.
STATICFILES_STORAGE = "whitenoise.storage.CompressedStaticFilesStorage"
MEDIA_URL   = "/media/"
MEDIA_ROOT  = BASE_DIR / "media"
FILE_UPLOAD_MAX_MEMORY_SIZE   = 15 * 1024 * 1024   # 15MB
DATA_UPLOAD_MAX_MEMORY_SIZE    = 50 * 1024 * 1024   # 50MB

# build-trigger: force-redeploy-fix-categories
# ─── CORS ─────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:3000", "http://localhost:5173",
    ],
)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = True

# ─── REST Framework ───────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "300/hour",
        "user": "5000/hour",
    },
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}

# ─── JWT ──────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":  timedelta(hours=24),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS":  True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ─── Redis & Celery (OPTIONAL) ────────────────────────────
# This codebase does not currently dispatch Celery tasks, use the cache, or run
# WebSocket consumers — so Redis is NOT required to run the site. If you set a
# REDIS_URL env var later, the app will automatically use Redis; otherwise it
# falls back to Django's in-process local-memory cache (zero extra services/cost).
REDIS_URL = env("REDIS_URL", default="")

if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
            "KEY_PREFIX": "enayi",
            "TIMEOUT": 300,
        }
    }
    _celery_broker = REDIS_URL
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [REDIS_URL]},
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "enayi-locmem",
            "TIMEOUT": 300,
        }
    }
    # In-memory channel layer (fine for a single-process test deploy with no sockets).
    _celery_broker = "memory://"
    CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
    }

CELERY_BROKER_URL           = env("CELERY_BROKER_URL", default=_celery_broker)
CELERY_RESULT_BACKEND       = env("CELERY_RESULT_BACKEND", default=_celery_broker)
CELERY_ACCEPT_CONTENT       = ["json"]
CELERY_TASK_SERIALIZER      = "json"
CELERY_RESULT_SERIALIZER    = "json"
CELERY_TIMEZONE             = "Africa/Lagos"
CELERY_BEAT_SCHEDULER       = "django_celery_beat.schedulers:DatabaseScheduler"

# ─── Email ────────────────────────────────────────────────
EMAIL_BACKEND       = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST          = env("EMAIL_HOST",          default="smtp.gmail.com")
EMAIL_PORT          = env.int("EMAIL_PORT",      default=587)
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = env("EMAIL_HOST_USER",     default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL  = env("DEFAULT_FROM_EMAIL",  default="Enayi Hotels <noreply@enayihotels.com>")

# ─── Payment Gateways ────────────────────────────────────
FLUTTERWAVE_PUBLIC_KEY    = env("FLUTTERWAVE_PUBLIC_KEY",    default="")
FLUTTERWAVE_SECRET_KEY    = env("FLUTTERWAVE_SECRET_KEY",    default="")
FLUTTERWAVE_ENCRYPTION_KEY= env("FLUTTERWAVE_ENCRYPTION_KEY",default="")
FLUTTERWAVE_WEBHOOK_HASH  = env("FLUTTERWAVE_WEBHOOK_HASH",  default="")

PAYSTACK_PUBLIC_KEY      = env("PAYSTACK_PUBLIC_KEY",      default="")
PAYSTACK_SECRET_KEY      = env("PAYSTACK_SECRET_KEY",      default="")
PAYSTACK_WEBHOOK_SECRET  = env("PAYSTACK_WEBHOOK_SECRET",  default="")

STRIPE_PUBLIC_KEY        = env("STRIPE_PUBLIC_KEY",        default="")
STRIPE_SECRET_KEY        = env("STRIPE_SECRET_KEY",        default="")
STRIPE_WEBHOOK_SECRET    = env("STRIPE_WEBHOOK_SECRET",    default="")
STRIPE_CURRENCY          = env("STRIPE_CURRENCY",          default="ngn")

PAYPAL_CLIENT_ID         = env("PAYPAL_CLIENT_ID",         default="")
PAYPAL_CLIENT_SECRET     = env("PAYPAL_CLIENT_SECRET",     default="")
PAYPAL_MODE              = env("PAYPAL_MODE",              default="sandbox")
PAYPAL_API_URL           = env("PAYPAL_API_URL",           default="https://api-m.sandbox.paypal.com")



# ════════════════════════════════════════════════════════════════════════════
# PASTE THIS BLOCK into  backend/config/settings.py
# Find the existing "# ─── Payment Gateways" section and append below it.
# ════════════════════════════════════════════════════════════════════════════

# ─── Monnify  ────────────────────────────────────────────────────────────────
MONNIFY_API_KEY       = env("MONNIFY_API_KEY",       default="")
MONNIFY_SECRET_KEY    = env("MONNIFY_SECRET_KEY",    default="")
MONNIFY_CONTRACT_CODE = env("MONNIFY_CONTRACT_CODE", default="")
MONNIFY_BASE_URL      = env("MONNIFY_BASE_URL",      default="https://api.monnify.com")
# For sandbox testing use: https://sandbox.monnify.com

# ─── Hotel Bank Accounts  (used in bank_transfer response) ───────────────────
# Replace these placeholder values with your real account numbers in .env
HOTEL_GTB_ACCOUNT      = env("HOTEL_GTB_ACCOUNT",      default="0123456789")
HOTEL_FIRSTBANK_ACCOUNT= env("HOTEL_FIRSTBANK_ACCOUNT", default="3012345678")
HOTEL_ZENITH_ACCOUNT   = env("HOTEL_ZENITH_ACCOUNT",   default="1012345678")



FRONTEND_URL             = env("FRONTEND_URL",             default="http://localhost:3000")

# ─── AI ──────────────────────────────────────────────────
OPENAI_API_KEY = env("OPENAI_API_KEY", default="")
OPENAI_MODEL   = env("OPENAI_MODEL",   default="gpt-4o-mini")

# ─── Hotel Config ────────────────────────────────────────
HOTEL_NAME        = env("HOTEL_NAME",    default="Enayi Hotels & Suites")
HOTEL_TAGLINE     = env("HOTEL_TAGLINE", default="Where Luxury Meets Nigerian Warmth")
HOTEL_ADDRESS     = env("HOTEL_ADDRESS", default="Rayfield Road, Jos, Plateau State, Nigeria")
HOTEL_PHONE       = env("HOTEL_PHONE",   default="+234-800-000-0000")
HOTEL_EMAIL       = env("HOTEL_EMAIL",   default="info@enayihotels.com")
HOTEL_WHATSAPP    = env("HOTEL_WHATSAPP",default="+2348000000000")
HOTEL_LAT         = float(env("HOTEL_LAT", default="9.8965"))
HOTEL_LNG         = float(env("HOTEL_LNG", default="8.8583"))
HOTEL_CHECKIN     = env("HOTEL_CHECKIN_TIME",  default="14:00")
HOTEL_CHECKOUT    = env("HOTEL_CHECKOUT_TIME", default="12:00")

# ─── Swagger ─────────────────────────────────────────────
SWAGGER_SETTINGS = {
    "SECURITY_DEFINITIONS": {
        "Bearer": {"type": "apiKey", "name": "Authorization", "in": "header"}
    },
    "USE_SESSION_AUTH": False,
    "JSON_EDITOR": True,
    "DEFAULT_MODEL_RENDERING": "example",
}

# ─── Production Security ─────────────────────────────────
# These only bite when DEBUG=False (i.e. on Render). Render already forces HTTPS
# at the edge, so cookie-secure + HSTS are safe to enable in production.
if not DEBUG:
    SECURE_SSL_REDIRECT     = env.bool("SECURE_SSL_REDIRECT",     default=False)
    SESSION_COOKIE_SECURE   = env.bool("SESSION_COOKIE_SECURE",   default=True)
    CSRF_COOKIE_SECURE      = env.bool("CSRF_COOKIE_SECURE",      default=True)
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS         = env.int("SECURE_HSTS_SECONDS", default=0)  # raise once stable
    X_FRAME_OPTIONS             = "DENY"

# ─── Logging ─────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "apps": {"handlers": ["console"], "level": "DEBUG" if DEBUG else "INFO", "propagate": False},
    },
}
