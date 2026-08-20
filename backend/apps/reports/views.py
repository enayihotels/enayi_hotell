"""
Enayi Hotels — PDF Receipt & Daily Sales Report Generator
Uses ReportLab (already in requirements.txt) — no new dependencies.

Endpoints:
  GET /api/v1/reports/receipt/booking/<booking_id>/   → booking receipt PDF
  GET /api/v1/reports/receipt/order/<order_id>/       → food/drinks receipt PDF
  GET /api/v1/reports/daily/?date=YYYY-MM-DD&hotel=<id>  → daily sales report PDF (Manager/Owner only)
"""
import io
from datetime import date, datetime
from decimal import Decimal

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from reportlab.lib                  import colors
from reportlab.lib.pagesizes        import A4
from reportlab.lib.styles           import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units            import cm, mm
from reportlab.lib.enums            import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.platypus             import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)

# ── Brand colours ──────────────────────────────────────────────────────────
GOLD    = colors.HexColor("#C9A227")
DARK    = colors.HexColor("#0A0F1E")
PANEL   = colors.HexColor("#111827")
MUTED   = colors.HexColor("#8899AA")
WHITE   = colors.white
GREEN   = colors.HexColor("#38A169")
RED     = colors.HexColor("#E53E3E")


def _fmt_money(val) -> str:
    try:
        return f"\u20A6{Decimal(str(val)):,.2f}"
    except Exception:
        return str(val)


def _fmt_date(d) -> str:
    if d is None:
        return "—"
    if isinstance(d, (datetime,)):
        return d.strftime("%d %b %Y, %I:%M %p")
    return d.strftime("%d %b %Y") if hasattr(d, "strftime") else str(d)


# ═══════════════════════════════════════════════════════════════════════════
#  SHARED: document header (logo text + hotel info)
# ═══════════════════════════════════════════════════════════════════════════
def _build_doc(buffer, title="Receipt"):
    return SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.8*cm,
        leftMargin=1.8*cm,
        topMargin=1.8*cm,
        bottomMargin=1.8*cm,
        title=title,
        author="Enayi Hotels & Suites",
    )


def _styles():
    base = getSampleStyleSheet()
    return {
        "hotel_name": ParagraphStyle("hotel_name", fontSize=22, textColor=GOLD, fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=2),
        "hotel_sub":  ParagraphStyle("hotel_sub",  fontSize=9,  textColor=MUTED, fontName="Helvetica", alignment=TA_CENTER, spaceAfter=2),
        "doc_title":  ParagraphStyle("doc_title",  fontSize=16, textColor=DARK,  fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=6, spaceBefore=8),
        "label":      ParagraphStyle("label",      fontSize=8,  textColor=MUTED, fontName="Helvetica"),
        "value":      ParagraphStyle("value",      fontSize=10, textColor=DARK,  fontName="Helvetica-Bold"),
        "body":       ParagraphStyle("body",       fontSize=9,  textColor=DARK,  fontName="Helvetica"),
        "small":      ParagraphStyle("small",      fontSize=8,  textColor=MUTED, fontName="Helvetica"),
        "section":    ParagraphStyle("section",    fontSize=11, textColor=DARK,  fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=4),
        "total":      ParagraphStyle("total",      fontSize=13, textColor=DARK,  fontName="Helvetica-Bold", alignment=TA_RIGHT),
        "footer":     ParagraphStyle("footer",     fontSize=8,  textColor=MUTED, fontName="Helvetica", alignment=TA_CENTER),
        "right":      ParagraphStyle("right",      fontSize=9,  textColor=DARK,  fontName="Helvetica", alignment=TA_RIGHT),
        "rpt_title":  ParagraphStyle("rpt_title",  fontSize=20, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=4),
        "rpt_sub":    ParagraphStyle("rpt_sub",    fontSize=10, textColor=GOLD,  fontName="Helvetica", alignment=TA_CENTER),
        "th":         ParagraphStyle("th",         fontSize=9,  textColor=WHITE, fontName="Helvetica-Bold"),
        "td":         ParagraphStyle("td",         fontSize=8.5, textColor=DARK, fontName="Helvetica"),
        "td_r":       ParagraphStyle("td_r",       fontSize=8.5, textColor=DARK, fontName="Helvetica", alignment=TA_RIGHT),
        "sum_label":  ParagraphStyle("sum_label",  fontSize=10, textColor=MUTED, fontName="Helvetica"),
        "sum_value":  ParagraphStyle("sum_value",  fontSize=10, textColor=DARK,  fontName="Helvetica-Bold", alignment=TA_RIGHT),
    }


