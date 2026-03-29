"""Expense service — creation, retrieval, currency conversion, and line-item handling.

Handles expense creation from manual or extracted input, locks conversion rates,
computes line-item totals, and provides employee-scoped list/detail endpoints.

Owned by BE-2.
"""

from __future__ import annotations

import math
import uuid
import logging
from datetime import datetime, timezone, date as date_type
from decimal import Decimal, InvalidOperation
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.enums import ExpenseStatus
from app.models.expense import Expense, ExpenseLineItem
from app.models.manager_assignment import ManagerAssignment
from app.models.receipt import ExpenseReceipt
from app.models.user import User, UserRole
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseDetailResponse,
    ExpenseListItemResponse,
    ExpenseLineItemResponse,
    ReceiptSummaryResponse,
    ApprovalSummaryResponse,
    ReimbursementSummaryResponse,
    TimelineEventResponse,
)
from app.services.currency_service import convert_amount
from app.services.audit_service import log_event

logger = logging.getLogger(__name__)


async def create_expense(
    db: AsyncSession,
    data: ExpenseCreate,
    current_user: User,
) -> Expense:
    """Create a new expense with locked currency conversion.

    Handles both manual entry and OCR-extracted submissions.
    """
    now = datetime.now(timezone.utc)

    # ---- Parse amount ----
    try:
        original_amount = Decimal(data.original_amount)
    except (InvalidOperation, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid original_amount format. Must be a decimal string.",
        )

    if original_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="original_amount must be positive.",
        )

    # ---- Validate receipt if provided ----
    receipt = None
    if data.receipt_id:
        stmt = select(ExpenseReceipt).where(ExpenseReceipt.id == data.receipt_id)
        result = await db.execute(stmt)
        receipt = result.scalar_one_or_none()
        if receipt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Referenced receipt not found.",
            )
        if receipt.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Receipt does not belong to your company.",
            )

    # ---- Currency conversion ----
    company_currency = current_user.company.default_currency if current_user.company else None
    converted_amount = None
    conversion_rate = None
    conversion_rate_source = None
    conversion_rate_timestamp = None

    if company_currency:
        if data.original_currency.upper() == company_currency.upper():
            converted_amount = original_amount
            conversion_rate = Decimal("1.00000000")
            conversion_rate_source = "identity"
            conversion_rate_timestamp = now
        else:
            conversion_result = await convert_amount(
                db, original_amount, data.original_currency, company_currency
            )
            if conversion_result is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"No exchange rate available for {data.original_currency} -> {company_currency}. Submission blocked.",
                )
            converted_amount, rate_info = conversion_result
            conversion_rate = rate_info.rate
            conversion_rate_source = rate_info.source
            conversion_rate_timestamp = rate_info.effective_date

    # ---- Process line items ----
    line_items = []
    submitted_total_before_exclusions = Decimal("0")
    final_included_total = Decimal("0")

    if data.line_items:
        for item_data in data.line_items:
            try:
                item_amount = Decimal(item_data.amount)
            except (InvalidOperation, ValueError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid amount for line item '{item_data.name}'.",
                )

            submitted_total_before_exclusions += item_amount
            if item_data.included:
                final_included_total += item_amount

            line_item = ExpenseLineItem(
                id=uuid.uuid4(),
                source_line_id=item_data.source_line_id,
                name=item_data.name,
                amount=item_amount,
                category=item_data.category,
                description=item_data.description,
                included=item_data.included,
            )
            line_items.append(line_item)

        # If line items are used, the canonical amount is the included total
        original_amount = final_included_total
    else:
        submitted_total_before_exclusions = original_amount
        final_included_total = original_amount

    # ---- Re-convert if line items changed the canonical amount ----
    if data.line_items and company_currency and data.original_currency.upper() != company_currency.upper():
        conversion_result = await convert_amount(
            db, original_amount, data.original_currency, company_currency
        )
        if conversion_result:
            converted_amount, rate_info = conversion_result
            conversion_rate = rate_info.rate
            conversion_rate_source = rate_info.source
            conversion_rate_timestamp = rate_info.effective_date

    # ---- Create expense ----
    expense = Expense(
        id=uuid.uuid4(),
        employee_id=current_user.id,
        company_id=current_user.company_id,
        original_amount=original_amount,
        original_currency=data.original_currency.upper(),
        conversion_rate=conversion_rate,
        conversion_rate_source=conversion_rate_source,
        conversion_rate_timestamp=conversion_rate_timestamp,
        converted_amount=converted_amount,
        company_currency=company_currency,
        submitted_total_before_exclusions=submitted_total_before_exclusions,
        final_included_total=final_included_total,
        category=data.category,
        description=data.description,
        expense_date=data.expense_date,
        status=ExpenseStatus.submitted,
        receipt_id=data.receipt_id,
        submitted_at=now,
    )
    db.add(expense)
    await db.flush()

    # Attach line items
    for li in line_items:
        li.expense_id = expense.id
        db.add(li)
    await db.flush()

    # ---- Audit log ----
    await log_event(
        db,
        actor_id=current_user.id,
        action="expense_submitted",
        entity_type="expense",
        entity_id=expense.id,
        company_id=current_user.company_id,
        details_after={
            "category": data.category,
            "original_amount": str(original_amount),
            "original_currency": data.original_currency,
            "converted_amount": str(converted_amount) if converted_amount else None,
            "line_items_count": len(line_items),
        },
    )

    return expense


