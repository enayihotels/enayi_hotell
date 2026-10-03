"""
Replaces Rayfield's old/test staff accounts with the real roster from
"Enayi_Hotels_Zarmaganda_and_Rayfield_Branches.docx". Same two-step
pattern as sync_zarmaganda_staff.py:

1. DELETE every existing non-Admin account at Rayfield. Same safety
   net as the Zarmaganda version: if an account has real Order/Booking
   history tied to it as a guest (PROTECT, not CASCADE, by design),
   it's skipped with a clear message instead of crashing the run.

2. CREATE the 8 roster accounts, all starting with password
   12345678@, plus Paul Ogwuche as Rayfield's Manager (a 9th account —
   he's not on the department sheet, but named explicitly by Adrian).
   Paul's separate Store Keeper account (which needs BOTH branches,
   not just Rayfield) is intentionally NOT created here — that's a
   different kind of account entirely and is handled by
   create_cross_branch_storekeeper.py instead, after the multi-branch
   access capability itself exists in code.

Email pattern: firstname + surname, lowercase, no separator,
@enayihotels.com — same convention as Zarmaganda's roster.

SAFETY: defaults to a DRY RUN — prints every account it would delete
and create, touches nothing. Pass --apply to actually commit.

Usage (from backend root):
    python manage.py sync_rayfield_staff            # dry run
    python manage.py sync_rayfield_staff --apply     # for real
"""
from django.core.management.base import BaseCommand
from django.db.models import ProtectedError

from apps.hotels.models import Hotel
from apps.accounts.models import User

PASSWORD = "12345678@"

# (full_name, department, phone) — transcribed directly from the
# uploaded document's Rayfield staff directory table.
ROSTER = [
    ("Mary Dung",             "Receptionist", "08131300678"),
    ("Malia Yakubu",          "Receptionist", "08147668061"),
    ("Gwon Ibrahim",          "Bar",          "07035535973"),
    ("Angel Arin",            "Bar",          "07087000271"),
    ("Rose-B. Ramnap",        "Kitchen",      "08101120669"),
    ("Mafeng Musa",           "Kitchen",      "09138343203"),
    ("Annesthesia Anthony",   "House Keeper", "09167300969"),
    ("Magaji Esther",         "House Keeper", "08162371917"),
]

DEPARTMENT_TO_ROLE = {
    "Receptionist": User.STAFF,
    "Bar":          User.BAR_STAFF,
    "Kitchen":      User.KITCHEN_STAFF,
    "House Keeper": User.HOUSEKEEPER,
}


def build_email(full_name):
    # Strip hyphens/periods from names like "Rose-B. Ramnap" before
    # splitting, so the email comes out as a clean "rose-branap" ->
    # really "roseramnap" style slug rather than carrying punctuation.
    cleaned = full_name.replace("-", " ").replace(".", " ")
    parts = [p for p in cleaned.split() if p]
    return (parts[0] + parts[-1]).lower() + "@enayihotels.com"


class Command(BaseCommand):
    help = "Replace Rayfield's old/test staff accounts with the real roster, plus Paul Ogwuche as Manager."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Actually commit changes. Without this flag, dry-run only.")

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        mode = "APPLYING CHANGES" if apply_changes else "DRY RUN — no changes will be saved"
        self.stdout.write(self.style.WARNING(f"\n=== {mode} ===\n"))

        try:
            hotel = Hotel.objects.get(branch="fwawei")
        except Hotel.DoesNotExist:
            self.stderr.write(self.style.ERROR('Hotel with branch="fwawei" (Rayfield) not found. Aborting.'))
            return

        # ── Step 1: remove existing non-Admin accounts at this branch ──
        self.stdout.write(self.style.MIGRATE_HEADING("Step 1 — Remove existing staff accounts"))
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

        # ── Step 2: create the real roster + Manager ──
        self.stdout.write(self.style.MIGRATE_HEADING("\nStep 2 — Create real staff accounts"))
        entries = list(ROSTER) + [("Paul Ogwuche", "Manager", None)]
        for full_name, department, phone in entries:
            email = build_email(full_name)
            role = User.MANAGER if department == "Manager" else DEPARTMENT_TO_ROLE.get(department)
            parts = full_name.replace("-", " ").replace(".", " ").split()
            first_name, last_name = parts[0], " ".join(parts[1:])

            if role is None:
                self.stdout.write(self.style.ERROR(f'  SKIP "{full_name}": unrecognized department "{department}".'))
                continue

            if User.objects.filter(email=email).exists():
                self.stdout.write(self.style.WARNING(f'  SKIP "{full_name}" <{email}>: that email is already in use by another account.'))
                continue

            phone_note = f", phone {phone}" if phone else " — NO PHONE NUMBER ON FILE, add one later"
            self.stdout.write(f'  + "{full_name}" <{email}> — {department} ({role}){phone_note}')
            if apply_changes:
                User.objects.create_user(
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
