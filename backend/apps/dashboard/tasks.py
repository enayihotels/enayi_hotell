"""Enayi Hotels — Nightly AI Fraud-Risk Auditor

Runs once a day (or on demand via the manual-trigger endpoint), gathers
the fraud-relevant signals your other fraud-prevention features already
produce (checkout approvals, manually-recorded cash/POS payments, rooms
that turned over unusually fast), and has an LLM turn that into a
plain-English summary for a manager to skim. The numbers themselves are
computed with plain Django queries — the AI call only writes the summary,
so a failed/rate-limited API call never loses the underlying data.
"""
import logging
from datetime import timedelta
from collections import Counter

from django.conf import settings
from django.utils import timezone
from django.core.mail import EmailMultiAlternatives
from celery import shared_task

logger = logging.getLogger("apps.dashboard.fraud_audit")


def _gather_signals(period_start, period_end):
    """Pure data-gathering — no AI, no email. Kept separate so it's easy
    to unit-test and so the manual-trigger endpoint can reuse it."""
    from apps.bookings.models import Booking, CheckoutApprovalRequest
    from apps.payments.models import Payment
    from apps.inventory.models import StockRequisition, StockAdjustmentLog, StockBalance
    from apps.assets.models import PropertyAsset

    signals = {}
    flagged = 0

    # ── Checkout approvals: underpaid checkouts, by requesting staff member ──
    approvals = CheckoutApprovalRequest.objects.filter(created_at__gte=period_start, created_at__lt=period_end)
    approval_count = approvals.count()
    by_staff = Counter(a.requested_by.get_full_name() for a in approvals.select_related("requested_by"))
    repeat_staff = {name: n for name, n in by_staff.items() if n >= 2}
    signals["checkout_approvals"] = {
        "total": approval_count,
        "approved": approvals.filter(status="approved").count(),
        "rejected": approvals.filter(status="rejected").count(),
        "pending": approvals.filter(status="pending").count(),
        "by_staff": dict(by_staff),
        "staff_with_repeat_requests": repeat_staff,
    }
    flagged += len(repeat_staff)

    # ── Manually recorded cash/POS payments, by staff member ─────────────
    manual_payments = Payment.objects.filter(
        purpose="booking", method__in=["cash", "pos"], status="success",
        created_at__gte=period_start, created_at__lt=period_end,
        metadata__recorded_manually=True,
    )
    manual_total = sum((p.amount for p in manual_payments), start=0)
    by_recorder = Counter(p.metadata.get("recorded_by_name", "Unknown") for p in manual_payments)
    signals["manual_payments"] = {
        "count": manual_payments.count(),
        "total_amount": float(manual_total),
        "by_staff": dict(by_recorder),
    }

    # ── Rooms that turned over unusually fast (possible re-sale off-book) ─
    FAST_TURNOVER_MINUTES = 30
    checkouts = Booking.objects.filter(
        status="checked_out", actual_check_out__gte=period_start, actual_check_out__lt=period_end,
    ).select_related("room")
    fast_turnovers = []
    for b in checkouts:
        next_checkin = (Booking.objects
                         .filter(room_id=b.room_id, actual_check_in__gt=b.actual_check_out)
                         .exclude(pk=b.pk)
                         .order_by("actual_check_in")
                         .first())
        if next_checkin and next_checkin.actual_check_in:
            gap_minutes = (next_checkin.actual_check_in - b.actual_check_out).total_seconds() / 60
            if 0 <= gap_minutes <= FAST_TURNOVER_MINUTES:
                fast_turnovers.append({
                    "room": b.room.room_number if b.room_id else "—",
                    "checked_out": b.booking_reference,
                    "next_checkin": next_checkin.booking_reference,
                    "gap_minutes": round(gap_minutes, 1),
                })
    signals["fast_room_turnovers"] = fast_turnovers
    flagged += len(fast_turnovers)

    # ── Check-ins that somehow bypassed OTP verification (should be 0) ───
    unverified_checkins = Booking.objects.filter(
        status__in=["checked_in", "checked_out"],
        actual_check_in__gte=period_start, actual_check_in__lt=period_end,
        checkin_verified_via_otp=False,
    ).count()
    signals["unverified_checkins"] = unverified_checkins
    flagged += unverified_checkins

    # ── Phase 5: Inventory requisitions — by Store Keeper who fulfilled ──
    reqs = StockRequisition.objects.filter(created_at__gte=period_start, created_at__lt=period_end)
    decided_reqs = reqs.exclude(decided_by__isnull=True)
    by_keeper = Counter(r.decided_by.get_full_name() for r in decided_reqs.select_related("decided_by"))
    repeat_keepers = {name: n for name, n in by_keeper.items() if n >= 5}
    signals["inventory_requisitions"] = {
        "total": reqs.count(),
        "fulfilled": reqs.filter(status="fulfilled").count(),
        "rejected": reqs.filter(status="rejected").count(),
        "pending": reqs.filter(status="pending").count(),
        "by_store_keeper": dict(by_keeper),
        "high_volume_store_keepers": repeat_keepers,
    }

    # ── Phase 5: Direct stock adjustments — corrections/deliveries/spoilage,
    # made by one person with no second-party check, unlike requisitions ──
    adjustments = StockAdjustmentLog.objects.filter(created_at__gte=period_start, created_at__lt=period_end)
    negative_adjustments = adjustments.filter(delta__lt=0)
    by_adjuster = Counter(a.adjusted_by.get_full_name() for a in adjustments.select_related("adjusted_by") if a.adjusted_by_id)
    repeat_adjusters = {name: n for name, n in by_adjuster.items() if n >= 5}
    signals["stock_adjustments"] = {
        "total": adjustments.count(),
        "negative_count": negative_adjustments.count(),
        "negative_total_units": float(sum((abs(a.delta) for a in negative_adjustments), start=0)) if negative_adjustments.exists() else 0,
        "by_staff": dict(by_adjuster),
        "high_volume_adjusters": repeat_adjusters,
    }
    flagged += len(repeat_adjusters)

    # ── Phase 5: Negative stock balances — a live snapshot, not period-scoped.
    # This can only happen via the automatic order-delivery deduction (Phase 3),
    # which deliberately allows it rather than hiding a real discrepancy — this
    # is where that signal actually surfaces for a manager to see. ──
    negative_balances = StockBalance.objects.filter(quantity__lt=0).select_related("item")
    signals["negative_stock_balances"] = [{
        "item": b.item.name, "location": b.location, "quantity": float(b.quantity),
    } for b in negative_balances]
    flagged += negative_balances.count()

    # ── Phase 5: Assets broken for a long time without being fixed — an
    # operational-neglect signal, not strictly fraud, but exactly the kind
    # of thing a nightly sweep should still surface. Snapshot, not period-
    # scoped, since "how long has this been broken" only matters as of now. ──
    STALE_BROKEN_HOURS = 48
    stale_cutoff = timezone.now() - timedelta(hours=STALE_BROKEN_HOURS)
    stale_assets = (PropertyAsset.objects
                     .filter(status="broken", issue_reports__status__in=["reported", "in_progress"],
                             issue_reports__reported_at__lt=stale_cutoff)
                     .distinct())
    signals["stale_broken_assets"] = [{
        "name": a.name, "where": (f"Room {a.room.room_number}" if a.room_id else (a.location_note or "Common area")),
    } for a in stale_assets]
    flagged += stale_assets.count()

    return signals, flagged