def _header_block(s, branch_name="Enayi Hotels & Suites", doc_type="RECEIPT"):
    return [
        Paragraph("ENAYI HOTELS & SUITES", s["hotel_name"]),
        Paragraph(f"{branch_name}", s["hotel_sub"]),
        Paragraph("Rayfield Zarmaganda Road, Jos, Plateau State, Nigeria", s["hotel_sub"]),
        Paragraph("+234 (0) 913 894 3008  |  info@enayihotels.com", s["hotel_sub"]),
        Spacer(1, 4*mm),
        HRFlowable(width="100%", thickness=2, color=GOLD, spaceAfter=4),
        Paragraph(doc_type, s["doc_title"]),
        HRFlowable(width="100%", thickness=0.5, color=MUTED, spaceAfter=6),
    ]


def _footer_block(s, message="Thank you for choosing Enayi Hotels & Suites."):
    return [
        Spacer(1, 8*mm),
        HRFlowable(width="100%", thickness=0.5, color=MUTED, spaceAfter=4),
        Paragraph(message, s["footer"]),
        Paragraph("This document was generated automatically by Enayi Hotel Management System.", s["footer"]),
        Paragraph(f"Printed: {datetime.now().strftime('%d %b %Y %I:%M %p')}", s["footer"]),
    ]