async def get_expense_detail(
    db: AsyncSession,
    expense_id: uuid.UUID,
    current_user: User,
) -> ExpenseDetailResponse:
    """Fetch full expense detail with authorization."""
    stmt = (
        select(Expense)
        .options(
            selectinload(Expense.employee),
            selectinload(Expense.receipt),
            selectinload(Expense.line_items),
            selectinload(Expense.company),
        )
        .where(Expense.id == expense_id)
    )
    result = await db.execute(stmt)
    expense = result.scalar_one_or_none()

    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")

    _authorize_expense_access(expense, current_user)

    return _build_detail_response(expense)


async def list_expenses(
    db: AsyncSession,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[str] = None,
    category: Optional[str] = None,
    date_from: Optional[date_type] = None,
    date_to: Optional[date_type] = None,
    q: Optional[str] = None,
    sort_by: Optional[str] = "submitted_at",
    sort_order: Optional[str] = "desc",
) -> dict:
    """List expenses with pagination and filtering, scoped by role."""
    conditions = []

    # Role-based scoping
    if current_user.role == UserRole.employee:
        conditions.append(Expense.employee_id == current_user.id)
    elif current_user.role == UserRole.manager:
        # Managers should only see their own expenses and direct reports' expenses.
        subordinate_ids_result = await db.execute(
            select(ManagerAssignment.employee_id).where(
                and_(
                    ManagerAssignment.manager_id == current_user.id,
                    ManagerAssignment.is_active == True,
                )
            )
        )
        subordinate_ids = list(subordinate_ids_result.scalars().all())
        conditions.append(
            or_(
                Expense.employee_id == current_user.id,
                Expense.employee_id.in_(subordinate_ids),
            )
        )
    else:
        # Admin sees all company expenses
        conditions.append(Expense.company_id == current_user.company_id)

    if status_filter:
        conditions.append(Expense.status == status_filter)
    if category:
        conditions.append(Expense.category == category)
    if date_from:
        conditions.append(Expense.expense_date >= date_from)
    if date_to:
        conditions.append(Expense.expense_date <= date_to)
    if q:
        conditions.append(
            or_(
                Expense.description.ilike(f"%{q}%"),
                Expense.category.ilike(f"%{q}%"),
            )
        )

    # Count query
    count_stmt = select(func.count(Expense.id)).where(and_(*conditions))
    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    # Data query
    data_stmt = (
        select(Expense)
        .options(selectinload(Expense.employee))
        .where(and_(*conditions))
    )

    # Sorting
    sort_field = sort_by or "submitted_at"
    sort_column = getattr(Expense, sort_field, Expense.submitted_at)
    if sort_order == "asc":
        data_stmt = data_stmt.order_by(sort_column.asc())
    else:
        data_stmt = data_stmt.order_by(sort_column.desc())

    # Pagination
    offset = (page - 1) * page_size
    data_stmt = data_stmt.offset(offset).limit(page_size)

    result = await db.execute(data_stmt)
    expenses = result.scalars().all()

    items = [_build_list_item(exp) for exp in expenses]

    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total,
            "total_pages": math.ceil(total / page_size) if page_size > 0 else 0,
        },
    }


async def get_expense_timeline(
    db: AsyncSession,
    expense_id: uuid.UUID,
    current_user: User,
) -> list[TimelineEventResponse]:
    """Return workflow timeline events for an expense.

    For BE-2, this returns the submission event. BE-3 will add approval events.
    """
    # First verify the expense exists and user has access
    stmt = (
        select(Expense)
        .options(selectinload(Expense.employee))
        .where(Expense.id == expense_id)
    )
    result = await db.execute(stmt)
    expense = result.scalar_one_or_none()

    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")

    _authorize_expense_access(expense, current_user)

    events = []

    # Submission event
    if expense.submitted_at:
        employee_name = expense.employee.name if expense.employee else "Unknown"
        events.append(TimelineEventResponse(
            event_type="submitted",
            actor_name=employee_name,
            comment=None,
            timestamp=expense.submitted_at,
            details={
                "original_amount": str(expense.original_amount),
                "original_currency": expense.original_currency,
            },
        ))

    # TODO: BE-3 will add approval/rejection/hold/resume events from ApprovalAction records

    return events


