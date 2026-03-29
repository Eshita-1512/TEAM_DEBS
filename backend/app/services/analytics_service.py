"""Analytics service — overview aggregates and spend pattern analysis."""

from __future__ import annotations

from uuid import UUID
from decimal import Decimal

from sqlalchemy import select, func, and_, case, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.user import User


async def get_overview(db: AsyncSession, company_id: UUID) -> dict:
    """Compute analytics overview for the company."""
    base = Expense.company_id == company_id

    # Status counts
    status_q = (
        select(
            Expense.status,
            func.count().label("cnt"),
            func.coalesce(func.sum(Expense.original_amount), 0).label("orig_total"),
            func.coalesce(func.sum(Expense.converted_amount), 0).label("conv_total"),
        )
        .where(base)
        .group_by(Expense.status)
    )
    result = await db.execute(status_q)
    rows = result.all()

    counts = {
        "submitted": 0, "pending_approval": 0, "on_hold": 0,
        "approved": 0, "rejected": 0, "reimbursed": 0,
    }
    total_orig = Decimal("0")
    total_conv = Decimal("0")
    total_all = 0

    for row in rows:
        s = row.status
        if s in counts:
            counts[s] = row.cnt
        total_all += row.cnt
        total_orig += row.orig_total or Decimal("0")
        total_conv += row.conv_total or Decimal("0")

    # Get company currency
    currency_q = select(Expense.company_currency).where(base).limit(1)
    currency_result = await db.execute(currency_q)
    currency = currency_result.scalar() or "USD"

    return {
        "total_expenses": total_all,
        "total_submitted": counts["submitted"],
        "total_approved": counts["approved"],
        "total_rejected": counts["rejected"],
        "total_pending": counts["pending_approval"],
        "total_on_hold": counts["on_hold"],
        "total_reimbursed": counts["reimbursed"],
        "total_original_amount": str(total_orig),
        "total_converted_amount": str(total_conv),
        "currency": currency,
    }


async def get_spend_patterns(
    db: AsyncSession,
    company_id: UUID,
    date_from=None,
    date_to=None,
) -> dict:
    """Compute spend patterns: by category, by time period, and anomaly flags."""
    conditions = [
        Expense.company_id == company_id,
        Expense.status.in_(["approved", "reimbursed", "pending_approval"]),
    ]
    if date_from:
        conditions.append(Expense.expense_date >= date_from)
    if date_to:
        conditions.append(Expense.expense_date <= date_to)

    where = and_(*conditions)

    # --- By category ---
    cat_q = (
        select(
            Expense.category,
            func.count().label("cnt"),
            func.coalesce(func.sum(Expense.converted_amount), 0).label("total"),
        )
        .where(where)
        .group_by(Expense.category)
        .order_by(func.sum(Expense.converted_amount).desc())
    )
    cat_result = await db.execute(cat_q)
    cat_rows = cat_result.all()

    grand_total = sum(r.total for r in cat_rows) or Decimal("1")
    by_category = [
        {
            "category": r.category,
            "count": r.cnt,
            "total_amount": str(r.total),
            "percentage": str(round((r.total / grand_total) * 100, 2)),
        }
        for r in cat_rows
    ]

    # --- By time period (monthly) ---
    time_q = (
        select(
            func.to_char(Expense.expense_date, "YYYY-MM").label("period"),
            func.count().label("cnt"),
            func.coalesce(func.sum(Expense.converted_amount), 0).label("total"),
        )
        .where(where)
        .group_by(func.to_char(Expense.expense_date, "YYYY-MM"))
        .order_by(func.to_char(Expense.expense_date, "YYYY-MM"))
    )
    time_result = await db.execute(time_q)
    time_rows = time_result.all()

    by_time = [
        {
            "period": r.period,
            "count": r.cnt,
            "total_amount": str(r.total),
        }
        for r in time_rows
    ]

    # --- Anomaly detection (rule-based, deterministic) ---
    anomalies = await _detect_anomalies(db, company_id, where)

    return {
        "by_category": by_category,
        "by_time_period": by_time,
        "anomalies": anomalies,
    }


async def _detect_anomalies(db: AsyncSession, company_id: UUID, where) -> list[dict]:
    """Deterministic rule-based anomaly detection.

    Flags:
    - Categories where spend > 2x the average category spend
    - Individual users with spend > 3x the company per-user average
    """
    anomalies = []

    # Category anomaly: category spend > 2x average
    cat_q = (
        select(
            Expense.category,
            func.coalesce(func.sum(Expense.converted_amount), 0).label("total"),
        )
        .where(where)
        .group_by(Expense.category)
    )
    cat_result = await db.execute(cat_q)
    cat_rows = cat_result.all()

    if cat_rows:
        avg_cat_spend = sum(r.total for r in cat_rows) / len(cat_rows)
        for r in cat_rows:
            if r.total > avg_cat_spend * 2 and avg_cat_spend > 0:
                anomalies.append({
                    "type": "high_category_spend",
                    "category": r.category,
                    "amount": str(r.total),
                    "threshold": str(round(avg_cat_spend * 2, 2)),
                    "message": f"Category '{r.category}' spend ({r.total}) is more than 2x the average category spend ({round(avg_cat_spend, 2)})",
                })

    # Individual anomaly: user spend > 3x average
    user_q = (
        select(
            Expense.employee_id,
            func.coalesce(func.sum(Expense.converted_amount), 0).label("total"),
        )
        .where(where)
        .group_by(Expense.employee_id)
    )
    user_result = await db.execute(user_q)
    user_rows = user_result.all()

    if user_rows:
        avg_user_spend = sum(r.total for r in user_rows) / len(user_rows)
        for r in user_rows:
            if r.total > avg_user_spend * 3 and avg_user_spend > 0:
                # Get user name
                u_result = await db.execute(select(User).where(User.id == r.employee_id))
                u = u_result.scalar_one_or_none()
                anomalies.append({
                    "type": "high_individual_spend",
                    "user_id": str(r.employee_id),
                    "user_name": u.name if u else "Unknown",
                    "amount": str(r.total),
                    "threshold": str(round(avg_user_spend * 3, 2)),
                    "message": f"User '{u.name if u else 'Unknown'}' spend ({r.total}) exceeds 3x the per-user average ({round(avg_user_spend, 2)})",
                })

    return anomalies