def _summarize_with_ai(signals: dict, period_start, period_end) -> tuple[str, bool]:
    """Returns (summary_text, ai_generated). Falls back to a plain-template
    summary if the API key is missing or the call fails."""
    fallback = _fallback_summary(signals)
    if not settings.OPENAI_API_KEY:
        return fallback, False
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        prompt = (
            "You are a fraud-risk auditor for a small Nigerian hotel (Enayi Hotels & Suites, Jos). "
            "Given the JSON signals below from the last 24 hours, write a short, plain-English summary "
            "(4-8 sentences) for the hotel manager. Call out anything that looks like a genuine fraud risk "
            "(repeat staff overrides, unusually fast room turnovers, high cash volume from one staff member, "
            "any unverified check-ins, high-volume inventory requisition fulfillment or stock adjustments from "
            "one person, stock that's gone negative — meaning more was sold than was ever recorded as received, "
            "and appliances or fixtures left broken for a long time). If nothing looks concerning, say so "
            "plainly and briefly — do not invent risk that isn't in the numbers. Do not use markdown headers "
            "or bullet lists; write it as plain prose a manager can read in 20 seconds.\n\n"
            f"Period: {period_start.strftime('%d %b %Y %H:%M')} to {period_end.strftime('%d %b %Y %H:%M')}\n"
            f"Signals: {signals}"
        )
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=350,
            temperature=0.3,
        )
        text = response.choices[0].message.content.strip()
        return text or fallback, bool(text)
    except Exception as exc:
        logger.warning(f"AI summary failed, using fallback: {exc}")
        return fallback, False


