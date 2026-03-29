"""Expense submission and employee history endpoints — §27.5.

Thin router that delegates to expense_service.
Owned by BE-2.
"""

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.pagination import SingleResponse
from app.schemas.expense import ExpenseCreate, ExpenseDetailResponse
from app.services import expense_service

router = APIRouter(prefix="/api/v1/expenses", tags=["Expenses"])


@router.post("", response_model=SingleResponse, status_code=201)
async def create_expense(
    data: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create and submit an expense.

    Accepts manual entry or OCR-extracted input with line items.
    Locks the conversion rate at submission time.
    """
    expense = await expense_service.create_expense(db, data, current_user)
    detail = await expense_service.get_expense_detail(db, expense.id, current_user)
    return {"data": detail}


@router.get("")
async def list_expenses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by expense status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    date_from: Optional[date] = Query(None, description="Start date filter"),
    date_to: Optional[date] = Query(None, description="End date filter"),
    q: Optional[str] = Query(None, description="Search description or category"),
    sort_by: Optional[str] = Query("submitted_at", description="Sort field"),
    sort_order: Optional[str] = Query("desc", regex="^(asc|desc)$"),
):
    """List expenses with pagination and filtering.

    Scoped by role: employees see own expenses, managers/admins see company expenses.
    """
    result = await expense_service.list_expenses(
        db, current_user,
        page=page, page_size=page_size,
        status_filter=status, category=category,
        date_from=date_from, date_to=date_to,
        q=q, sort_by=sort_by, sort_order=sort_order,
    )
    return result


@router.get("/{expense_id}", response_model=SingleResponse)
async def get_expense(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full expense detail including receipt, line items, and approval summary."""
    detail = await expense_service.get_expense_detail(db, expense_id, current_user)
    return {"data": detail}


@router.get("/{expense_id}/timeline")
async def get_expense_timeline(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get workflow timeline events for an expense."""
    events = await expense_service.get_expense_timeline(db, expense_id, current_user)
    return {"data": events}


@router.get("/{expense_id}/approval-instance")
async def get_approval_instance(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get approval workflow instance for an expense.

    Stub endpoint — BE-3 owns the full approval workflow.
    """
    return await expense_service.get_approval_instance(db, expense_id, current_user)