def _kv_table(rows, s):
    """Two-column key-value table for receipt fields."""
    data = [[Paragraph(k, s["label"]), Paragraph(v, s["value"])] for k, v in rows]
    t = Table(data, colWidths=[5*cm, 10*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#F8F9FA")),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.HexColor("#F8F9FA"), WHITE]),
        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#DDDDDD")),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ]))
    return t


# ═══════════════════════════════════════════════════════════════════════════
#  BOOKING RECEIPT
# ═══════════════════════════════════════════════════════════════════════════
def _generate_booking_receipt(booking) -> bytes:
    buffer = io.BytesIO()
    doc    = _build_doc(buffer, f"Booking Receipt — {booking.booking_reference}")
    s      = _styles()
    story  = []

    branch = booking.hotel.name if booking.hotel_id else "Enayi Hotels & Suites"
    story += _header_block(s, branch, "BOOKING RECEIPT")

    # Status badge
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("GUEST INFORMATION", s["section"]))
    story.append(_kv_table([
        ("Full Name",         f"{booking.guest.get_full_name() or booking.guest.email}"),
        ("Email",             booking.guest.email),
        ("Booking Reference", booking.booking_reference),
        ("Booking Date",      _fmt_date(booking.created_at)),
        ("Source",            booking.get_source_display()),
        ("Status",            booking.get_status_display()),
    ], s))

    # Stay details
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("STAY DETAILS", s["section"]))
    story.append(_kv_table([
        ("Branch",            branch),
        ("Room Number",       f"Room {booking.room.room_number}"),
        ("Room Type",         booking.room.category.name if hasattr(booking.room, 'category') and booking.room.category else "—"),
        ("Check-In Date",     _fmt_date(booking.check_in)),
        ("Check-Out Date",    _fmt_date(booking.check_out)),
        ("Total Nights",      str(booking.total_nights)),
        ("Guests",            f"{booking.adults} adult(s), {booking.children} child(ren)"),
        ("Breakfast",         "Included" if booking.breakfast_included else "Not included"),
    ], s))

    # Charges
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("CHARGES", s["section"]))
    charge_data = [
        [Paragraph("Description", s["th"]), Paragraph("Amount", ParagraphStyle("th_r", fontSize=9, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_RIGHT))],
        [Paragraph(f"Room rate \xd7 {booking.total_nights} night(s)", s["td"]), Paragraph(_fmt_money(booking.subtotal), s["td_r"])],
    ]
    if booking.discount_amount:
        charge_data.append([Paragraph("Discount", s["td"]), Paragraph(f"- {_fmt_money(booking.discount_amount)}", s["td_r"])])
    if booking.tax_amount:
        charge_data.append([Paragraph("Tax (7.5%)", s["td"]), Paragraph(_fmt_money(booking.tax_amount), s["td_r"])])
    charge_data.append([
        Paragraph("TOTAL", ParagraphStyle("tb", fontSize=10, fontName="Helvetica-Bold")),
        Paragraph(_fmt_money(booking.total_amount), ParagraphStyle("tb_r", fontSize=10, fontName="Helvetica-Bold", alignment=TA_RIGHT, textColor=GOLD)),
    ])
    charge_data.append([Paragraph("Amount Paid", s["td"]),  Paragraph(_fmt_money(booking.amount_paid), s["td_r"])])
    charge_data.append([
        Paragraph("Balance Due", ParagraphStyle("bal", fontSize=9, fontName="Helvetica-Bold", textColor=RED if booking.balance_due > 0 else GREEN)),
        Paragraph(_fmt_money(booking.balance_due), ParagraphStyle("bal_r", fontSize=9, fontName="Helvetica-Bold", alignment=TA_RIGHT, textColor=RED if booking.balance_due > 0 else GREEN)),
    ])

    ct = Table(charge_data, colWidths=[12*cm, 4*cm])
    ct.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), DARK),
        ("ROWBACKGROUNDS", (0,1), (-1,-4), [WHITE, colors.HexColor("#F8F9FA")]),
        ("BACKGROUND", (0,-3), (-1,-3), colors.HexColor("#F0F0F0")),
        ("LINEBELOW", (0,-3), (-1,-3), 1, GOLD),
        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#DDDDDD")),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(ct)

    # Payments — Payment model uses GenericFK (payable), query via ContentType
    try:
        from django.contrib.contenttypes.models import ContentType
        from apps.payments.models import Payment as PaymentModel
        ct_type = ContentType.objects.get_for_model(booking.__class__)
        payments = PaymentModel.objects.filter(
            content_type=ct_type,
            object_id=booking.id,
            status="success",
        ).order_by("created_at")
        if payments.exists():
            story.append(Spacer(1, 4*mm))
            story.append(Paragraph("PAYMENT HISTORY", s["section"]))
            ph_data = [[Paragraph(h, s["th"]) for h in ["Date", "Method", "Reference", "Amount"]]]
            for p in payments:
                ph_data.append([
                    Paragraph(_fmt_date(p.created_at), s["td"]),
                    Paragraph(p.get_method_display(), s["td"]),
                    Paragraph(p.transaction_reference or "—", s["td"]),
                    Paragraph(_fmt_money(p.amount), s["td_r"]),
                ])
            pt = Table(ph_data, colWidths=[3.5*cm, 3*cm, 5*cm, 3.5*cm])
            pt.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), DARK),
                ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, colors.HexColor("#F8F9FA")]),
                ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#DDDDDD")),
                ("TOPPADDING", (0,0), (-1,-1), 5),
                ("BOTTOMPADDING", (0,0), (-1,-1), 5),
                ("LEFTPADDING", (0,0), (-1,-1), 6),
            ]))
            story.append(pt)
    except Exception as e:
        # Payment history is best-effort — don't crash the receipt if it fails
        import logging
        logging.getLogger("apps.reports").warning(f"Could not load payment history for booking {booking.id}: {e}")

    story += _footer_block(s, "Thank you for your stay. We hope to welcome you again!")
    doc.build(story)
    return buffer.getvalue()


