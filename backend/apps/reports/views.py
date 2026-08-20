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
from django.db.models import Q, Sum, Count
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
    # Use A4 with tighter margins to fit on one page
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.5*cm, leftMargin=1.5*cm,
        topMargin=1.2*cm, bottomMargin=1.2*cm,
        title=f"Booking Receipt — {booking.booking_reference}",
    )
    s     = _styles()
    story = []
    W_available = A4[0] - 3*cm   # usable width

    branch = booking.hotel.name if booking.hotel_id else "Enayi Hotels & Suites"

    # ── Header: coloured banner on left, hotel info on right ───────────────
    header_data = [[
        Paragraph("ENAYI\nHOTELS &amp;\nSUITES",
                  ParagraphStyle("hb", fontSize=15, textColor=GOLD,
                                 fontName="Helvetica-Bold", leading=18)),
        Paragraph(
            f"<b>{branch}</b><br/>"
            "Rayfield Zarmaganda Road, Jos, Plateau State, Nigeria<br/>"
            "+234 (0) 913 894 3008 &nbsp;|&nbsp; info@enayihotels.com",
            ParagraphStyle("hi", fontSize=8.5, textColor=DARK,
                           fontName="Helvetica", leading=12)),
        Paragraph(
            "BOOKING<br/>RECEIPT",
            ParagraphStyle("rt", fontSize=18, textColor=WHITE,
                           fontName="Helvetica-Bold", alignment=TA_CENTER, leading=20)),
    ]]
    ht = Table(header_data, colWidths=[3.2*cm, 9.0*cm, 4.0*cm])
    ht.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (0,0), DARK),
        ("BACKGROUND",   (1,0), (1,0), colors.HexColor("#F5F5F0")),
        ("BACKGROUND",   (2,0), (2,0), GOLD),
        ("TOPPADDING",   (0,0), (-1,-1), 10),
        ("BOTTOMPADDING",(0,0), (-1,-1), 10),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(ht)
    story.append(Spacer(1, 4*mm))

    # ── Reference strip ─────────────────────────────────────────────────────
    ref_data = [[
        Paragraph(f"<b>Ref:</b> {booking.booking_reference}", ParagraphStyle("ref", fontSize=9, fontName="Helvetica", textColor=DARK)),
        Paragraph(f"<b>Date:</b> {_fmt_date(booking.created_at)}", ParagraphStyle("ref", fontSize=9, fontName="Helvetica", textColor=DARK, alignment=TA_CENTER)),
        Paragraph(
            f"<b>Status:</b> {booking.get_status_display().upper()}",
            ParagraphStyle("refs", fontSize=9, fontName="Helvetica-Bold",
                           textColor=GREEN if booking.status in ("checked_out","confirmed","checked_in") else MUTED,
                           alignment=TA_RIGHT)),
    ]]
    rt = Table(ref_data, colWidths=[W_available/3]*3)
    rt.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), colors.HexColor("#F5F5F0")),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
        ("BOX",           (0,0), (-1,-1), 0.5, GOLD),
        ("LINEAFTER",     (0,0), (1,-1), 0.3, MUTED),
    ]))
    story.append(rt)
    story.append(Spacer(1, 4*mm))

    # ── Two columns: Guest Info | Stay Details ──────────────────────────────
    def mini_table(rows):
        data = [[Paragraph(k, ParagraphStyle("mk", fontSize=7.5, textColor=MUTED, fontName="Helvetica")),
                 Paragraph(v, ParagraphStyle("mv", fontSize=8.5, textColor=DARK, fontName="Helvetica-Bold"))]
                for k, v in rows]
        t = Table(data, colWidths=[3.0*cm, 5.4*cm])
        t.setStyle(TableStyle([
            ("TOPPADDING",    (0,0), (-1,-1), 3),
            ("BOTTOMPADDING", (0,0), (-1,-1), 3),
            ("LEFTPADDING",   (0,0), (-1,-1), 0),
            ("RIGHTPADDING",  (0,0), (-1,-1), 4),
            ("LINEBELOW",     (0,0), (-1,-2), 0.2, colors.HexColor("#EEEEEE")),
        ]))
        return t

    try:
        room_type = booking.room.category.name if booking.room.category_id else "—"
    except Exception:
        room_type = "—"

    guest_block = [
        Paragraph("GUEST INFORMATION", ParagraphStyle("sh", fontSize=8, textColor=GOLD, fontName="Helvetica-Bold", spaceAfter=4)),
        mini_table([
            ("Full Name",    booking.guest.get_full_name() or "—"),
            ("Email",        booking.guest.email),
            ("Phone",        getattr(booking.guest, 'phone_number', None) or "—"),
            ("Source",       booking.get_source_display()),
        ]),
    ]
    stay_block = [
        Paragraph("STAY DETAILS", ParagraphStyle("sh2", fontSize=8, textColor=GOLD, fontName="Helvetica-Bold", spaceAfter=4)),
        mini_table([
            ("Branch",       branch.replace("Enayi Hotels & Suites — ","")),
            ("Room",         f"Room {booking.room.room_number}  |  {room_type}"),
            ("Check-In",     _fmt_date(booking.check_in)),
            ("Check-Out",    _fmt_date(booking.check_out)),
            ("Nights",       str(booking.total_nights)),
            ("Guests",       f"{booking.adults} adult(s)" + (f", {booking.children} child(ren)" if booking.children else "")),
            ("Breakfast",    "Included" if booking.breakfast_included else "Not included"),
        ]),
    ]

    two_col = Table(
        [[guest_block, Spacer(0.4*cm, 1), stay_block]],
        colWidths=[8.0*cm, 0.4*cm, 8.0*cm],
    )
    two_col.setStyle(TableStyle([
        ("VALIGN",   (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING",  (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
    ]))
    story.append(two_col)
    story.append(Spacer(1, 4*mm))

    # ── Charges table ───────────────────────────────────────────────────────
    story.append(Paragraph("CHARGES", ParagraphStyle("sh3", fontSize=8, textColor=GOLD, fontName="Helvetica-Bold", spaceAfter=4)))

    BOLD_R = ParagraphStyle("br", fontSize=9, fontName="Helvetica-Bold", alignment=TA_RIGHT, textColor=DARK)
    NORM_R = ParagraphStyle("nr", fontSize=8.5, fontName="Helvetica", alignment=TA_RIGHT, textColor=DARK)
    NORM_L = ParagraphStyle("nl", fontSize=8.5, fontName="Helvetica", textColor=DARK)

    charge_rows = [
        [Paragraph("Description", ParagraphStyle("th2", fontSize=8, textColor=WHITE, fontName="Helvetica-Bold")),
         Paragraph("Amount", ParagraphStyle("th2r", fontSize=8, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_RIGHT))],
        [Paragraph(f"Room rate \xd7 {booking.total_nights} night(s)  @  {_fmt_money(booking.room_rate_per_night)}/night", NORM_L),
         Paragraph(_fmt_money(booking.subtotal), NORM_R)],
    ]
    if booking.discount_amount:
        charge_rows.append([Paragraph("Discount", NORM_L), Paragraph(f"- {_fmt_money(booking.discount_amount)}", NORM_R)])
    if booking.tax_amount:
        charge_rows.append([Paragraph("Tax (7.5% VAT)", NORM_L), Paragraph(_fmt_money(booking.tax_amount), NORM_R)])

    charge_rows += [
        [Paragraph("TOTAL", BOLD_R), Paragraph(_fmt_money(booking.total_amount), ParagraphStyle("tr", fontSize=10, fontName="Helvetica-Bold", alignment=TA_RIGHT, textColor=GOLD))],
        [Paragraph("Amount Paid", NORM_L), Paragraph(_fmt_money(booking.amount_paid), ParagraphStyle("ap", fontSize=8.5, fontName="Helvetica-Bold", alignment=TA_RIGHT, textColor=GREEN))],
        [Paragraph("Balance Due", ParagraphStyle("bd", fontSize=9, fontName="Helvetica-Bold", textColor=RED if booking.balance_due > 0 else GREEN)),
         Paragraph(_fmt_money(booking.balance_due), ParagraphStyle("bdr", fontSize=9, fontName="Helvetica-Bold", alignment=TA_RIGHT, textColor=RED if booking.balance_due > 0 else GREEN))],
    ]

    ct = Table(charge_rows, colWidths=[W_available - 4*cm, 4*cm])
    ct.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0), DARK),
        ("ROWBACKGROUNDS",(0,1), (-1,-4), [WHITE, colors.HexColor("#F8F9FA")]),
        ("BACKGROUND",    (0,-3), (-1,-3), colors.HexColor("#F0F0E8")),
        ("LINEABOVE",     (0,-3), (-1,-3), 1, GOLD),
        ("LINEBELOW",     (0,-3), (-1,-3), 0.5, MUTED),
        ("GRID",          (0,0), (-1,-1), 0.2, colors.HexColor("#E0E0E0")),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
        ("RIGHTPADDING",  (0,0), (-1,-1), 6),
    ]))
    story.append(ct)

    # ── Payment history (compact, only if payments exist) ──────────────────
    try:
        from django.contrib.contenttypes.models import ContentType
        from apps.payments.models import Payment as PaymentModel
        ct_type  = ContentType.objects.get_for_model(booking.__class__)
        payments = PaymentModel.objects.filter(
            content_type=ct_type, object_id=booking.id, status="success"
        ).order_by("created_at")
        if payments.exists():
            story.append(Spacer(1, 3*mm))
            story.append(Paragraph("PAYMENT HISTORY", ParagraphStyle("sh4", fontSize=8, textColor=GOLD, fontName="Helvetica-Bold", spaceAfter=3)))
            ph = [[Paragraph(h, ParagraphStyle("ph", fontSize=7.5, textColor=WHITE, fontName="Helvetica-Bold"))
                   for h in ["Date", "Method", "Reference", "Amount"]]]
            for p in payments:
                ph.append([
                    Paragraph(_fmt_date(p.created_at), ParagraphStyle("pd", fontSize=8, fontName="Helvetica", textColor=DARK)),
                    Paragraph(p.get_method_display(), ParagraphStyle("pd", fontSize=8, fontName="Helvetica", textColor=DARK)),
                    Paragraph(p.transaction_reference or "—", ParagraphStyle("pd", fontSize=7.5, fontName="Helvetica", textColor=DARK)),
                    Paragraph(_fmt_money(p.amount), ParagraphStyle("pdr", fontSize=8, fontName="Helvetica-Bold", alignment=TA_RIGHT, textColor=DARK)),
                ])
            pt = Table(ph, colWidths=[3.5*cm, 2.8*cm, 6.5*cm, 3.6*cm])
            pt.setStyle(TableStyle([
                ("BACKGROUND",    (0,0), (-1,0), DARK),
                ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, colors.HexColor("#F8F9FA")]),
                ("GRID",          (0,0), (-1,-1), 0.2, colors.HexColor("#E0E0E0")),
                ("TOPPADDING",    (0,0), (-1,-1), 4),
                ("BOTTOMPADDING", (0,0), (-1,-1), 4),
                ("LEFTPADDING",   (0,0), (-1,-1), 5),
            ]))
            story.append(pt)
    except Exception as e:
        import logging; logging.getLogger("apps.reports").warning(f"Payment history error: {e}")

    # ── Footer ──────────────────────────────────────────────────────────────
    story.append(Spacer(1, 5*mm))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=3))
    story.append(Paragraph(
        "Thank you for choosing Enayi Hotels &amp; Suites. We hope to welcome you again!",
        ParagraphStyle("ft", fontSize=8, textColor=MUTED, fontName="Helvetica", alignment=TA_CENTER)))
    story.append(Paragraph(
        f"Generated: {datetime.now().strftime('%d %b %Y, %I:%M %p')}  |  Enayi Hotel Management System",
        ParagraphStyle("ft2", fontSize=7.5, textColor=MUTED, fontName="Helvetica", alignment=TA_CENTER)))

    doc.build(story)
    return buffer.getvalue()


