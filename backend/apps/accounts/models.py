"""Enayi Hotels — Accounts Models"""
import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
from phonenumber_field.modelfields import PhoneNumberField


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user  = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff",      True)
        extra.setdefault("is_superuser",  True)
        extra.setdefault("role",          User.ADMIN)
        extra.setdefault("is_verified",   True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    GUEST   = "guest"
    STAFF   = "staff"
    MANAGER = "manager"
    ADMIN   = "admin"

    ROLE_CHOICES = [
        (GUEST,   "Guest"),
        (STAFF,   "Staff"),
        (MANAGER, "Manager"),
        (ADMIN,   "Admin"),
    ]

    ID_TYPES = [
        ("passport",        "International Passport"),
        ("nin",             "National Identification Number"),
        ("drivers_license", "Driver's Licence"),
        ("voters_card",     "Voter's Card"),
    ]

    NATIONALITIES = [
        ("nigerian", "Nigerian"),
        ("ghanaian", "Ghanaian"),
        ("kenyan",   "Kenyan"),
        ("other",    "Other"),
    ]

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email          = models.EmailField(unique=True, db_index=True)
    first_name     = models.CharField(max_length=100)
    last_name      = models.CharField(max_length=100)
    phone          = PhoneNumberField(blank=True, null=True, region="NG")
    role           = models.CharField(max_length=20, choices=ROLE_CHOICES, default=GUEST, db_index=True)
    avatar         = models.ImageField(upload_to="avatars/%Y/%m/", blank=True, null=True)
    date_of_birth  = models.DateField(blank=True, null=True)
    nationality    = models.CharField(max_length=50,  choices=NATIONALITIES, blank=True, default="nigerian")
    id_type        = models.CharField(max_length=30,  choices=ID_TYPES, blank=True)
    id_number      = models.CharField(max_length=100, blank=True)
    address        = models.TextField(blank=True)
    city           = models.CharField(max_length=100, blank=True)
    state          = models.CharField(max_length=100, blank=True)
    country        = models.CharField(max_length=100, blank=True, default="Nigeria")
    is_verified    = models.BooleanField(default=False)
    is_active      = models.BooleanField(default=True)
    is_staff       = models.BooleanField(default=False)
    date_joined    = models.DateTimeField(default=timezone.now)
    last_login_ip  = models.GenericIPAddressField(blank=True, null=True)
    loyalty_points = models.PositiveIntegerField(default=0)
    newsletter     = models.BooleanField(default=True)
    preferences    = models.JSONField(default=dict, blank=True)

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]
    objects         = UserManager()

    class Meta:
        db_table             = "users"
        verbose_name         = "User"
        verbose_name_plural  = "Users"
        ordering             = ["-date_joined"]

    def __str__(self):
        return f"{self.get_full_name()} <{self.email}>"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def get_short_name(self):
        return self.first_name

    @property
    def is_hotel_staff(self):
        return self.role in [self.STAFF, self.MANAGER, self.ADMIN]

    def add_loyalty_points(self, points: int, reason: str = ""):
        self.loyalty_points += points
        self.save(update_fields=["loyalty_points"])
        LoyaltyTransaction.objects.create(
            user=self, points=points, reason=reason,
            balance_after=self.loyalty_points,
        )


class OTPVerification(models.Model):
    PURPOSES = [
        ("email_verify",   "Email Verification"),
        ("password_reset", "Password Reset"),
        ("phone_verify",   "Phone Verification"),
        ("login_2fa",      "2FA Login"),
    ]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otps")
    otp        = models.CharField(max_length=6)
    purpose    = models.CharField(max_length=20, choices=PURPOSES)
    is_used    = models.BooleanField(default=False)
    attempts   = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "otp_verifications"

    def is_valid(self):
        return not self.is_used and self.expires_at > timezone.now() and self.attempts < 5


class LoyaltyTransaction(models.Model):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user          = models.ForeignKey(User, on_delete=models.CASCADE, related_name="loyalty_transactions")
    points        = models.IntegerField()
    reason        = models.CharField(max_length=300, blank=True)
    balance_after = models.PositiveIntegerField()
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "loyalty_transactions"
        ordering = ["-created_at"]


class StaffProfile(models.Model):
    DEPARTMENTS = [
        ("front_desk",    "Front Desk & Reservations"),
        ("housekeeping",  "Housekeeping"),
        ("kitchen",       "Kitchen & Culinary"),
        ("bar",           "Bar & Beverages"),
        ("events",        "Events & Banqueting"),
        ("security",      "Security"),
        ("maintenance",   "Maintenance & Engineering"),
        ("management",    "Management"),
        ("accounting",    "Accounting & Finance"),
    ]

    user        = models.OneToOneField(User, on_delete=models.CASCADE, related_name="staff_profile")
    department  = models.CharField(max_length=30, choices=DEPARTMENTS)
    employee_id = models.CharField(max_length=20, unique=True)
    date_hired  = models.DateField()
    salary      = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    shift       = models.CharField(max_length=20, choices=[
        ("morning",   "Morning  (6am–2pm)"),
        ("afternoon", "Afternoon (2pm–10pm)"),
        ("night",     "Night  (10pm–6am)"),
        ("flexible",  "Flexible"),
    ], default="flexible")
    is_on_duty  = models.BooleanField(default=False)
    notes       = models.TextField(blank=True)

    class Meta:
        db_table = "staff_profiles"

    def __str__(self):
        return f"{self.user.get_full_name()} — {self.department}"
