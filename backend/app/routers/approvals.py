"""Approval queue and actions router — thin layer delegating to approval_engine.

Endpoints:
  GET  /api/v1/approvals/queue
  POST /api/v1/approvals/{expense_id}/approve
  POST /api/v1/approvals/{expense_id}/reject
  POST /api/v1/approvals/{expense_id}/hold
  POST /api/v1/approvals/{expense_id}/resume
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.permissions import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.approval import ApprovalActionRequest
from app.services import approval_engine
from app.pagination import paginate

router = APIRouter(prefix="/api/v1/approvals", tags=["Approvals"])


@router.get("/queue")
async def get_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None, description="Filter by status"),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    """Get the approval queue for the current user."""
    offset = (page - 1) * page_size
    items, total = await approval_engine.get_approval_queue(
        db, current_user, offset, page_size, status
    )
    return paginate(items, total, page, page_size)


@router.post("/{expense_id}/approve")
async def approve_expense(
    expense_id: UUID,
    data: ApprovalActionRequest,
    current_user: User = Depends(require_role(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    """Approve an expense at the current step."""
    result = await approval_engine.process_approval_action(
        db, expense_id, current_user, "approve", data.comment
    )
    return {"data": result}


@router.post("/{expense_id}/reject")
async def reject_expense(
    expense_id: UUID,
    data: ApprovalActionRequest,
    current_user: User = Depends(require_role(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    """Reject an expense. Comment is required."""
    result = await approval_engine.process_approval_action(
        db, expense_id, current_user, "reject", data.comment
    )
    return {"data": result}


@router.post("/{expense_id}/hold")
async def hold_expense(
    expense_id: UUID,
    data: ApprovalActionRequest,
    current_user: User = Depends(require_role(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    """Put an expense on hold. Comment is required."""
    result = await approval_engine.process_approval_action(
        db, expense_id, current_user, "hold", data.comment
    )
    return {"data": result}


@router.post("/{expense_id}/resume")
async def resume_expense(
    expense_id: UUID,
    data: ApprovalActionRequest,
    current_user: User = Depends(require_role(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    """Resume a held expense. Only the holder or admin can resume."""
    result = await approval_engine.process_approval_action(
        db, expense_id, current_user, "resume", data.comment
    )
    return {"data": result}
