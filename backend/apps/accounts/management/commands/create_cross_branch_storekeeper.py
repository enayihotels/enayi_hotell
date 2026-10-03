"""
Creates Paul Ogwuche's Store Keeper account, deliberately with NO
`hotel` set — that's what actually makes it a cross-branch account.
See apps.inventory.views._effective_hotel and
apps.assets.views._effective_hotel: a Store Keeper with no branch on
their account is treated like Admin for viewing stock, Property
Assets, and requisitions at BOTH branches, and
StockRequisitionDecideView extends the same exception so he can
fulfill or reject a requisition from either branch too. A Store
Keeper account that DOES have a branch set (any other one, now or in
the future) stays fully restricted to just that branch, unaffected by
any of this.

This is a separate account from his existing/new Manager account
(paulogwuche@enayihotels.com, created by sync_rayfield_staff.py) —
one person, two logins, because a single account can only carry one
role. Deliberately not folded into that command since this one is
a one-off, not part of a branch roster sync.

SAFETY: defaults to a DRY RUN. Pass --apply to actually commit.

Usage (from backend root):
    python manage.py create_cross_branch_storekeeper            # dry run
    python manage.py create_cross_branch_storekeeper --apply    # for real
"""
from django.core.management.base import BaseCommand

from apps.accounts.models import User

EMAIL = "paulstore@enayihotels.com"
PASSWORD = "12345678@"
FIRST_NAME = "Paul"
LAST_NAME = "Ogwuche"
PHONE = "07037709778"


class Command(BaseCommand):
    help = "Create Paul Ogwuche's cross-branch Store Keeper account (no hotel set = sees/acts on both branches)."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Actually commit changes. Without this flag, dry-run only.")

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        mode = "APPLYING CHANGES" if apply_changes else "DRY RUN — no changes will be saved"
        self.stdout.write(self.style.WARNING(f"\n=== {mode} ===\n"))

        if User.objects.filter(email=EMAIL).exists():
            self.stdout.write(self.style.WARNING(f'Already exists: {EMAIL!r} — nothing to do.'))
            return

        phone_note = f", phone {PHONE}" if PHONE else " — NO PHONE NUMBER ON FILE YET"
        self.stdout.write(f'  + "{FIRST_NAME} {LAST_NAME}" <{EMAIL}> — Store Keeper, both branches (no hotel set){phone_note}')

        if apply_changes:
            User.objects.create_user(
                email=EMAIL, password=PASSWORD,
                first_name=FIRST_NAME, last_name=LAST_NAME,
                role=User.STORE_KEEPER, hotel=None, phone=PHONE,
                is_verified=True,
            )
            self.stdout.write(self.style.SUCCESS(f"\n=== Done. Starting password: {PASSWORD} ==="))
        else:
            self.stdout.write(self.style.WARNING(
                "\n=== DRY RUN complete — nothing was saved. Re-run with --apply to commit. ==="
            ))