# ═══════════════════════════════════════════════════════════════════════════
#  ORDER RECEIPT (Food & Drinks)
# ═══════════════════════════════════════════════════════════════════════════
def _generate_order_receipt(order) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.5*cm, leftMargin=1.5*cm,
        topMargin=1.2*cm, bottomMargin=1.2*cm,
        title=f"Order Receipt — {order.order_number}",
    )
    s = _styles()
    story = []
    W_available = A4[0] - 3*cm

    branch = order.hotel.name if order.hotel_id else "Enayi Hotels & Suites"

    # Header banner — same 3-column style as booking receipt
    header_data = [[
        Paragraph("ENAYI\nHOTELS &amp;\nSUITES",
                  ParagraphStyle("hb", fontSize=15, textColor=GOLD, fontName="Helvetica-Bold", leading=18)),
        Paragraph(
            f"<b>{branch}</b><br/>"
            "Rayfield Zarmaganda Road, Jos, Plateau State, Nigeria<br/>"
            "+234 (0) 913 894 3008 &nbsp;|&nbsp; info@enayihotels.com",
            ParagraphStyle("hi", fontSize=8.5, textColor=DARK, fontName="Helvetica", leading=12)),
        Paragraph("FOOD &amp; BAR\nRECEIPT",
                  ParagraphStyle("rt", fontSize=16, textColor=WHITE, fontName="Helvetica-Bold",
                                 alignment=TA_CENTER, leading=20)),
    ]]
    ht = Table(header_data, colWidths=[3.2*cm, 9.0*cm, 4.0*cm])
    ht.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (0,0), DARK),
        ("BACKGROUND",    (1,0), (1,0), colors.HexColor("#F5F5F0")),
        ("BACKGROUND",    (2,0), (2,0), GOLD),
        ("TOPPADDING",    (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
        ("RIGHTPADDING",  (0,0), (-1,-1), 8),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(ht)
    story.append(Spacer(1, 3*mm))

    # Reference strip
    ref_data = [[
        Paragraph(f"<b>Order:</b> {order.order_number}", ParagraphStyle("ref", fontSize=9, fontName="Helvetica", textColor=DARK)),
        Paragraph(f"<b>Date:</b> {_fmt_date(order.created_at)}", ParagraphStyle("ref", fontSize=9, fontName="Helvetica", textColor=DARK, alignment=TA_CENTER)),
        Paragraph(f"<b>Payment:</b> {'PAID' if order.is_paid else 'PENDING'}",
                  ParagraphStyle("refs", fontSize=9, fontName="Helvetica-Bold",
                                 textColor=GREEN if order.is_paid else RED, alignment=TA_RIGHT)),
    ]]
    rt = Table(ref_data, colWidths=[W_available/3]*3)
    rt.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), colors.HexColor("#F5F5F0")),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
        ("BOX",           (0,0), (-1,-1), 0.5, GOLD),
        ("LINEAFTER",     (0,0), (1,-1), 0.3, MUTED),
    ]))
    story.append(rt)
    story.append(Spacer(1, 3*mm))

    # Order info — compact 2-column
    info_data = [[
        Paragraph(f"<b>Guest:</b> {order.guest.get_full_name() or order.guest.email}",
                  ParagraphStyle("oi", fontSize=8.5, fontName="Helvetica", textColor=DARK)),
        Paragraph(f"<b>Room:</b> {'Room ' + str(order.room.room_number) if order.room_id else '—'}  &nbsp;&nbsp; <b>Type:</b> {order.get_source_display()}",
                  ParagraphStyle("oi", fontSize=8.5, fontName="Helvetica", textColor=DARK, alignment=TA_RIGHT)),
    ]]
    it2 = Table(info_data, colWidths=[W_available/2, W_available/2])
    it2.setStyle(TableStyle([
        ("TOPPADDING",    (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("LEFTPADDING",   (0,0), (0,-1), 0),
    ]))
    story.append(it2)
    story.append(Spacer(1, 3*mm))

    # Items table
    story.append(Paragraph("ITEMS ORDERED", ParagraphStyle("sh", fontSize=8, textColor=GOLD, fontName="Helvetica-Bold", spaceAfter=3)))
    NORM_R = ParagraphStyle("nr", fontSize=8.5, fontName="Helvetica", alignment=TA_RIGHT, textColor=DARK)
    NORM_L = ParagraphStyle("nl", fontSize=8.5, fontName="Helvetica", textColor=DARK)
    TH     = ParagraphStyle("th", fontSize=8, textColor=WHITE, fontName="Helvetica-Bold")
    THR    = ParagraphStyle("thr", fontSize=8, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_RIGHT)

    item_data = [[Paragraph("Item", TH), Paragraph("Qty", THR), Paragraph("Unit Price", THR), Paragraph("Total", THR)]]
    for item in order.items.select_related("menu_item").all():
        item_data.append([
            Paragraph(item.menu_item.name, NORM_L),
            Paragraph(str(item.quantity), NORM_R),
            Paragraph(_fmt_money(item.unit_price), NORM_R),
            Paragraph(_fmt_money(item.total_price), NORM_R),
        ])
    it = Table(item_data, colWidths=[W_available - 8.5*cm, 1.5*cm, 3.5*cm, 3.5*cm])
    it.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0), DARK),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, colors.HexColor("#F8F9FA")]),
        ("GRID",          (0,0), (-1,-1), 0.2, colors.HexColor("#E0E0E0")),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
    ]))
    story.append(it)
    story.append(Spacer(1, 2*mm))

    # Totals strip — right-aligned compact rows
    totals = [("Subtotal", _fmt_money(order.subtotal))]
    if order.delivery_charge:
        totals.append(("Delivery", _fmt_money(order.delivery_charge)))
    if order.tax:
        totals.append(("Tax (7.5%)", _fmt_money(order.tax)))
    totals.append(("TOTAL", _fmt_money(order.total_amount)))

    for label, amount in totals:
        is_total = label == "TOTAL"
        td = Table([[
            Paragraph(label, ParagraphStyle("tl", fontSize=10 if is_total else 8.5,
                                             fontName="Helvetica-Bold" if is_total else "Helvetica",
                                             textColor=DARK if is_total else MUTED, alignment=TA_RIGHT)),
            Paragraph(amount, ParagraphStyle("tv", fontSize=11 if is_total else 8.5,
                                              fontName="Helvetica-Bold",
                                              textColor=GOLD if is_total else DARK, alignment=TA_RIGHT)),
        ]], colWidths=[W_available - 4*cm, 4*cm])
        td.setStyle(TableStyle([
            ("TOPPADDING",    (0,0), (-1,-1), 2 if not is_total else 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 2 if not is_total else 4),
            ("LINEABOVE",     (0,0), (-1,0), 1.5 if is_total else 0, GOLD),
        ]))
        story.append(td)

    if order.special_instructions:
        story.append(Spacer(1, 3*mm))
        story.append(Paragraph(f"<b>Special instructions:</b> {order.special_instructions}",
                               ParagraphStyle("si", fontSize=8, fontName="Helvetica", textColor=MUTED)))

    # Footer
    story.append(Spacer(1, 5*mm))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=3))
    story.append(Paragraph("Thank you for your order. Enjoy your meal!",
                            ParagraphStyle("ft", fontSize=8, textColor=MUTED, fontName="Helvetica", alignment=TA_CENTER)))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%d %b %Y, %I:%M %p')}  |  Enayi Hotel Management System",
                            ParagraphStyle("ft2", fontSize=7.5, textColor=MUTED, fontName="Helvetica", alignment=TA_CENTER)))

    doc.build(story)
    return buffer.getvalue()


# ═══════════════════════════════════════════════════════════════════════════
#  DAILY SALES REPORT
# ═══════════════════════════════════════════════════════════════════════════
def _generate_daily_report(report_date, hotel=None) -> bytes:
    from apps.bookings.models import Booking
    from apps.orders.models   import Order
    from django.contrib.contenttypes.models import ContentType
    from apps.payments.models import Payment as PaymentModel

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
            ).get(id=booking_id)
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
