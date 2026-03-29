"""Reimbursement service — list reimbursable expenses and batch processing."""

from __future__ import annotations

from typing import Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timezone

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.expense import Expense
from app.models.reimbursement import ReimbursementBatch
from app.models.user import User
from app.services.audit_service import log_event


async def list_reimbursements(
    db: AsyncSession,
    company_id: UUID,
    offset: int = 0,
    limit: int = 20,
    reimbursement_status: Optional[str] = None,
) -> tuple[list[dict], int]:
    """List expenses with their reimbursement status.

    Filters to approved/reimbursed expenses by default.
    """
    conditions = [
        Expense.company_id == company_id,
        Expense.status.in_(["approved", "reimbursed"]),
    ]
    if reimbursement_status:
        conditions.append(Expense.reimbursement_status == reimbursement_status)

    where = and_(*conditions)

    count_q = select(func.count()).select_from(Expense).where(where)
    total = (await db.execute(count_q)).scalar() or 0

    items_q = (
        select(Expense)
        .where(where)
        .order_by(Expense.submitted_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(items_q)
    expenses = list(result.scalars().all())

    items = []
    for exp in expenses:
        # Fetch employee name
        emp_result = await db.execute(select(User).where(User.id == exp.employee_id))
        emp = emp_result.scalar_one_or_none()

        items.append({
            "expense_id": str(exp.id),
            "employee_id": str(exp.employee_id),
            "employee_name": emp.name if emp else "Unknown",
            "category": exp.category,
            "original_amount": str(exp.original_amount),
            "original_currency": exp.original_currency,
            "company_currency": exp.company_currency,
            "company_currency_amount": str(exp.converted_amount) if exp.converted_amount else "0",
            "reimbursement_status": exp.reimbursement_status,
            "reimbursement_amount": str(exp.reimbursement_amount) if exp.reimbursement_amount else None,
            "reimbursement_currency": exp.reimbursement_currency,
            "paid_at": exp.paid_at.isoformat() if exp.paid_at else None,
            "batch_id": str(exp.reimbursement_batch_id) if exp.reimbursement_batch_id else None,
        })

    return items, total


async def create_reimbursement_batch(
    db: AsyncSession,
    company_id: UUID,
    actor_id: UUID,
    expense_ids: list[UUID],
    reference: Optional[str] = None,
) -> dict:
    """Create a reimbursement batch for a set of approved expenses.

    Guards:
    - All expenses must belong to the same company
    - All expenses must be in 'approved' status with reimbursement_status 'ready'
    - No double-batching
    """
    if not expense_ids:
        raise HTTPException(status_code=400, detail="No expense IDs provided")

    # Load and validate expenses
    q = select(Expense).where(
        Expense.id.in_(expense_ids),
        Expense.company_id == company_id,
    )
    result = await db.execute(q)
    expenses = list(result.scalars().all())

    if len(expenses) != len(expense_ids):
        raise HTTPException(status_code=400, detail="One or more expenses not found in this company")

    # Validate all are ready for reimbursement
    for exp in expenses:
        if exp.status != "approved":
            raise HTTPException(
                status_code=400,
                detail=f"Expense {exp.id} is not approved (status: {exp.status})",
            )
        if exp.reimbursement_status not in ("ready", "not_ready"):
            raise HTTPException(
                status_code=400,
                detail=f"Expense {exp.id} already in reimbursement process (status: {exp.reimbursement_status})",
            )

    # Fetch company currency for the batch
    company_currency = expenses[0].company_currency or expenses[0].original_currency

    # Create batch
    batch = ReimbursementBatch(
        company_id=company_id,
        created_by=actor_id,
        status="batched",
        reference=reference,
    )
    db.add(batch)
    await db.flush()

    # Update expenses
    total_amount = Decimal("0")
    for exp in expenses:
        exp.reimbursement_status = "batched"
        exp.reimbursement_batch_id = batch.id
        exp.reimbursement_amount = exp.converted_amount or exp.original_amount
        exp.reimbursement_currency = company_currency
        total_amount += exp.reimbursement_amount or Decimal("0")

    await db.flush()

    # Audit
    await log_event(
        db,
        actor_id=actor_id,
        action="reimbursement",
        entity_type="reimbursement_batch",
        entity_id=batch.id,
        company_id=company_id,
        details_after={
            "expense_count": len(expenses),
            "total_amount": str(total_amount),
            "reference": reference,
        },
    )

    return {
        "id": str(batch.id),
        "company_id": str(company_id),
        "created_by": str(actor_id),
        "status": batch.status,
        "reference": batch.reference,
        "expense_count": len(expenses),
        "total_amount": str(total_amount),
        "currency": company_currency,
        "created_at": batch.created_at.isoformat() if batch.created_at else datetime.now(timezone.utc).isoformat(),
        "paid_at": None,
    }


async def mark_batch_paid(
    db: AsyncSession,
    batch_id: UUID,
    company_id: UUID,
    actor_id: UUID,
    paid_at: Optional[datetime] = None,
) -> dict:
    """Mark a reimbursement batch as paid."""
    q = select(ReimbursementBatch).where(
        ReimbursementBatch.id == batch_id,
        ReimbursementBatch.company_id == company_id,
    )
    result = await db.execute(q)
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Reimbursement batch not found")

    if batch.status == "paid":
        raise HTTPException(status_code=400, detail="Batch already marked as paid")

    paid_time = paid_at or datetime.now(timezone.utc)
    batch.status = "paid"
    batch.paid_at = paid_time

    # Update all expenses in this batch
    exp_q = select(Expense).where(Expense.reimbursement_batch_id == batch_id)
    exp_result = await db.execute(exp_q)
    expenses = list(exp_result.scalars().all())

    for exp in expenses:
        exp.reimbursement_status = "paid"
        exp.status = "reimbursed"
        exp.paid_at = paid_time

    await db.flush()

    # Audit
    await log_event(
        db,
        actor_id=actor_id,
        action="reimbursement",
        entity_type="reimbursement_batch",
        entity_id=batch.id,
        company_id=company_id,
        details_after={"status": "paid", "paid_at": paid_time.isoformat(), "expense_count": len(expenses)},
    )

    return {
        "id": str(batch.id),
        "status": "paid",
        "paid_at": paid_time.isoformat(),
        "expense_count": len(expenses),
    }
