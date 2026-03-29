"""Reimbursement router.

Endpoints:
  GET  /api/v1/reimbursements
  POST /api/v1/reimbursements/batches
  POST /api/v1/reimbursements/batches/{batch_id}/pay
"""

from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.permissions import require_role
from app.models.user import User, UserRole
from app.schemas.reimbursement import ReimbursementBatchCreate, ReimbursementMarkPaid
from app.services import reimbursement_service
from app.pagination import paginate

router = APIRouter(prefix="/api/v1/reimbursements", tags=["Reimbursements"])


@router.get("")
async def list_reimbursements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by reimbursement_status"),
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """List reimbursable expenses. Admin only."""
    offset = (page - 1) * page_size
    items, total = await reimbursement_service.list_reimbursements(
        db, current_user.company_id, offset, page_size, status
    )
    return paginate(items, total, page, page_size)


@router.post("/batches", status_code=201)
async def create_batch(
    data: ReimbursementBatchCreate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Create a reimbursement batch from approved expenses. Admin only."""
    result = await reimbursement_service.create_reimbursement_batch(
        db,
        company_id=current_user.company_id,
        actor_id=current_user.id,
        expense_ids=data.expense_ids,
        reference=data.reference,
    )
    return {"data": result}


@router.post("/batches/{batch_id}/pay")
async def mark_batch_paid(
    batch_id: UUID,
    data: ReimbursementMarkPaid,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Mark a reimbursement batch as paid. Admin only."""
    result = await reimbursement_service.mark_batch_paid(
        db,
        batch_id=batch_id,
        company_id=current_user.company_id,
        actor_id=current_user.id,
        paid_at=data.paid_at,
    )
    return {"data": result}
