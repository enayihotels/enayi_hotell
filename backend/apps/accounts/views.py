"""Enayi Hotels — Accounts Views"""
import random, string
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.views import TokenRefreshView
from .models import User, OTPVerification, AccessRequest
from .serializers import UserSerializer, RegisterSerializer, LoginSerializer, ChangePasswordSerializer, UpdateProfileSerializer, ForgotPasswordSerializer, ResetPasswordSerializer, AccessRequestSerializer

def get_tokens(user):
    refresh = RefreshToken.for_user(user)
    refresh["email"]     = user.email
    refresh["full_name"] = user.get_full_name()
    refresh["role"]      = user.role
    return {"refresh": str(refresh), "access": str(refresh.access_token)}

def send_otp(user, otp, purpose):
    subject = {"email_verify": "Verify Your Enayi Hotels Account", "password_reset": "Enayi Hotels — Password Reset"}
    try:
        send_mail(subject.get(purpose, "OTP"), f"Your code: {otp} (expires soon)\n\nEnayi Hotels & Suites", settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=True)
    except Exception:
        pass

class RegisterView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        s = RegisterSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=400)
        user = s.save()
        otp  = "".join(random.choices(string.digits, k=6))
        OTPVerification.objects.create(user=user, otp=otp, purpose="email_verify", expires_at=timezone.now() + timedelta(minutes=30))
        send_otp(user, otp, "email_verify")
        return Response({"message": "Registration successful! Check your email to verify.", "user": UserSerializer(user).data, **get_tokens(user)}, status=201)

class LoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        s = LoginSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=400)
        user = authenticate(request, username=s.validated_data["email"].lower(), password=s.validated_data["password"])
        if not user:
            return Response({"error": "Invalid email or password."}, status=401)
        if not user.is_active:
            return Response({"error": "Account deactivated."}, status=403)

        if user.is_shift_role:
            if not user.is_on_duty:
                return Response({
                    "error": "You've been switched off duty. Ask your Manager to switch you back on before you can log in.",
                    "code": "off_duty",
                }, status=403)
            # Self-attestation: a reminder, not a hard control (anyone could
            # answer "yes") — the real enforcement is is_on_duty above, which
            # only a Manager/Admin can change. Credentials are already
            # verified at this point; the frontend just needs to show this
            # prompt and resubmit the exact same request with confirm_on_duty
            # once the person says yes.
            if not request.data.get("confirm_on_duty"):
                return Response({
                    "requires_shift_confirmation": True,
                    "message": "Are you on duty right now?",
                }, status=200)

        user.last_login_ip = request.META.get("REMOTE_ADDR")
        user.save(update_fields=["last_login_ip"])
        return Response({"message": f"Welcome back, {user.first_name}! 🏨", "user": UserSerializer(user).data, **get_tokens(user)})

