"""
Wraps SimpleJWT's normal authentication with one extra check: a
shift-role user (Front Desk Staff, Bar Staff, Kitchen Staff,
Housekeeper — see User.is_shift_role) who has been switched off duty
by a Manager/Admin is rejected here, on EVERY authenticated request —
not just at login. This is what makes the Manager's off-duty toggle a
real, immediate control rather than something that only takes effect
the next time the person happens to log in again: their very next API
call after being switched off fails with 401, the frontend's existing
401 handling sends them back to the sign-in screen, and their old
access token is worthless from that point on even though it hasn't
technically expired.

Set as DEFAULT_AUTHENTICATION_CLASSES in settings so it applies
everywhere without having to touch every individual view.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed


class ShiftAwareJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, validated_token = result
        if user.is_shift_role and not user.is_on_duty:
            raise AuthenticationFailed(
                "You've been switched off duty. Ask your Manager to switch you back on before you can log in.",
                code="off_duty",
            )
        return user, validated_token
