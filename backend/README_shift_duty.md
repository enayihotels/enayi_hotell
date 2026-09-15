# Shift-based login for Front Desk, Bar Staff, Kitchen Staff, Housekeeper

## Important: most of this already existed

While building this, I found the backend was already substantially
built — `User.is_on_duty`, the self-attestation login prompt, the
mid-session kill-switch (`ShiftAwareJWTAuthentication`), the
token-refresh loophole closed, and a `ToggleDutyView` endpoint with
correct branch scoping. None of that is in this delivery's diffs in a
way that changes it — it was already live.

**What was actually missing** (this delivery):
1. The "Request Access" flow you described — nothing existed for it at
   all.
2. Any admin UI to actually use the toggle — the endpoint existed but
   there was no page anywhere to reach it from.
3. The off-duty login attempt showed a generic error toast instead of
   a dedicated blocked screen.

## What's in this delivery

### Backend
- **`accounts_models.py`** — new `AccessRequest` model (a shift-role
  staff member's request to be switched back on duty).
- **`0007_accessrequest.py`** — migration for it.
- **`accounts_serializers.py`** — `AccessRequestSerializer`.
- **`accounts_views.py`** — three new views:
  - `RequestAccessView` (public) — staff hits this from the blocked
    login screen. Emails their branch's Manager(s) + all Admins (reuses
    your existing email setup, not a new channel). Deliberately
    non-committal in its response either way, same reasoning as the
    login error never saying whether it was the email or password.
  - `AccessRequestListView` — Manager sees their branch's requests,
    Admin sees all.
  - `DecideAccessRequestView` — Approve switches the person back on
    duty in the same step; Deny just marks it denied.
  - Also added a `code: "off_duty"` field to the existing off-duty
    login error, so the frontend can detect it reliably instead of
    string-matching the message.
- **`accounts_urls.py`** — registers the three new endpoints.

### Frontend
- **`LoginPage.tsx`** — an off-duty login attempt now shows a proper
  blocked screen (not a toast) explaining what happened, with a
  "Request Access" button.
- **`AdminStaffDuty.tsx`** (new page, `/admin/staff-duty`) — two tabs:
  - **Staff** — every shift-role account, with an On/Off Duty toggle
    per person (Manager sees only their branch, Admin sees all —
    enforced server-side either way).
  - **Access Requests** — pending requests with Approve/Deny, plus a
    short history of recently decided ones.
- **`AdminLayout.tsx`** — new "Staff Duty" nav item, Manager/Admin only
  (Front Desk doesn't see it, same as other manager-only pages).
- **`App.tsx`** — registers the new route.
- **`types_duty.ts`** — added `AccessRequest` type, filled in missing
  fields on `User` (`hotel`, `is_shift_role`, `is_on_duty`, etc. — the
  backend was already sending these, the frontend type just didn't
  know about them), and fixed `UserRole` to include all the actual
  roles (`store_keeper`, `bar_staff`, `kitchen_staff`, `housekeeper`,
  `laundry_staff` were missing from the type entirely).

## Install

1. Copy `accounts_models.py` → `apps/accounts/models.py`
2. Copy `0007_accessrequest.py` → `apps/accounts/migrations/0007_accessrequest.py`
3. Copy `accounts_serializers.py` → `apps/accounts/serializers.py`
4. Copy `accounts_views.py` → `apps/accounts/views.py`
5. Copy `accounts_urls.py` → `apps/accounts/urls.py`
6. Copy `LoginPage.tsx` → `frontend/src/pages/auth/LoginPage.tsx`
7. Copy `AdminStaffDuty.tsx` → `frontend/src/pages/admin/AdminStaffDuty.tsx`
8. Copy `AdminLayout.tsx` → `frontend/src/components/layout/AdminLayout.tsx`
9. Copy `App.tsx` → `frontend/src/App.tsx`
10. Copy `types_duty.ts` → `frontend/src/types/index.ts`

## Test — migration needed this time

Run in the Render Shell tab (not local):
```bash
python manage.py migrate accounts
```

Then:
1. Log in as Manager or Admin → **Staff Duty** in the sidebar.
2. Switch a Front Desk/Bar/Kitchen/Housekeeper account **Off Duty**.
3. Try logging in as that account — should show the blocked screen, not
   a plain error toast.
4. Click **Request Access** on that screen — check the Manager's/Admin's
   email for the notification.
5. Back in Staff Duty → **Access Requests** tab → **Approve** it.
6. Log in as that account again — should work normally (still gets the
   "Are you on duty?" prompt, since that's separate and always happens
   for shift roles).
7. If that account already had an active session open in another tab
   when you switched them off in step 2, confirm their *next click*
   there fails too — not just a fresh login attempt.
