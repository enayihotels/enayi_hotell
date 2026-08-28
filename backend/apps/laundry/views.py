"""Enayi Hotels — Laundry Service Views"""
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import LaundryPriceItem, LaundryTicket, LaundryTicketItem
from .serializers import (
    LaundryPriceItemSerializer, LaundryTicketSerializer, LaundryTicketWriteSerializer,
)
from .email_utils import send_laundry_ready_email

from apps.accounts.models import User


def _can_manage_laundry(user):
    """Laundry Staff, Manager, Owner — same tier every other
    department's own-work views use. Guests are NOT in this set —
    they only ever get read access to the price list, never tickets."""
    return user.role in ["laundry_staff", "manager", "admin"]


def _can_manage_prices(user):
    """Only Manager/Owner can add or edit price catalog entries — same
    tier as who manages the room catalog or adds Property Assets.
    Laundry Staff reads prices when logging a ticket but doesn't edit
    the catalog."""
    return user.role in ["manager", "admin"]


def _effective_hotel(user, requested_hotel_id=None):
    """Same branch-scoping rule as everywhere else in this codebase —
    Owner sees every branch (optionally narrowed via ?hotel=), everyone
    else is locked to their own account's branch regardless of what's
    requested."""
    if user.role == "admin":
        return requested_hotel_id or None
    if user.requires_branch:
        return str(user.hotel_id) if user.hotel_id else False
    return None


class LaundryPriceItemListView(generics.ListCreateAPIView):
    """GET — anyone logged in (guest included) can see the active
    price list for their branch, or ?hotel= if they're Admin. POST —
    Manager/Owner only.

    Guests browsing this need SOME branch context to know whose prices
    they're looking at — same as the guest room-availability screen,
    this expects ?hotel=<branch> for guest accounts (who aren't
    themselves branch-scoped the way staff are); staff/Manager just
    see their own branch automatically.
    """
    serializer_class = LaundryPriceItemSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        requested = self.request.query_params.get("hotel")

        if user.role == "admin":
            effective = requested or None
        elif user.requires_branch:
            effective = str(user.hotel_id) if user.hotel_id else False
        else:
            # Guest — not branch-scoped by account, so a branch must be
            # requested explicitly to know whose price list to show.
            effective = requested or False

        if effective is False:
            return LaundryPriceItem.objects.none()

        qs = LaundryPriceItem.objects.filter(is_active=True)
        if effective:
            qs = qs.filter(hotel_id=effective)
        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        if not _can_manage_prices(user):
            return Response({"error": "Only a Manager or the Owner can add a laundry price."}, status=403)

        if user.role == "admin":
            hotel_id = request.data.get("hotel")
            if not hotel_id:
                return Response({"error": "hotel is required."}, status=400)
        else:
            if not user.hotel_id:
                return Response({"error": "Your account has no branch assigned yet — ask the Owner to set one before you can add laundry prices."}, status=403)
            hotel_id = user.hotel_id

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save(hotel_id=hotel_id)
        return Response(LaundryPriceItemSerializer(item).data, status=201)


class LaundryPriceItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    """PATCH/DELETE — Manager/Owner only, own branch (Admin: any)."""
    serializer_class = LaundryPriceItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = LaundryPriceItem.objects.all()
        if user.role != "admin" and user.hotel_id:
            qs = qs.filter(hotel_id=user.hotel_id)
        return qs

    def update(self, request, *args, **kwargs):
        if not _can_manage_prices(request.user):
            return Response({"error": "Only a Manager or the Owner can edit laundry prices."}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _can_manage_prices(request.user):
            return Response({"error": "Only a Manager or the Owner can remove a laundry price."}, status=403)
        return super().destroy(request, *args, **kwargs)


class LaundryTicketListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_serializer_class(self):
        return LaundryTicketWriteSerializer if self.request.method == "POST" else LaundryTicketSerializer

    def get_queryset(self):
        user = self.request.user
        if not _can_manage_laundry(user):
            return LaundryTicket.objects.none()

        effective = _effective_hotel(user, self.request.query_params.get("hotel"))
        if effective is False:
            return LaundryTicket.objects.none()

        qs = LaundryTicket.objects.select_related("room", "logged_by").prefetch_related("line_items")
        if effective:
            qs = qs.filter(hotel_id=effective)

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        if not _can_manage_laundry(user):
            return Response({"error": "Only Laundry Staff, a Manager, or the Owner can log a laundry ticket."}, status=403)

        if user.role == "admin":
            hotel_id = request.data.get("hotel")
            if not hotel_id:
                return Response({"error": "hotel is required."}, status=400)
        else:
            if not user.hotel_id:
                return Response({"error": "Your account has no branch assigned yet — ask the Owner to set one before you can log a laundry ticket."}, status=403)
            hotel_id = user.hotel_id

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items_data = serializer.validated_data.pop("items")

        # If Laundry Staff picked a real guest account, snapshot
        # name/email/phone FROM that account — never trust typed text
        # once a real account is linked, so what's shown always matches
        # who can actually pay for it. A mismatched or missing account
        # id is a hard error, not a silent fall-through to guest_name.
        guest_account_id = serializer.validated_data.pop("guest_account", None)
        guest_account = None
        if guest_account_id:
            try:
                guest_account = User.objects.get(id=guest_account_id, role=User.GUEST)
            except User.DoesNotExist:
                return Response({"error": "That guest account wasn't found."}, status=400)
            guest_name = guest_account.get_full_name() or guest_account.email
            guest_email = guest_account.email
            guest_phone = str(guest_account.phone) if guest_account.phone else ""
        else:
            guest_name = serializer.validated_data.get("guest_name", "")
            guest_email = serializer.validated_data.get("guest_email", "")
            guest_phone = serializer.validated_data.get("guest_phone", "")

        # Resolve every price_item against THIS branch's own catalog —
        # never trust a client-supplied name/price, and never let one
        # branch's ticket reference another branch's price item.
        price_items = {
            str(p.id): p for p in LaundryPriceItem.objects.filter(hotel_id=hotel_id, id__in=[i["price_item"] for i in items_data])
        }
        missing = [i["price_item"] for i in items_data if str(i["price_item"]) not in price_items]
        if missing:
            return Response({"error": f"These items aren't in this branch's price list: {missing}"}, status=400)

        with transaction.atomic():
            ticket = LaundryTicket.objects.create(
                hotel_id=hotel_id,
                room=serializer.validated_data.get("room"),
                guest_account=guest_account,
                guest_name=guest_name,
                guest_email=guest_email,
                guest_phone=guest_phone,
                notes=serializer.validated_data.get("notes", ""),
                logged_by=user,
            )
            total = 0
            for line in items_data:
                price_item = price_items[str(line["price_item"])]
                qty = int(line["quantity"])
                LaundryTicketItem.objects.create(
                    ticket=ticket, price_item=price_item,
                    item_name=price_item.name, unit_price=price_item.price, quantity=qty,
                )
                total += price_item.price * qty
            ticket.total_price = total
            ticket.save(update_fields=["total_price"])

        return Response(LaundryTicketSerializer(ticket).data, status=201)


class MyLaundryTicketsView(generics.ListAPIView):
    """GET /api/v1/laundry/my-tickets/
    A guest's own tickets — only ones a real account was matched to at
    creation time show up here (tickets logged with typed-only info and
    no matched account simply can't be seen or paid for in-app; staff
    would need to collect payment another way for those)."""
    serializer_class = LaundryTicketSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return (LaundryTicket.objects
                .filter(guest_account=self.request.user)
                .select_related("room")
                .prefetch_related("line_items")
                .order_by("-created_at"))


class LaundryReconciliationView(APIView):
    """GET /api/v1/laundry/reconciliation/?hotel=<id>&date_from=&date_to=
    Manager/Owner only — a per-staff breakdown of tickets logged, total
    value, and how much of that is actually paid vs still outstanding.
    Doesn't prove anything on its own (a guest simply hasn't paid yet
    is the normal case for a fresh ticket), but a staff member whose
    tickets sit unpaid at a consistently higher rate than everyone
    else's — over a real date range, not one day — is worth a closer
    look, since staff never handle the money themselves for in-app
    payments; the only way value goes missing is at intake, before a
    ticket is even logged accurately."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ["manager", "admin"]:
            return Response({"error": "Only a Manager or the Owner can view laundry reconciliation."}, status=403)

        effective = _effective_hotel(user, request.query_params.get("hotel"))
        if effective is False:
            return Response({"error": "Your account has no branch assigned yet."}, status=403)

        qs = LaundryTicket.objects.all()
        if effective:
            qs = qs.filter(hotel_id=effective)

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        from django.db.models import Sum, Count, Q

        overall = qs.aggregate(
            tickets=Count("id"),
            total_amount=Sum("total_price"),
            paid_amount=Sum("total_price", filter=Q(is_paid=True)),
            paid_count=Count("id", filter=Q(is_paid=True)),
            unpaid_count=Count("id", filter=Q(is_paid=False)),
        )
        overall["total_amount"] = overall["total_amount"] or 0
        overall["paid_amount"] = overall["paid_amount"] or 0
        overall["unpaid_amount"] = overall["total_amount"] - overall["paid_amount"]

        by_staff_rows = (
            qs.values("logged_by_id", "logged_by__first_name", "logged_by__last_name")
              .annotate(
                  tickets=Count("id"),
                  total_amount=Sum("total_price"),
                  paid_amount=Sum("total_price", filter=Q(is_paid=True)),
                  paid_count=Count("id", filter=Q(is_paid=True)),
                  unpaid_count=Count("id", filter=Q(is_paid=False)),
              )
        )

        by_staff = []
        for row in by_staff_rows:
            total = row["total_amount"] or 0
            paid = row["paid_amount"] or 0
            name = f"{row['logged_by__first_name'] or ''} {row['logged_by__last_name'] or ''}".strip() or "Unknown"
            by_staff.append({
                "logged_by_id": str(row["logged_by_id"]) if row["logged_by_id"] else None,
                "logged_by_name": name,
                "tickets": row["tickets"],
                "total_amount": total,
                "paid_amount": paid,
                "unpaid_amount": total - paid,
                "paid_count": row["paid_count"],
                "unpaid_count": row["unpaid_count"],
            })
        # Highest outstanding value first — that's what's actually worth reviewing.
        by_staff.sort(key=lambda r: r["unpaid_amount"], reverse=True)

        return Response({"overall": overall, "by_staff": by_staff})


class MarkLaundryReadyView(APIView):
    """POST /api/v1/laundry/tickets/<id>/mark-ready/
    Sets the ticket to Ready and emails the guest if an address is on
    file. No wash/iron stage tracking in between — a load is either
    still in progress or it's ready, and this is the moment it becomes
    ready.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if not _can_manage_laundry(user):
            return Response({"error": "Only Laundry Staff, a Manager, or the Owner can mark a ticket ready."}, status=403)

        try:
            ticket = LaundryTicket.objects.select_related("room", "hotel").get(id=pk)
        except LaundryTicket.DoesNotExist:
            return Response({"error": "Ticket not found."}, status=404)

        if user.role != "admin" and user.hotel_id and str(ticket.hotel_id) != str(user.hotel_id):
            return Response({"error": "That ticket belongs to a different branch than your account."}, status=403)

        if ticket.status == LaundryTicket.READY:
            return Response({"error": "This ticket is already marked ready."}, status=400)

        ticket.status = LaundryTicket.READY
        ticket.ready_at = timezone.now()
        ticket.ready_marked_by = user
        sent = send_laundry_ready_email(ticket)
        ticket.notified = sent
        ticket.save(update_fields=["status", "ready_at", "ready_marked_by", "notified"])

        return Response({
            **LaundryTicketSerializer(ticket).data,
            "email_sent": sent,
        })