def _fallback_summary(signals: dict) -> str:
    parts = []
    ca = signals["checkout_approvals"]
    if ca["staff_with_repeat_requests"]:
        names = ", ".join(f"{n} ({c})" for n, c in ca["staff_with_repeat_requests"].items())
        parts.append(f"Repeat underpaid-checkout requests from: {names}.")
    if ca["total"]:
        parts.append(f"{ca['total']} checkout approval request(s) in this period ({ca['approved']} approved, {ca['rejected']} rejected, {ca['pending']} still pending).")
    mp = signals["manual_payments"]
    if mp["count"]:
        parts.append(f"{mp['count']} manual cash/POS payment(s) recorded, totalling ₦{mp['total_amount']:,.2f}.")
    if signals["fast_room_turnovers"]:
        parts.append(f"{len(signals['fast_room_turnovers'])} room(s) were re-occupied within 30 minutes of checkout — worth a manual look.")
    if signals["unverified_checkins"]:
        parts.append(f"{signals['unverified_checkins']} check-in(s) completed without OTP verification — investigate how.")
    ir = signals["inventory_requisitions"]
    if ir["high_volume_store_keepers"]:
        names = ", ".join(f"{n} ({c})" for n, c in ir["high_volume_store_keepers"].items())
        parts.append(f"High-volume requisition fulfillment from: {names}.")
    if ir["total"]:
        parts.append(f"{ir['total']} inventory requisition(s) in this period ({ir['fulfilled']} fulfilled, {ir['rejected']} rejected, {ir['pending']} still pending).")
    sa = signals["stock_adjustments"]
    if sa["high_volume_adjusters"]:
        names = ", ".join(f"{n} ({c})" for n, c in sa["high_volume_adjusters"].items())
        parts.append(f"High-volume direct stock adjustments from: {names}.")
    if sa["negative_count"]:
        parts.append(f"{sa['negative_count']} stock-reduction adjustment(s) recorded, totalling {sa['negative_total_units']:.0f} unit(s) removed.")
    if signals["negative_stock_balances"]:
        items = ", ".join(f"{b['item']} at {b['location']} ({b['quantity']:.0f})" for b in signals["negative_stock_balances"])
        parts.append(f"Stock gone negative — sold more than recorded as received: {items}.")
    if signals["stale_broken_assets"]:
        items = ", ".join(f"{a['name']} ({a['where']})" for a in signals["stale_broken_assets"])
        parts.append(f"Assets broken for over 48 hours with no fix logged: {items}.")
    if not parts:
        parts.append("No notable fraud-risk signals in this period.")
    return " ".join(parts)


def _email_report(report) -> None:
    """Sends the report to every manager/admin with an email on file."""
    from apps.accounts.models import User
    recipients = list(
        User.objects.filter(role__in=["manager", "admin"]).exclude(email="").values_list("email", flat=True)
    )
    if not recipients:
        return
    try:
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0B1120;padding:24px;text-align:center;">
            <h2 style="color:#C9A227;margin:0;">Enayi Hotels — Fraud Audit</h2>
            <p style="color:#8A9AB5;font-size:12px;margin:6px 0 0;">{report.report_date.strftime('%d %b %Y')}</p>
          </div>
          <div style="padding:24px;color:#222;font-size:14px;line-height:1.7;">
            <p>{report.summary_text}</p>
            <p style="color:#888;font-size:12px;margin-top:24px;">
              {report.flagged_count} item(s) flagged for review. Full numbers are available in the admin dashboard.
            </p>
          </div>
        </div>
        """
        msg = EmailMultiAlternatives(
            subject=f"Fraud Audit — {report.report_date.strftime('%d %b %Y')} — {report.flagged_count} flagged",
            body=report.summary_text,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "Enayi Hotels <noreply@enayihotels.com>"),
            to=recipients,
        )
        msg.attach_alternative(html, "text/html")
        msg.send(fail_silently=True)
    except Exception as exc:
        logger.warning(f"Fraud audit email failed: {exc}")


def run_fraud_audit(hours: int = 24, triggered_by: str = "scheduled"):
    """Core entry point — callable directly (manual trigger) or via the
    Celery task below (scheduled)."""
    from .models import FraudAuditReport

    period_end   = timezone.now()
    period_start = period_end - timedelta(hours=hours)

    signals, flagged_count = _gather_signals(period_start, period_end)
    summary_text, ai_generated = _summarize_with_ai(signals, period_start, period_end)

    report = FraudAuditReport.objects.create(
        report_date=period_end.date(),
        period_start=period_start,
        period_end=period_end,
        flagged_count=flagged_count,
        raw_signals=signals,
        summary_text=summary_text,
        ai_generated=ai_generated,
        triggered_by=triggered_by,
    )
    _email_report(report)
    return report


@shared_task
def run_nightly_fraud_audit():
    report = run_fraud_audit(hours=24, triggered_by="scheduled")
    return str(report.id)
