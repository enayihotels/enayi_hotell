from django.urls import path
from . import views
urlpatterns = [
    path("register/",        views.RegisterView.as_view(),        name="auth-register"),
    path("login/",           views.LoginView.as_view(),           name="auth-login"),
    path("google/",          views.GoogleAuthView.as_view(),      name="auth-google"),
    path("logout/",          views.LogoutView.as_view(),          name="auth-logout"),
    path("token/refresh/",   views.ShiftAwareTokenRefreshView.as_view(), name="token-refresh"),
    path("profile/",         views.ProfileView.as_view(),         name="auth-profile"),
    path("avatar/",          views.AvatarUploadView.as_view(),    name="auth-avatar"),
    path("change-password/", views.ChangePasswordView.as_view(),  name="auth-change-password"),
    path("forgot-password/", views.ForgotPasswordView.as_view(),  name="auth-forgot-password"),
    path("reset-password/",  views.ResetPasswordView.as_view(),   name="auth-reset-password"),
    path("verify-email/",    views.VerifyEmailView.as_view(),     name="auth-verify-email"),
    path("resend-otp/",      views.ResendOTPView.as_view(),       name="auth-resend-otp"),
    path("guests/",          views.GuestListView.as_view(),       name="auth-guests"),
    path("staff/",           views.StaffListView.as_view(),       name="auth-staff"),
    path("staff/<uuid:user_id>/duty/", views.ToggleDutyView.as_view(), name="auth-toggle-duty"),
    path("request-access/", views.RequestAccessView.as_view(), name="auth-request-access"),
    path("access-requests/", views.AccessRequestListView.as_view(), name="auth-access-requests"),
    path("access-requests/<uuid:request_id>/decide/", views.DecideAccessRequestView.as_view(), name="auth-decide-access-request"),
]
