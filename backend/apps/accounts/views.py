"""Enayi Hotels — Accounts Views"""
import random, string
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from .models import User, OTPVerification
from .serializers import UserSerializer, RegisterSerializer, LoginSerializer, ChangePasswordSerializer, UpdateProfileSerializer, ForgotPasswordSerializer, ResetPasswordSerializer

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
        user.last_login_ip = request.META.get("REMOTE_ADDR")
        user.save(update_fields=["last_login_ip"])
        return Response({"message": f"Welcome back, {user.first_name}! 🏨", "user": UserSerializer(user).data, **get_tokens(user)})

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
        if self.request.user.is_hotel_staff:
            return User.objects.filter(role=User.GUEST).order_by("-date_joined")
        return User.objects.none()

class StaffListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = UserSerializer
    def get_queryset(self):
        if self.request.user.role in [User.MANAGER, User.ADMIN]:
            return User.objects.filter(role__in=[User.STAFF, User.MANAGER]).order_by("first_name")
        return User.objects.none()
