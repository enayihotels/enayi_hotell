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
        ("other",      "Other"),
    ]
    STATUS_CHOICES = [
        ("working",     "Working"),
        ("broken",      "Broken"),
        ("under_repair","Under Repair"),
        ("decommissioned", "Decommissioned"),
    ]

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name           = models.CharField(max_length=150, help_text="e.g. 'Split AC Unit', 'Wall Socket (near bed)', 'Bathroom Tap'")
    category       = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="other")
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
        return f"{self.name} — {where}"


class AssetIssueReport(models.Model):
    REPORTED    = "reported"
    IN_PROGRESS = "in_progress"
    FIXED       = "fixed"
    STATUS_CHOICES = [
        (REPORTED,    "Reported"),
        (IN_PROGRESS, "In Progress"),
        (FIXED,       "Fixed"),
    ]

    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset             = models.ForeignKey(PropertyAsset, on_delete=models.CASCADE, related_name="issue_reports")
    issue_description = models.TextField()
    status            = models.CharField(max_length=20, choices=STATUS_CHOICES, default=REPORTED)

    reported_by       = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, related_name="asset_issues_reported")
    reported_at       = models.DateTimeField(auto_now_add=True)

    fixed_by          = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="asset_issues_fixed")
    fixed_at          = models.DateTimeField(null=True, blank=True)
    fix_notes         = models.TextField(blank=True)

    class Meta:
        db_table = "asset_issue_reports"
        ordering = ["-reported_at"]

    def __str__(self):
        return f"{self.asset.name}: {self.issue_description[:50]} ({self.status})"
