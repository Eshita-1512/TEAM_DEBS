"""Approval policy router — thin layer delegating to approval_policy_service.

Endpoints:
  GET    /api/v1/approval-policies
  POST   /api/v1/approval-policies
  GET    /api/v1/approval-policies/{policy_id}
  PATCH  /api/v1/approval-policies/{policy_id}
  GET    /api/v1/approval-policies/{policy_id}/preview
"""

from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.permissions import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.approval_policy import (
    ApprovalPolicyCreate,
    ApprovalPolicyUpdate,
    ApprovalPolicyResponse,
)
from app.services import approval_policy_service
from app.pagination import paginate

router = APIRouter(prefix="/api/v1/approval-policies", tags=["Approval Policies"])


@router.get("")
async def list_policies(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all approval policies for the current company."""
    offset = (page - 1) * page_size
    items, total = await approval_policy_service.list_policies(
        db, current_user.company_id, offset, page_size
    )
    return paginate(
        [ApprovalPolicyResponse.from_model(p).model_dump() for p in items],
        total, page, page_size,
    )


@router.post("", status_code=201)
async def create_policy(
    data: ApprovalPolicyCreate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Create a new approval policy. Admin only."""
    policy = await approval_policy_service.create_policy(
        db, current_user.company_id, current_user.id, data
    )
    return {"data": ApprovalPolicyResponse.from_model(policy).model_dump()}


@router.get("/{policy_id}")
async def get_policy(
    policy_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single approval policy."""
    policy = await approval_policy_service.get_policy(db, policy_id, current_user.company_id)
    return {"data": ApprovalPolicyResponse.from_model(policy).model_dump()}


@router.patch("/{policy_id}")
async def update_policy(
    policy_id: UUID,
    data: ApprovalPolicyUpdate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Update an approval policy. Admin only."""
    policy = await approval_policy_service.update_policy(
        db, policy_id, current_user.company_id, current_user.id, data
    )
    return {"data": ApprovalPolicyResponse.from_model(policy).model_dump()}


@router.get("/{policy_id}/preview")
async def preview_policy(
    policy_id: UUID,
    employee_id: Optional[UUID] = Query(None, description="Employee to resolve manager for"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Preview the resolved approval chain for a policy and optional employee."""
    result = await approval_policy_service.preview_policy(
        db, policy_id, current_user.company_id, employee_id
    )
    return {"data": result}


@router.delete("/{policy_id}", status_code=204)
async def delete_policy(
    policy_id: UUID,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Delete an approval policy. Admin only."""
    await approval_policy_service.delete_policy(
        db, policy_id, current_user.company_id, current_user.id
    )
