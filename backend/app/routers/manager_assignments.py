"""Manager assignments router — admin-only CRUD for manager-employee relationships.

Endpoints:
  GET   /api/v1/manager-assignments
  POST  /api/v1/manager-assignments
  PATCH /api/v1/manager-assignments/{assignment_id}
"""

from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.permissions import require_permission
from app.models.user import User
from app.schemas.manager_assignment import (
    ManagerAssignmentCreate,
    ManagerAssignmentUpdate,
    ManagerAssignmentResponse,
)
from app.services import manager_service

router = APIRouter(prefix="/api/v1/manager-assignments", tags=["Manager Assignments"])


@router.get("")
async def list_assignments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    """List manager assignments for the company (admin only)."""
    return await manager_service.list_assignments(
        db, current_user.company_id, page=page, page_size=page_size
    )


@router.post("", status_code=201)
async def create_assignment(
    req: ManagerAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    """Create a new manager assignment (admin only)."""
    result = await manager_service.create_assignment(
        db,
        current_user.company_id,
        current_user.id,
        employee_id=UUID(req.employee_id),
        manager_id=UUID(req.manager_id),
    )
    return {"data": result}


@router.patch("/{assignment_id}")
async def update_assignment(
    assignment_id: UUID,
    req: ManagerAssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    """Update a manager assignment (admin only)."""
    result = await manager_service.update_assignment(
        db,
        assignment_id,
        current_user.company_id,
        current_user.id,
        manager_id=UUID(req.manager_id) if req.manager_id else None,
        is_active=req.is_active,
    )
    return {"data": result}