async def get_approval_instance(
    db: AsyncSession,
    expense_id: uuid.UUID,
    current_user: User,
) -> dict:
    """Return approval workflow instance for an expense.

    Stub endpoint — BE-3 owns the full approval workflow.
    Returns a minimal structure that the frontend can consume.
    """
    stmt = select(Expense).where(Expense.id == expense_id)
    result = await db.execute(stmt)
    expense = result.scalar_one_or_none()

    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")

    _authorize_expense_access(expense, current_user)

    return {
        "data": {
            "expense_id": str(expense.id),
            "current_step_sequence": None,
            "current_pending_approver_ids": [],
            "policy_id": None,
            "steps": [],
        }
    }


# ---- Helper Functions ----

def _authorize_expense_access(expense: Expense, user: User) -> None:
    """Verify user has access to view this expense."""
    if user.role == UserRole.admin:
        if expense.company_id != user.company_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return

    if user.role == UserRole.manager:
        if expense.company_id != user.company_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return

    # Employee can only see their own expenses
    if expense.employee_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


def _decimal_str(val) -> Optional[str]:
    """Convert Decimal or None to string."""
    if val is None:
        return None
    return str(val)


def _build_detail_response(expense: Expense) -> ExpenseDetailResponse:
    """Build the §27.5 expense detail response."""
    receipt_summary = None
    if expense.receipt:
        receipt_summary = ReceiptSummaryResponse(
            id=expense.receipt.id,
            file_name=expense.receipt.file_name,
            ocr_status=expense.receipt.ocr_status.value if hasattr(expense.receipt.ocr_status, 'value') else str(expense.receipt.ocr_status),
        )

    line_items = [
        ExpenseLineItemResponse(
            id=li.id,
            source_line_id=li.source_line_id,
            name=li.name,
            amount=str(li.amount),
            category=li.category,
            description=li.description,
            included=li.included,
        )
        for li in (expense.line_items or [])
    ]

    reimbursement = ReimbursementSummaryResponse(
        status=expense.reimbursement_status or "not_ready",
        amount=_decimal_str(expense.reimbursement_amount),
        currency=expense.reimbursement_currency,
        paid_at=expense.paid_at,
    )

    employee_name = expense.employee.name if expense.employee else "Unknown"

    return ExpenseDetailResponse(
        id=expense.id,
        employee_id=expense.employee_id,
        employee_name=employee_name,
        status=expense.status.value if hasattr(expense.status, 'value') else str(expense.status),
        category=expense.category,
        description=expense.description,
        expense_date=expense.expense_date,
        original_currency=expense.original_currency,
        original_amount=str(expense.original_amount),
        company_currency=expense.company_currency,
        converted_amount=_decimal_str(expense.converted_amount),
        conversion_rate=_decimal_str(expense.conversion_rate),
        conversion_rate_source=expense.conversion_rate_source,
        conversion_rate_timestamp=expense.conversion_rate_timestamp,
        submitted_total_before_exclusions=_decimal_str(expense.submitted_total_before_exclusions),
        final_included_total=_decimal_str(expense.final_included_total),
        receipt=receipt_summary,
        line_items=line_items,
        approval_summary=ApprovalSummaryResponse(),
        reimbursement=reimbursement,
        submitted_at=expense.submitted_at,
        created_at=expense.created_at,
        updated_at=expense.updated_at,
    )


def _build_list_item(expense: Expense) -> dict:
    """Build a compact expense list item."""
    employee_name = expense.employee.name if expense.employee else "Unknown"
    return {
        "id": str(expense.id),
        "employee_id": str(expense.employee_id),
        "employee_name": employee_name,
        "status": expense.status.value if hasattr(expense.status, 'value') else str(expense.status),
        "category": expense.category,
        "description": expense.description,
        "expense_date": expense.expense_date.isoformat() if expense.expense_date else None,
        "original_currency": expense.original_currency,
        "original_amount": str(expense.original_amount),
        "company_currency": expense.company_currency,
        "converted_amount": _decimal_str(expense.converted_amount),
        "submitted_at": expense.submitted_at.isoformat() if expense.submitted_at else None,
    }
