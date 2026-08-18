"""Enayi Hotels — Property & Asset Maintenance Tracking (Phase 4)

Every piece of hotel equipment or fixture — AC units, TVs, fans, wall
sockets, taps, and so on — gets a record here. Room-tied assets link to
a specific Room; common-area assets (a lobby AC, a corridor light) use
`location_note` instead and leave `room` blank.

When something breaks, it's marked broken and stays that way — visibly,
persistently — until someone actually fixes it and closes it out. This
is deliberately NOT just a boolean toggle: AssetIssueReport keeps a full
timeline of who reported what, when, and who resolved it, since "was
this ever actually fixed, or did someone just flip a switch" is exactly
the kind of accountability question this whole system exists to answer
for everything else (payments, checkouts, stock).
"""
import uuid
from django.db import models


class PropertyAsset(models.Model):
    CATEGORY_CHOICES = [
        ("appliance",  "Appliance (AC, TV, Fridge...)"),
        ("electrical", "Electrical (Socket, Switch, Wiring...)"),
        ("plumbing",   "Plumbing (Tap, Shower, Toilet...)"),
        ("furniture",  "Furniture"),
        ("fixture",    "Fixture (Light, Fan, Door, Window...)"),
        ("linen",      "Linen / Soft Furnishing (Pillow, Duvet, Curtain...)"),
        ("other",      "Other"),
    ]
    STATUS_CHOICES = [
        ("working",     "Working"),
        ("broken",      "Broken"),
        ("under_repair","Under Repair"),
        ("decommissioned", "Decommissioned"),
    ]
    # Who this asset "belongs to" for day-to-day tracking — separate
    # from `category`, which is what KIND of thing it is. A room TV and
    # a lobby TV are both category='appliance', but the room one is
    # department='housekeeping' (hers to notice/report) while a common
    # area like the lobby is 'shared' (visible centrally, not tied to
    # one department's day-to-day view). Mirrors
    # InventoryCategory.DEPARTMENT_CHOICES in spirit, not literally
    # shared code, since asset "departments" and inventory
    # "departments" are conceptually the same idea but different models.
    FRONTDESK    = "frontdesk"
    KITCHEN      = "kitchen"
    BAR          = "bar"
    HOUSEKEEPING = "housekeeping"
    SHARED       = "shared"
    DEPARTMENT_CHOICES = [
        (FRONTDESK,    "Front Desk"),
        (KITCHEN,      "Kitchen"),
        (BAR,          "Bar"),
        (HOUSEKEEPING, "Housekeeping (incl. all guest rooms)"),
        (SHARED,       "Shared / Common Area — visible centrally only"),
    ]

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel          = models.ForeignKey("hotels.Hotel", on_delete=models.CASCADE, related_name="property_assets", null=True, blank=True,
                                        help_text="Which branch this asset belongs to. Added after the model already had "
                                                  "real rows in some deployments, so this stays nullable rather than "
                                                  "forcing a guess for any asset an old record can't be traced back to "
                                                  "a branch for — same reasoning as StockBalance.hotel/StockRequisition.hotel.")
    name           = models.CharField(max_length=150, help_text="e.g. 'Split AC Unit', 'Wall Socket (near bed)', 'Bathroom Tap', 'Pillow'")
    category       = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="other")
    department     = models.CharField(max_length=15, choices=DEPARTMENT_CHOICES, default=SHARED,
                                       help_text="Whose day-to-day view this shows up in. Room-tied assets are almost "
                                                 "always 'housekeeping' — she's the one who notices/reports damage "
                                                 "during cleaning. Front Desk/Manager/Owner always see everything "
                                                 "regardless of this tag (the central, unrestricted view).")
    quantity       = models.PositiveIntegerField(default=1, help_text="How many of this exact item are at this "
                                                  "location — e.g. 4 for 'Pillow' in a room, 1 for 'Split AC Unit'. "
                                                  "Tracked as one line with a count, not one row per physical unit.")
    room           = models.ForeignKey("rooms.Room", on_delete=models.CASCADE, null=True, blank=True, related_name="assets",
                                        help_text="Leave blank for a common-area asset (lobby, corridor, restaurant, etc.) and use Location note instead.")
    location_note  = models.CharField(max_length=150, blank=True, help_text="For common-area assets only, e.g. 'Main Lobby', '2nd Floor Corridor'.")
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default="working", db_index=True)
    serial_number  = models.CharField(max_length=100, blank=True)
    notes          = models.TextField(blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "property_assets"
        ordering = ["room__room_number", "location_note", "name"]

    def __str__(self):
        where = f"Room {self.room.room_number}" if self.room_id else (self.location_note or "Common area")
        qty = f"{self.quantity}x " if self.quantity != 1 else ""
        return f"{qty}{self.name} — {where}"


class AssetIssueReport(models.Model):
    REPORTED           = "reported"
    CLEARED_FOR_REPAIR = "cleared_for_repair"
    REJECTED           = "rejected"
    FIXED              = "fixed"
    STATUS_CHOICES = [
        (REPORTED,           "Reported"),
        (CLEARED_FOR_REPAIR, "Cleared for Repair"),
        (REJECTED,           "Rejected"),
        (FIXED,              "Fixed"),
    ]

    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset             = models.ForeignKey(PropertyAsset, on_delete=models.CASCADE, related_name="issue_reports")
    issue_description = models.TextField()
    status            = models.CharField(max_length=20, choices=STATUS_CHOICES, default=REPORTED)

    reported_by       = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, related_name="asset_issues_reported")
    reported_at       = models.DateTimeField(auto_now_add=True)

    # The approval gate Adrian asked for: a damaged item reported by
    # any staff member has to be reviewed and CLEARED by a Manager or
    # the Owner before repair work is considered authorized — mirrors
    # the same "two-person accountability" pattern already used for
    # StockRequisition (requested_by vs decided_by). Reporting and
    # clearing are deliberately different people/steps, not one round
    # trip — that's the whole point of the gate.
    cleared_by        = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="asset_issues_cleared")
    cleared_at        = models.DateTimeField(null=True, blank=True)
    clearance_note    = models.CharField(max_length=255, blank=True, help_text="Why this was cleared for repair, or why it was rejected.")

    fixed_by          = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="asset_issues_fixed")
    fixed_at          = models.DateTimeField(null=True, blank=True)
    fix_notes         = models.TextField(blank=True)

    class Meta:
        db_table = "asset_issue_reports"
        ordering = ["-reported_at"]

    def __str__(self):
        return f"{self.asset.name}: {self.issue_description[:50]} ({self.status})"
