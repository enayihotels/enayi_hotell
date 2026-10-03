# Rayfield staff, Zarmaganda room rates, and Paul Ogwuche's two accounts

Three things in this delivery, from the uploaded roster/rate document.

## 1. Zarmaganda room rates

Checked the document against what's actually live first. **Only one
real change exists** — five of the six rates already match exactly:

| Rate sheet name | Maps to | Document rate | Already live? |
|---|---|---|---|
| Single | Single | ₦25,000 (+₦2,500 bfast) | ✅ matches |
| Standard | Standard | ₦30,000 (+₦2,500) | ✅ matches |
| Classic | Classic | ₦35,000 (+₦2,500) | ✅ matches |
| Classic Plus | Class Plus | ₦40,000 (+₦2,500) | ✅ matches |
| Ex Suites | Suites | ₦55,000 (+₦2,500) | ✅ matches |
| Executive Deluxe | **VIP** | ₦45,000 (+₦2,500) | ❌ no price set at all |

Per your confirmation, "Executive Deluxe" = the existing VIP category,
and "Ex Suites" = the existing Suites category — no new categories
created. `sync_zarmaganda_room_rates.py` sets all 6 explicitly anyway
(re-running it later is a safe no-op for the five already correct),
so it's a reusable tool for the next rate sheet too, not a one-off
patch.

## 2. Rayfield staff

Your 12 current non-Admin accounts get replaced with the real 8-person
roster from the document, plus Paul Ogwuche as Manager (named by you,
not on the department sheet). Same safety net as the Zarmaganda sync —
an account with real Order/Booking history tied to it is skipped, not
force-deleted.

| Name | Role | Email | Phone |
|---|---|---|---|
| Mary Dung | Front Desk | marydung@enayihotels.com | 08131300678 |
| Malia Yakubu | Front Desk | maliayakubu@enayihotels.com | 08147668061 |
| Gwon Ibrahim | Bar Staff | gwonibrahim@enayihotels.com | 07035535973 |
| Angel Arin | Bar Staff | angelarin@enayihotels.com | 07087000271 |
| Rose-B. Ramnap | Kitchen Staff | roseramnap@enayihotels.com | 08101120669 |
| Mafeng Musa | Kitchen Staff | mafengmusa@enayihotels.com | 09138343203 |
| Annesthesia Anthony | Housekeeper | annesthesiaanthony@enayihotels.com | 09167300969 |
| Magaji Esther | Housekeeper | magajiesther@enayihotels.com | 08162371917 |
| Paul Ogwuche | **Manager** | paulogwuche@enayihotels.com | — |

Same starting password as before: `12345678@`.

## 3. Paul Ogwuche's Store Keeper account (both branches)

This was the real work in this delivery. **Nothing in the system
previously let one staff account see both branches at once** — every
role check treated "no branch set" as "blocked everywhere," not "sees
everything." Admin bypasses this by being branch-independent, but
there was no equivalent for a genuinely cross-branch Store Keeper.

### What changed (backend)
- **`inventory_views.py`** → `apps/inventory/views.py`:
  - `_effective_hotel` — a Store Keeper with no `hotel` set on their
    account is now treated like Admin (sees/filters across both
    branches). A Store Keeper who DOES have a branch assigned is
    completely unaffected — stays exactly as restricted as before.
  - New shared `_resolve_write_hotel` helper, replacing three
    near-duplicated blocks (category creation, item creation, stock
    adjustment) that previously only had an Admin exception — now Paul
    can create/adjust stock for either branch by passing which one
    explicitly, same as Admin already could.
  - `StockRequisitionDecideView` — same exception added so Paul can
    fulfill or reject a requisition from either branch, not just one.
- **`assets_views.py`** → `apps/assets/views.py`: same `_effective_hotel`
  fix (it's a separate, duplicated copy of the function in this app) so
  Property Assets are visible across both branches too. Creating new
  assets is Manager/Admin-only already, so nothing needed there.

### What changed (frontend)
- **`AdminInventory.tsx`** → `frontend/src/pages/admin/AdminInventory.tsx`:
  the branch-picker that previously only showed for Admin now also
  shows for a cross-branch Store Keeper, and a warning that would have
  incorrectly told Paul "no branch assigned, ask the Owner" no longer
  fires for his account specifically.

### New account
**`create_cross_branch_storekeeper.py`** creates `paulstore@enayihotels.com`
with no `hotel` set — that's what actually makes it cross-branch, not
a separate flag. **I don't have Paul's phone number yet** — the command
has a `PHONE = None` placeholder near the top; either fill it in before
running, or leave it and add the number later from Staff Duty/Admin.

This is a **separate account** from his Manager one above — one person,
two logins, because an account can only hold one role. Log in as
Manager at `paulogwuche@enayihotels.com`, as Store Keeper (both
branches) at `paulstore@enayihotels.com`.

## Install

1. Copy `sync_rayfield_staff.py` → `apps/accounts/management/commands/sync_rayfield_staff.py`
2. Copy `sync_zarmaganda_room_rates.py` → `apps/rooms/management/commands/sync_zarmaganda_room_rates.py`
3. Copy `create_cross_branch_storekeeper.py` → `apps/accounts/management/commands/create_cross_branch_storekeeper.py`
4. Copy `inventory_views.py` → `apps/inventory/views.py`
5. Copy `assets_views.py` → `apps/assets/views.py`
6. Copy `AdminInventory.tsx` → `frontend/src/pages/admin/AdminInventory.tsx`

No migration needed — nothing here touches the database schema, only
how existing fields are interpreted.

## Deploy

```powershell
git add backend/apps/accounts/management/commands/sync_rayfield_staff.py backend/apps/rooms/management/commands/sync_zarmaganda_room_rates.py backend/apps/accounts/management/commands/create_cross_branch_storekeeper.py backend/apps/inventory/views.py backend/apps/assets/views.py frontend/src/pages/admin/AdminInventory.tsx backend/README_rayfield_staff_and_rates.md
git commit -m "Rayfield staff roster, Zarmaganda VIP room rate, and cross-branch Store Keeper support"
git push origin main
```

Render auto-deploys both services on push — no manual migration step.

## Run (in the Render Shell tab, backend service)

Dry run each one first and read the output before applying:

```bash
python manage.py sync_zarmaganda_room_rates
python manage.py sync_zarmaganda_room_rates --apply

python manage.py sync_rayfield_staff
python manage.py sync_rayfield_staff --apply

python manage.py create_cross_branch_storekeeper
python manage.py create_cross_branch_storekeeper --apply
```

## Test

1. **Room rate:** check the public site's room rates page for Zarmaganda
   — VIP should now show ₦45,000 (₦47,500 with breakfast).
2. **Rayfield staff:** log in as one of the 8 (e.g.
   `marydung@enayihotels.com` / `12345678@`) — confirm it works and
   lands on the right dashboard for their role.
3. **Paul as Manager:** log in at `paulogwuche@enayihotels.com` —
   confirm he only sees Rayfield (managers stay single-branch).
4. **Paul as Store Keeper:** log in at `paulstore@enayihotels.com` —
   confirm:
   - A "Viewing branch" picker appears (same as Admin gets), letting
     him switch between Rayfield and Zarmaganda.
   - Switching branches shows that branch's actual stock/categories.
   - Under Requests, he can see AND fulfill/reject pending requisitions
     from **both** branches, not just one.
   - No red "no branch assigned" warning shows anywhere for his account.
5. Log in as an **existing regular Store Keeper** (branch-assigned, if
   you still have one) and confirm nothing changed for them — no
   branch picker, still locked to their own branch exactly as before.
