"""Budget service — CRUD and consumption tracking."""

from __future__ import annotations

from typing import Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.budget import Budget
from app.models.expense import Expense
from app.services.audit_service import log_event


async def list_budgets(
    db: AsyncSession,
    company_id: UUID,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[dict], int]:
    """List budgets with computed spent and remaining amounts."""
    count_q = select(func.count()).select_from(Budget).where(Budget.company_id == company_id)
    total = (await db.execute(count_q)).scalar() or 0

    items_q = (
        select(Budget)
        .where(Budget.company_id == company_id)
        .order_by(Budget.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(items_q)
    budgets = list(result.scalars().all())

    enriched = []
    for b in budgets:
        spent = await _compute_spent(db, b)
        remaining = b.amount - spent
        enriched.append({
            "id": str(b.id),
            "company_id": str(b.company_id),
            "name": b.name,
            "scope_type": b.scope_type,
            "scope_value": b.scope_value,
            "amount": str(b.amount),
            "currency": b.currency,
            "period_start": b.period_start.isoformat() if b.period_start else None,
            "period_end": b.period_end.isoformat() if b.period_end else None,
            "created_by": str(b.created_by),
            "is_active": b.is_active,
            "spent": str(spent),
            "remaining": str(remaining),
        })

    return enriched, total


async def create_budget(
    db: AsyncSession,
    company_id: UUID,
    actor_id: UUID,
    name: str,
    scope_type: str,
    scope_value: str,
    amount: str,
    currency: str,
    period_start: Optional[datetime] = None,
    period_end: Optional[datetime] = None,
) -> Budget:
    """Create a new budget."""
    budget = Budget(
        company_id=company_id,
        name=name,
        scope_type=scope_type,
        scope_value=scope_value,
        amount=Decimal(amount),
        currency=currency,
        period_start=period_start,
        period_end=period_end,
        created_by=actor_id,
    )
    db.add(budget)
    await db.flush()

    await log_event(
        db,
        actor_id=actor_id,
        action="budget_created",
        entity_type="budget",
        entity_id=budget.id,
        company_id=company_id,
        details_after={
            "name": name,
            "scope_type": scope_type,
            "scope_value": scope_value,
            "amount": amount,
        },
    )

    return budget


async def get_budget(db: AsyncSession, budget_id: UUID, company_id: UUID) -> dict:
    """Get a single budget with spent/remaining."""
    q = select(Budget).where(Budget.id == budget_id, Budget.company_id == company_id)
    result = await db.execute(q)
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")

    spent = await _compute_spent(db, budget)
    remaining = budget.amount - spent
    return {
        "id": str(budget.id),
        "company_id": str(budget.company_id),
        "name": budget.name,
        "scope_type": budget.scope_type,
        "scope_value": budget.scope_value,
        "amount": str(budget.amount),
        "currency": budget.currency,
        "period_start": budget.period_start.isoformat() if budget.period_start else None,
        "period_end": budget.period_end.isoformat() if budget.period_end else None,
        "created_by": str(budget.created_by),
        "is_active": budget.is_active,
        "spent": str(spent),
        "remaining": str(remaining),
    }


async def _compute_spent(db: AsyncSession, budget: Budget) -> Decimal:
    """Compute total approved expense amount within a budget's scope."""
    conditions = [
        Expense.company_id == budget.company_id,
        Expense.status.in_(["approved", "reimbursed"]),
    ]

    if budget.scope_type == "category":
        conditions.append(Expense.category == budget.scope_value)
    if budget.period_start:
        conditions.append(Expense.expense_date >= budget.period_start)
    if budget.period_end:
        conditions.append(Expense.expense_date <= budget.period_end)

    q = select(func.coalesce(func.sum(Expense.converted_amount), 0)).where(and_(*conditions))
    result = await db.execute(q)
    return result.scalar() or Decimal("0")