# ═══════════════════════════════════════════════════════════════════════════
#  ORDER RECEIPT (Food & Drinks)
# ═══════════════════════════════════════════════════════════════════════════
def _generate_order_receipt(order) -> bytes:
    buffer = io.BytesIO()
    doc    = _build_doc(buffer, f"Order Receipt — {order.order_number}")
    s      = _styles()
    story  = []

    branch = order.hotel.name if order.hotel_id else "Enayi Hotels & Suites"
    story += _header_block(s, branch, "FOOD & DRINKS RECEIPT")

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("ORDER DETAILS", s["section"]))
    story.append(_kv_table([
        ("Order Number",  order.order_number),
        ("Guest",         order.guest.get_full_name() or order.guest.email),
        ("Room",          f"Room {order.room.room_number}" if order.room_id else "—"),
        ("Order Type",    order.get_source_display()),
        ("Order Date",    _fmt_date(order.created_at)),
        ("Status",        order.get_status_display()),
        ("Payment",       "Paid" if order.is_paid else "Pending"),
    ], s))

    # Items table
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("ITEMS ORDERED", s["section"]))
    item_data = [[Paragraph(h, s["th"]) for h in ["Item", "Qty", "Unit Price", "Total"]]]
    for item in order.items.select_related("menu_item").all():
        item_data.append([
            Paragraph(item.menu_item.name, s["td"]),
            Paragraph(str(item.quantity), s["td"]),
            Paragraph(_fmt_money(item.unit_price), s["td_r"]),
            Paragraph(_fmt_money(item.total_price), s["td_r"]),
        ])
    it = Table(item_data, colWidths=[8*cm, 2*cm, 3.5*cm, 3.5*cm])
    it.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), DARK),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, colors.HexColor("#F8F9FA")]),
        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#DDDDDD")),
        ("ALIGN", (1,0), (-1,-1), "RIGHT"),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(it)

    # Totals
    story.append(Spacer(1, 4*mm))
    totals = [
        ("Subtotal",        _fmt_money(order.subtotal)),
        ("Delivery Charge", _fmt_money(order.delivery_charge)),
        ("Tax (7.5%)",      _fmt_money(order.tax)),
        ("TOTAL",           _fmt_money(order.total_amount)),
    ]
    tt_data = [[Paragraph(k, ParagraphStyle("tl", fontSize=9 if k!="TOTAL" else 12, fontName="Helvetica-Bold" if k=="TOTAL" else "Helvetica", textColor=MUTED if k!="TOTAL" else DARK, alignment=TA_RIGHT)),
                Paragraph(v, ParagraphStyle("tv", fontSize=9 if k!="TOTAL" else 12, fontName="Helvetica-Bold" if k=="TOTAL" else "Helvetica", textColor=GOLD if k=="TOTAL" else DARK, alignment=TA_RIGHT))]
               for k, v in totals]
    tt = Table(tt_data, colWidths=[12*cm, 4*cm])
    tt.setStyle(TableStyle([
        ("LINEABOVE", (0,-1), (-1,-1), 1, GOLD),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(tt)

    if order.special_instructions:
        story.append(Spacer(1, 4*mm))
        story.append(Paragraph("SPECIAL INSTRUCTIONS", s["section"]))
        story.append(Paragraph(order.special_instructions, s["body"]))

    story += _footer_block(s, "Thank you for your order. Enjoy your meal!")
    doc.build(story)
    return buffer.getvalue()


# ═══════════════════════════════════════════════════════════════════════════
#  DAILY SALES REPORT
# ═══════════════════════════════════════════════════════════════════════════
def _generate_daily_report(report_date, hotel=None) -> bytes:
    from apps.bookings.models import Booking
    from apps.orders.models   import Order
    from django.db.models     import Sum, Count, Q
    from django.contrib.contenttypes.models import ContentType
    from apps.payments.models import Payment as PaymentModel
    from apps.bookings.models import Booking as BookingModel
    from apps.orders.models   import Order    as OrderModel
    import django.db.models as models

    buffer = io.BytesIO()
    doc    = _build_doc(buffer, f"Daily Sales Report — {_fmt_date(report_date)}")
    s      = _styles()
    story  = []

    branch_name = hotel.name if hotel else "All Branches"

    # ── Dark header banner ──────────────────────────────────────────────────
    banner = Table([[
        Paragraph("ENAYI HOTELS & SUITES", ParagraphStyle("bn", fontSize=20, textColor=GOLD, fontName="Helvetica-Bold", alignment=TA_CENTER)),
        Paragraph("DAILY SALES REPORT", ParagraphStyle("bn2", fontSize=14, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_CENTER)),
        Paragraph(report_date.strftime("%A, %d %B %Y").upper(), ParagraphStyle("bn3", fontSize=10, textColor=GOLD, fontName="Helvetica", alignment=TA_CENTER)),
    ]], colWidths=[A4[0] - 3.6*cm])
    banner.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), DARK),
        ("TOPPADDING", (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
        ("LEFTPADDING", (0,0), (-1,-1), 12),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ]))
    story.append(banner)
    story.append(Paragraph(f"Branch: {branch_name}  |  Generated: {datetime.now().strftime('%d %b %Y, %I:%M %p')}", s["footer"]))
    story.append(Spacer(1, 6*mm))

    # ── Date range ──────────────────────────────────────────────────────────
    day_start = datetime.combine(report_date, datetime.min.time())
    day_end   = datetime.combine(report_date, datetime.max.time())

    qs_kwargs = {"hotel": hotel} if hotel else {}

    # ── Payments — Payment uses GenericFK, filter via bookings/orders at branch ──
    from django.contrib.contenttypes.models import ContentType
    from apps.bookings.models import Booking as BookingModel
    from apps.orders.models   import Order    as OrderModel
    from apps.payments.models import Payment  as PaymentModel

    booking_ct = ContentType.objects.get_for_model(BookingModel)
    order_ct   = ContentType.objects.get_for_model(OrderModel)

    # IDs of all bookings and orders at this branch on this date
    booking_ids = list(Booking.objects.filter(created_at__date=report_date, **qs_kwargs).values_list("id", flat=True))
    order_ids   = list(Order.objects.filter(created_at__date=report_date, **qs_kwargs).values_list("id", flat=True))

    booking_ct = ContentType.objects.get_for_model(Booking)
    order_ct   = ContentType.objects.get_for_model(Order)

    payments = PaymentModel.objects.filter(
        status="success",
        created_at__date=report_date,
    ).filter(
        Q(content_type=booking_ct, object_id__in=booking_ids) |
        Q(content_type=order_ct,   object_id__in=order_ids)
    ).order_by("created_at")

    total_revenue = payments.aggregate(t=Sum("amount"))["t"] or Decimal("0")

    # ── Bookings ────────────────────────────────────────────────────────────
    bookings_today = Booking.objects.filter(created_at__date=report_date, **qs_kwargs)
    checkins_today = Booking.objects.filter(actual_check_in__date=report_date, **qs_kwargs)
    checkouts_today= Booking.objects.filter(actual_check_out__date=report_date, **qs_kwargs)

    # ── Orders ──────────────────────────────────────────────────────────────
    orders_today = Order.objects.filter(created_at__date=report_date, **qs_kwargs).exclude(status="cancelled")
    orders_revenue = orders_today.aggregate(t=Sum("total_amount"))["t"] or Decimal("0")

    # ── Summary cards ───────────────────────────────────────────────────────
    story.append(Paragraph("SUMMARY", s["section"]))
    summary_data = [
        [Paragraph("TOTAL REVENUE", s["th"]), Paragraph("BOOKINGS", s["th"]), Paragraph("CHECK-INS", s["th"]), Paragraph("CHECK-OUTS", s["th"]), Paragraph("FOOD & BAR ORDERS", s["th"])],
        [Paragraph(_fmt_money(total_revenue), ParagraphStyle("sv", fontSize=16, fontName="Helvetica-Bold", textColor=GOLD, alignment=TA_CENTER)),
         Paragraph(str(bookings_today.count()), ParagraphStyle("sv", fontSize=16, fontName="Helvetica-Bold", textColor=DARK, alignment=TA_CENTER)),
         Paragraph(str(checkins_today.count()), ParagraphStyle("sv", fontSize=16, fontName="Helvetica-Bold", textColor=DARK, alignment=TA_CENTER)),
         Paragraph(str(checkouts_today.count()), ParagraphStyle("sv", fontSize=16, fontName="Helvetica-Bold", textColor=DARK, alignment=TA_CENTER)),
         Paragraph(str(orders_today.count()), ParagraphStyle("sv", fontSize=16, fontName="Helvetica-Bold", textColor=DARK, alignment=TA_CENTER))],
    ]
    st = Table(summary_data, colWidths=[3.4*cm]*5)
    st.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), DARK),
        ("BACKGROUND", (0,1), (-1,1), colors.HexColor("#F8F9FA")),
        ("BOX", (0,0), (-1,-1), 1, GOLD),
        ("INNERGRID", (0,0), (-1,-1), 0.5, colors.HexColor("#DDDDDD")),
        ("TOPPADDING", (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ]))
    story.append(st)
    story.append(Spacer(1, 6*mm))

    # ── Revenue by payment method ───────────────────────────────────────────
    story.append(Paragraph("REVENUE BY PAYMENT METHOD", s["section"]))
    method_data = [[Paragraph(h, s["th"]) for h in ["Method", "Transactions", "Total Amount"]]]
    for m in payments.values("method").annotate(count=Count("id"), total=Sum("amount")).order_by("-total"):
        method_data.append([
            Paragraph(m["method"].replace("_"," ").title(), s["td"]),
            Paragraph(str(m["count"]), s["td"]),
            Paragraph(_fmt_money(m["total"]), s["td_r"]),
        ])
    if len(method_data) > 1:
        mt = Table(method_data, colWidths=[6*cm, 4*cm, 7*cm])
        mt.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), DARK),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, colors.HexColor("#F8F9FA")]),
            ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#DDDDDD")),
            ("TOPPADDING", (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
        ]))
        story.append(mt)
    else:
        story.append(Paragraph("No payments recorded for this date.", s["small"]))
    story.append(Spacer(1, 6*mm))

    # ── Booking transactions ────────────────────────────────────────────────
    story.append(Paragraph("BOOKING TRANSACTIONS", s["section"]))
    bk_data = [[Paragraph(h, s["th"]) for h in ["Reference", "Guest", "Room", "Status", "Total", "Paid", "Balance"]]]
    for b in bookings_today.select_related("guest", "room").order_by("created_at"):
        bk_data.append([
            Paragraph(b.booking_reference, s["td"]),
            Paragraph((b.guest.get_full_name() or b.guest.email)[:20], s["td"]),
            Paragraph(f"Room {b.room.room_number}", s["td"]),
            Paragraph(b.get_status_display(), s["td"]),
            Paragraph(_fmt_money(b.total_amount), s["td_r"]),
            Paragraph(_fmt_money(b.amount_paid), s["td_r"]),
            Paragraph(_fmt_money(b.balance_due), ParagraphStyle("bal", fontSize=8.5, fontName="Helvetica-Bold", alignment=TA_RIGHT, textColor=RED if b.balance_due > 0 else GREEN)),
        ])
    if len(bk_data) > 1:
        bt = Table(bk_data, colWidths=[2.8*cm, 3.5*cm, 1.8*cm, 2.2*cm, 2.5*cm, 2.5*cm, 2.5*cm])
        bt.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), DARK),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, colors.HexColor("#F8F9FA")]),
            ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#DDDDDD")),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("LEFTPADDING", (0,0), (-1,-1), 4),
        ]))
        story.append(bt)
    else:
        story.append(Paragraph("No bookings created today.", s["small"]))
    story.append(Spacer(1, 6*mm))

    # ── Food & Bar orders ───────────────────────────────────────────────────
    story.append(Paragraph("FOOD & BAR ORDERS", s["section"]))
    ord_data = [[Paragraph(h, s["th"]) for h in ["Order #", "Guest", "Room", "Type", "Items", "Total", "Paid"]]]
    for o in orders_today.select_related("guest", "room").prefetch_related("items").order_by("created_at"):
        ord_data.append([
            Paragraph(o.order_number, s["td"]),
            Paragraph((o.guest.get_full_name() or o.guest.email)[:18], s["td"]),
            Paragraph(f"Room {o.room.room_number}" if o.room_id else "—", s["td"]),
            Paragraph(o.get_source_display(), s["td"]),
            Paragraph(str(o.items.count()), s["td"]),
            Paragraph(_fmt_money(o.total_amount), s["td_r"]),
            Paragraph("Yes" if o.is_paid else "No", ParagraphStyle("ip", fontSize=8.5, fontName="Helvetica-Bold", textColor=GREEN if o.is_paid else RED)),
        ])
    if len(ord_data) > 1:
        ot = Table(ord_data, colWidths=[2.5*cm, 3.5*cm, 2*cm, 2.5*cm, 1.5*cm, 2.8*cm, 1.5*cm])
        ot.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), DARK),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, colors.HexColor("#F8F9FA")]),
            ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#DDDDDD")),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("LEFTPADDING", (0,0), (-1,-1), 4),
        ]))
        story.append(ot)
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph(f"Food & Bar Total: {_fmt_money(orders_revenue)}  |  Orders: {orders_today.count()}", s["right"]))
    else:
        story.append(Paragraph("No food & bar orders today.", s["small"]))
    story.append(Spacer(1, 6*mm))

    # ── Daily totals box ────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=2, color=GOLD, spaceAfter=4))
    story.append(Paragraph("DAILY TOTALS", s["section"]))
    totals_data = [
        ["Room Revenue (payments received today)",    _fmt_money(total_revenue - orders_revenue)],
        ["Food & Bar Revenue",                        _fmt_money(orders_revenue)],
        ["GROSS REVENUE FOR THE DAY",                 _fmt_money(total_revenue)],
        ["Total Bookings Created",                    str(bookings_today.count())],
        ["Total Check-Ins",                           str(checkins_today.count())],
        ["Total Check-Outs",                          str(checkouts_today.count())],
    ]
    td_rows = [[Paragraph(k, ParagraphStyle("dl", fontSize=9 if "GROSS" not in k else 11, fontName="Helvetica-Bold" if "GROSS" in k else "Helvetica", textColor=MUTED if "GROSS" not in k else DARK)),
                Paragraph(v, ParagraphStyle("dr", fontSize=9 if "GROSS" not in k else 13, fontName="Helvetica-Bold", textColor=GOLD if "GROSS" in k else DARK, alignment=TA_RIGHT))]
               for k, v in totals_data]
    tdt = Table(td_rows, colWidths=[12*cm, 5*cm])
    tdt.setStyle(TableStyle([
        ("LINEABOVE", (0,2), (-1,2), 1, GOLD),
        ("LINEBELOW", (0,2), (-1,2), 1, GOLD),
        ("BACKGROUND", (0,2), (-1,2), colors.HexColor("#F0F0E8")),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING", (0,0), (-1,-1), 4),
    ]))
    story.append(tdt)

    story += _footer_block(s, f"This daily report was prepared for management review — {branch_name}. All figures are in Nigerian Naira (NGN).")
    doc.build(story)
    return buffer.getvalue()