class GoogleAuthView(APIView):
    """POST /api/v1/auth/google/  — body: {"credential": "<Google ID token>"}

    Verifies the ID token Google's Sign-In button hands back to the
    frontend, then finds-or-creates a guest account by email (Google
    guarantees the email in a valid ID token is verified, so it's safe
    to trust as an identity match — same email-based linking every
    "Sign in with Google" implementation uses). Returns the same shape
    as LoginView/RegisterView so the frontend handles it identically.

    Existing accounts (including ones created the normal way with a
    password) sign in fine via Google as long as the email matches —
    that's expected, not a bug: it's still proving the same verified
    email address, just via a different method.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        credential = request.data.get("credential")
        if not credential:
            return Response({"error": "Missing Google credential."}, status=400)

        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests

        try:
            idinfo = google_id_token.verify_oauth2_token(
                credential, google_requests.Request(), settings.GOOGLE_OAUTH_CLIENT_ID,
            )
        except ValueError:
            return Response({"error": "Google sign-in failed — the token could not be verified. Please try again."}, status=401)

        if not idinfo.get("email_verified", False):
            return Response({"error": "That Google account's email isn't verified. Please verify it with Google first."}, status=401)

        email = idinfo["email"].lower()
        user = User.objects.filter(email=email).first()

        if user is None:
            user = User.objects.create_user(
                email=email,
                password=None,  # Django's set_password(None) marks it unusable automatically
                first_name=idinfo.get("given_name", "") or (idinfo.get("name", "Guest").split(" ")[0]),
                last_name=idinfo.get("family_name", ""),
                role=User.GUEST,
                is_verified=True,
            )
        elif not user.is_active:
            return Response({"error": "This account has been deactivated. Contact us if you think that's a mistake."}, status=403)
        elif not user.is_verified:
            # Signing in with Google proves the email either way — no
            # reason to keep blocking them on our own OTP step.
            user.is_verified = True
            user.save(update_fields=["is_verified"])

        user.last_login_ip = request.META.get("REMOTE_ADDR")
        user.save(update_fields=["last_login_ip"])

        return Response({
            "message": f"Welcome, {user.first_name}! 🏨",
            "user": UserSerializer(user).data,
            **get_tokens(user),
        })


class ShiftAwareTokenRefreshView(TokenRefreshView):
    """Same off-duty check as ShiftAwareJWTAuthentication, but for the
    token-refresh endpoint specifically — that endpoint authenticates
    via the REFRESH token, not the access token, so it never goes
    through ShiftAwareJWTAuthentication at all. Without this override,
    someone switched off duty mid-session could just silently refresh
    their way to a new access token and keep working, which would
    defeat the whole point of the Manager's off-duty toggle taking
    effect immediately rather than at next login.
    """
    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                user_id = RefreshToken(refresh_token).get("user_id")
                user = User.objects.filter(id=user_id).first()
                if user and user.is_shift_role and not user.is_on_duty:
                    return Response(
                        {"error": "You've been switched off duty. Ask your Manager to switch you back on before you can log in."},
                        status=401,
                    )
            except TokenError:
                pass  # let the parent view produce its own normal invalid/expired-token error
        return super().post(request, *args, **kwargs)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            RefreshToken(request.data.get("refresh")).blacklist()
            return Response({"message": "Logged out successfully."})
        except TokenError:
            return Response({"error": "Invalid token."}, status=400)

class ProfileView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response(UserSerializer(request.user).data)
    def patch(self, request):
        s = UpdateProfileSerializer(request.user, data=request.data, partial=True)
        if s.is_valid():
            s.save()
            return Response(UserSerializer(request.user).data)
        return Response(s.errors, status=400)

class AvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        if "avatar" not in request.FILES:
            return Response({"error": "No image provided."}, status=400)
        request.user.avatar = request.FILES["avatar"]
        request.user.save(update_fields=["avatar"])
        return Response({"avatar_url": request.build_absolute_uri(request.user.avatar.url)})

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        s = ChangePasswordSerializer(data=request.data, context={"request": request})
        if s.is_valid():
            request.user.set_password(s.validated_data["new_password"])
            request.user.save()
            return Response({"message": "Password changed successfully."})
        return Response(s.errors, status=400)

class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        email = request.data.get("email", "").lower()
        try:
            user = User.objects.get(email=email)
            OTPVerification.objects.filter(user=user, purpose="password_reset", is_used=False).update(is_used=True)
            otp = "".join(random.choices(string.digits, k=6))
            OTPVerification.objects.create(user=user, otp=otp, purpose="password_reset", expires_at=timezone.now() + timedelta(minutes=15))
            send_otp(user, otp, "password_reset")
        except User.DoesNotExist:
            pass
        return Response({"message": "If that email is registered, a reset code has been sent."})

class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        s = ResetPasswordSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=400)
        data = s.validated_data
        try:
            user    = User.objects.get(email=data["email"].lower())
            otp_obj = OTPVerification.objects.get(user=user, otp=data["otp"], purpose="password_reset", is_used=False, expires_at__gt=timezone.now())
            user.set_password(data["new_password"])
            user.save()
            otp_obj.is_used = True
            otp_obj.save()
            return Response({"message": "Password reset successful."})
        except (User.DoesNotExist, OTPVerification.DoesNotExist):
            return Response({"error": "Invalid or expired code."}, status=400)

class VerifyEmailView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        otp = request.data.get("otp", "").strip()
        try:
            obj = OTPVerification.objects.get(user=request.user, otp=otp, purpose="email_verify", is_used=False, expires_at__gt=timezone.now())
            request.user.is_verified = True
            request.user.save(update_fields=["is_verified"])
            obj.is_used = True
            obj.save()
            return Response({"message": "Email verified! ✅"})
        except OTPVerification.DoesNotExist:
            return Response({"error": "Invalid or expired code."}, status=400)

class ResendOTPView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        OTPVerification.objects.filter(user=request.user, purpose="email_verify", is_used=False).update(is_used=True)
        otp = "".join(random.choices(string.digits, k=6))
        OTPVerification.objects.create(user=request.user, otp=otp, purpose="email_verify", expires_at=timezone.now() + timedelta(minutes=30))
        send_otp(request.user, otp, "email_verify")
        return Response({"message": "New verification code sent."})

class GuestListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = UserSerializer
    def get_queryset(self):
        # Laundry Staff needs to look guests up by name/email when
        # logging a ticket, so a real account (not just typed text)
        # backs the payment later — narrow addition here only;
        # is_hotel_staff itself stays untouched since broadening THAT
        # would silently affect every other is_hotel_staff-gated view.
        if self.request.user.is_hotel_staff or self.request.user.role == "laundry_staff":
            return User.objects.filter(role=User.GUEST).order_by("-date_joined")
        return User.objects.none()

class StaffListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = UserSerializer
    def get_queryset(self):
        if self.request.user.role not in [User.MANAGER, User.ADMIN]:
            return User.objects.none()
        qs = User.objects.exclude(role=User.GUEST).order_by("role", "first_name")
        # Manager sees their own branch's staff plus every other Manager/
        # Admin (so they can see who else has access) — Admin sees everyone.
        if self.request.user.role == User.MANAGER:
            from django.db.models import Q
            qs = qs.filter(Q(hotel_id=self.request.user.hotel_id) | Q(role__in=[User.MANAGER, User.ADMIN]))
        return qs


class ToggleDutyView(APIView):
    """POST /api/v1/auth/staff/<id>/duty/  — body: {"is_on_duty": true|false}

    Manager/Admin only. Manager is restricted to staff at their own
    branch (can't toggle another branch's people, or another Manager/
    Admin's account); Admin can toggle anyone. Switching someone off
    takes effect immediately on their very next request — see
    apps.accounts.authentication.ShiftAwareJWTAuthentication and the
    matching check on token refresh below — not just their next login.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        if request.user.role not in [User.MANAGER, User.ADMIN]:
            return Response({"error": "Manager/Admin only."}, status=403)

        target = get_object_or_404(User, id=user_id)
        if not target.is_shift_role:
            return Response({"error": "This account's role isn't a shift-based one — nothing to toggle."}, status=400)
        if request.user.role == User.MANAGER and target.hotel_id != request.user.hotel_id:
            return Response({"error": "You can only manage staff at your own branch."}, status=403)

        is_on_duty = request.data.get("is_on_duty")
        if not isinstance(is_on_duty, bool):
            return Response({"error": "is_on_duty must be true or false."}, status=400)

        target.is_on_duty = is_on_duty
        target.save(update_fields=["is_on_duty"])
        return Response({
            "message": f"{target.get_full_name()} switched {'ON' if is_on_duty else 'OFF'} duty.",
            "user": UserSerializer(target).data,
        })


class RequestAccessView(APIView):
    """POST /api/v1/auth/request-access/  — body: {"email": "...", "note": "optional"}

    Public (AllowAny) — the whole point is that an off-duty shift-role
    account has no valid session to authenticate with. Only usable by
    an account that's genuinely a shift role AND currently off duty
    (silently no-ops for anyone else, rather than confirming/denying
    whether an email exists — same reasoning as the login error message
    never distinguishing "wrong email" from "wrong password").

    Emails the requester's branch Manager(s) plus every Admin — this
    reuses the existing send_mail/DEFAULT_FROM_EMAIL setup rather than
    anything new (there's no SMS/WhatsApp channel yet — a separate,
    larger piece of work).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"error": "Email is required."}, status=400)

        user = User.objects.filter(email=email).first()
        # Same non-committal response either way — don't reveal whether
        # this email exists, is the wrong role, or is already on duty.
        generic_ok = Response({"message": "If that account is off duty, your Manager has been notified."})

        if not user or not user.is_shift_role or user.is_on_duty:
            return generic_ok

        existing = AccessRequest.objects.filter(user=user, status=AccessRequest.PENDING).first()
        if not existing:
            existing = AccessRequest.objects.create(user=user, note=(request.data.get("note") or "")[:300])

            recipients = list(
                User.objects.filter(role=User.ADMIN).values_list("email", flat=True)
            )
            if user.hotel_id:
                recipients += list(
                    User.objects.filter(role=User.MANAGER, hotel_id=user.hotel_id)
                    .exclude(id=user.id)
                    .values_list("email", flat=True)
                )
            recipients = list(dict.fromkeys(r for r in recipients if r))  # de-dupe, drop blanks

            if recipients:
                try:
                    send_mail(
                        "Enayi Hotels — Access Request",
                        f"{user.get_full_name()} ({user.get_role_display()}"
                        f"{', ' + user.hotel.name if user.hotel_id else ''}) has requested to be "
                        f"switched back on duty so they can log in.\n\n"
                        f"Review it in Admin \u2192 Staff Duty.\n\nEnayi Hotels & Suites",
                        settings.DEFAULT_FROM_EMAIL, recipients, fail_silently=True,
                    )
                except Exception:
                    pass

        return generic_ok


class AccessRequestListView(generics.ListAPIView):
    """GET /api/v1/auth/access-requests/  — Manager/Admin only.
    Manager sees only their own branch's requests; Admin sees all."""
    permission_classes = [IsAuthenticated]
    serializer_class = AccessRequestSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role not in [User.MANAGER, User.ADMIN]:
            return AccessRequest.objects.none()
        qs = AccessRequest.objects.select_related("user", "user__hotel", "decided_by")
        if user.role == User.MANAGER:
            qs = qs.filter(user__hotel_id=user.hotel_id)
        return qs


class DecideAccessRequestView(APIView):
    """POST /api/v1/auth/access-requests/<id>/decide/  — body: {"approve": true|false}

    Manager/Admin only, same branch restriction as ToggleDutyView.
    Approving switches the requester back on duty in the same step —
    no separate manual toggle needed afterward."""
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        if request.user.role not in [User.MANAGER, User.ADMIN]:
            return Response({"error": "Manager/Admin only."}, status=403)

        ar = get_object_or_404(AccessRequest.objects.select_related("user"), id=request_id)
        if request.user.role == User.MANAGER and ar.user.hotel_id != request.user.hotel_id:
            return Response({"error": "You can only decide requests for your own branch."}, status=403)
        if ar.status != AccessRequest.PENDING:
            return Response({"error": f"This request was already {ar.status}."}, status=400)

        approve = request.data.get("approve")
        if not isinstance(approve, bool):
            return Response({"error": "approve must be true or false."}, status=400)

        ar.status = AccessRequest.APPROVED if approve else AccessRequest.DENIED
        ar.decided_by = request.user
        ar.decided_at = timezone.now()
        ar.save(update_fields=["status", "decided_by", "decided_at"])

        if approve:
            ar.user.is_on_duty = True
            ar.user.save(update_fields=["is_on_duty"])

        return Response({
            "message": f"Request {'approved' if approve else 'denied'}.",
            "access_request": AccessRequestSerializer(ar).data,
        })
