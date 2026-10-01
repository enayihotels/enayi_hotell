"""
Replaces Zarmaganda's test staff accounts with the real staff roster
Adrian photographed (a handwritten sheet: name, department, phone).
Two steps, in order:

1. DELETE every existing non-Admin account at Zarmaganda — these are
   all placeholder/test accounts from earlier development (mary@,
   kefas@, ochep59@, zack@, etc.), being replaced by the real roster
   below. Admin/Owner accounts are never touched (they aren't branch-
   scoped anyway). Guest accounts are also left alone on purpose —
   this is about STAFF accounts only; deleting real guest bookings
   would be a completely different, much more dangerous operation.

   If any account to delete has ever placed an Order or Booking as a
   guest (Order.guest/Booking.guest are PROTECT, not CASCADE — by
   design, so real transaction history can never be silently erased
   by deleting the account that made it), deletion is skipped for that
   one account with a clear message explaining why, rather than
   crashing the whole run.

2. CREATE the 14 real staff accounts below, each tied to Zarmaganda,
   with a starting password of 12345678@ (everyone's told to change it
   after first login — Admin/Manager can always reset it for someone
   from Staff Duty or Django Admin if they forget).

   Email pattern per Adrian's instruction ("first name and surname
   together with the domain"): firstname + surname, lowercase, no
   separator, @enayihotels.com. For a name with a middle name/extra
   word (e.g. "Gift Ene Enonche"), only the FIRST and LAST words are
   used for the email (giftenonche@...) — the full name is still kept
   as-is for display (first_name="Gift", last_name="Ene Enonche").

   A duplicate check runs first: if the generated email already
   belongs to an existing account (e.g. a genuine naming collision, or
   this command being re-run), that one person is skipped with a clear
   note instead of silently overwriting or erroring out the whole run.

SAFETY: defaults to a DRY RUN — prints every account it would delete
and create, touches nothing. Pass --apply to actually commit.

Usage (from backend root):
    python manage.py sync_zarmaganda_staff            # dry run
    python manage.py sync_zarmaganda_staff --apply     # for real
"""
from django.core.management.base import BaseCommand
from django.db.models import ProtectedError

from apps.hotels.models import Hotel
from apps.accounts.models import User

PASSWORD = "12345678@"

# (full_name, department, phone) — transcribed directly from the
# photographed roster. full_name's first word = first name, last word
# = surname used for the email; everything in between is kept in
# last_name for display but dropped from the email.
ROSTER = [
    ("Odoh Ochanya",        "Receptionist", "08108542856"),
    ("Gift Ene Enonche",    "Receptionist", "08132937794"),
    ("Darmau Elisha",       "Bar",          "09034496002"),
    ("Mary Sunday",         "Bar",          "09047526181"),
    ("Simi Stra Joseph",    "Kitchen",      "07034669585"),
    ("Abigail Gomb",        "Kitchen",      "08037524869"),
    ("Benjamin Thomas",     "Laundry",      "07075186582"),
    ("Markus Hosea",        "Laundry",      "08163978372"),
    ("Sarah John Ajege",    "Housekeeper",  "08100146359"),
    ("Ruth David",          "Housekeeper",  "07073584441"),
    ("Othniel Daluhut",     "Housekeeper",  "08101660911"),
    ("Rita Joshua",         "Housekeeper",  "08167009880"),
    ("Makings Ulo Joseph",  "Kitchen",      "07078781318"),
    ("Ritji Goshang",       "Manager",      "07036872144"),
]

DEPARTMENT_TO_ROLE = {
    "Receptionist": User.STAFF,
    "Bar":          User.BAR_STAFF,
    "Kitchen":      User.KITCHEN_STAFF,
    "Laundry":      User.LAUNDRY_STAFF,
    "Housekeeper":  User.HOUSEKEEPER,
    "Manager":      User.MANAGER,
}


def build_email(full_name):
    parts = full_name.split()
    return (parts[0] + parts[-1]).lower() + "@enayihotels.com"


class Command(BaseCommand):
    help = "Replace Zarmaganda's test staff accounts with the real roster from the handwritten sheet."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Actually commit changes. Without this flag, dry-run only.")

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        mode = "APPLYING CHANGES" if apply_changes else "DRY RUN — no changes will be saved"
        self.stdout.write(self.style.WARNING(f"\n=== {mode} ===\n"))

        try:
            hotel = Hotel.objects.get(branch="zaramaganda")
        except Hotel.DoesNotExist:
            self.stderr.write(self.style.ERROR('Hotel with branch="zaramaganda" (Zarmaganda) not found. Aborting.'))
            return

        # ── Step 1: remove existing non-Admin accounts at this branch ──
        self.stdout.write(self.style.MIGRATE_HEADING("Step 1 — Remove existing test staff accounts"))
        to_remove = User.objects.filter(hotel=hotel).exclude(role=User.ADMIN).exclude(role=User.GUEST)
        if not to_remove.exists():
            self.stdout.write("  No existing non-Admin staff accounts found at this branch.")
        for u in to_remove:
            self.stdout.write(f'  Deleting {u.email!r} (role={u.role})')
            if apply_changes:
                try:
                    u.delete()
                except ProtectedError as exc:
                    blockers = ", ".join(sorted({o._meta.label for o in exc.protected_objects}))
                    self.stdout.write(self.style.ERROR(
                        f'    BLOCKED: {u.email!r} has real {blockers} records tied to it as a guest — '
                        f'not deleted. Reassign/clear those first if this account genuinely needs removing.'
                    ))

        # ── Step 2: create the real roster ──
        self.stdout.write(self.style.MIGRATE_HEADING("\nStep 2 — Create real staff accounts"))
        for full_name, department, phone in ROSTER:
            email = build_email(full_name)
            role = DEPARTMENT_TO_ROLE.get(department)
            parts = full_name.split()
            first_name, last_name = parts[0], " ".join(parts[1:])

            if role is None:
                self.stdout.write(self.style.ERROR(f'  SKIP "{full_name}": unrecognized department "{department}".'))
                continue

            if User.objects.filter(email=email).exists():
                self.stdout.write(self.style.WARNING(f'  SKIP "{full_name}" <{email}>: that email is already in use by another account.'))
                continue

            self.stdout.write(f'  + "{full_name}" <{email}> — {department} ({role}), phone {phone}')
            if apply_changes:
                user = User.objects.create_user(
                    email=email, password=PASSWORD,
                    first_name=first_name, last_name=last_name,
                    role=role, hotel=hotel, phone=phone,
                    is_verified=True,  # Admin is creating these in person — no OTP step needed
                )

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                "\n=== DRY RUN complete — nothing was saved. Review the output above, then re-run with --apply to commit. ==="
            ))
        else:
            self.stdout.write(self.style.SUCCESS(f"\n=== Done — all changes committed. Starting password for every new account: {PASSWORD} ==="))