# ═══════════════════════════════════════════════════════════════════════════
#  VIEWS
# ═══════════════════════════════════════════════════════════════════════════
class BookingReceiptView(APIView):
    """GET /api/v1/reports/receipt/booking/<booking_id>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id):
        from apps.bookings.models import Booking
        try:
            booking = Booking.objects.select_related(
                "guest", "room", "room__category", "hotel"
            ).prefetch_related("payments").get(id=booking_id)
        except Booking.DoesNotExist:
            from rest_framework.response import Response
            return Response({"error": "Booking not found."}, status=404)

        # Guest can only download their own receipt; staff/manager/admin can download any
        if not (request.user.role in ["admin", "manager", "staff"] or
                str(booking.guest_id) == str(request.user.id)):
            from rest_framework.response import Response
            return Response({"error": "Not authorised."}, status=403)

        pdf = _generate_booking_receipt(booking)
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="booking-receipt-{booking.booking_reference}.pdf"'
        return response


class OrderReceiptView(APIView):
    """GET /api/v1/reports/receipt/order/<order_id>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, order_id):
        from apps.orders.models import Order
        try:
            order = Order.objects.select_related(
                "guest", "room", "hotel"
            ).prefetch_related("items__menu_item").get(id=order_id)
        except Order.DoesNotExist:
            from rest_framework.response import Response
            return Response({"error": "Order not found."}, status=404)

        if not (request.user.is_staff or request.user.role in ["admin", "manager", "staff", "kitchen_staff", "bar_staff"] or
                str(order.guest_id) == str(request.user.id)):
            from rest_framework.response import Response
            return Response({"error": "Not authorised."}, status=403)

        pdf = _generate_order_receipt(order)
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="order-receipt-{order.order_number}.pdf"'
        return response


class DailyReportView(APIView):
    """GET /api/v1/reports/daily/?date=YYYY-MM-DD&hotel=<hotel_id>
    Manager and Owner only."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from rest_framework.response import Response
        if request.user.role not in ["admin", "manager"]:
            return Response({"error": "Only Manager or Owner can access daily reports."}, status=403)

        date_str = request.query_params.get("date", date.today().isoformat())
        try:
            report_date = date.fromisoformat(date_str)
        except ValueError:
            return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

        hotel = None
        hotel_id = request.query_params.get("hotel")
        if hotel_id:
            from apps.hotels.models import Hotel
            try:
                hotel = Hotel.objects.get(id=hotel_id)
            except Hotel.DoesNotExist:
                return Response({"error": "Hotel not found."}, status=404)
        elif request.user.role != "admin" and request.user.hotel_id:
            from apps.hotels.models import Hotel
            try:
                hotel = Hotel.objects.get(id=request.user.hotel_id)
            except Hotel.DoesNotExist:
                pass

        pdf = _generate_daily_report(report_date, hotel)
        fname = f"enayi-daily-report-{date_str}.pdf"
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{fname}"'
        return response
