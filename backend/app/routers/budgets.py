"""Budget router.

Endpoints:
  GET  /api/v1/budgets
  POST /api/v1/budgets
  GET  /api/v1/budgets/{budget_id}
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.permissions import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.budget import BudgetCreate
from app.services import budget_service
from app.pagination import paginate

router = APIRouter(prefix="/api/v1/budgets", tags=["Budgets"])


@router.get("")
async def list_budgets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    """List budgets with spent/remaining calculations."""
    offset = (page - 1) * page_size
    items, total = await budget_service.list_budgets(
        db, current_user.company_id, offset, page_size
    )
    return paginate(items, total, page, page_size)


@router.post("", status_code=201)
async def create_budget(
    data: BudgetCreate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Create a new budget. Admin only."""
    budget = await budget_service.create_budget(
        db,
        company_id=current_user.company_id,
        actor_id=current_user.id,
        name=data.name,
        scope_type=data.scope_type,
        scope_value=data.scope_value,
        amount=data.amount,
        currency=data.currency,
        period_start=data.period_start,
        period_end=data.period_end,
    )
    result = await budget_service.get_budget(db, budget.id, current_user.company_id)
    return {"data": result}


@router.get("/{budget_id}")
async def get_budget(
    budget_id: UUID,
    current_user: User = Depends(require_role(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    """Get budget details with spent/remaining."""
    result = await budget_service.get_budget(db, budget_id, current_user.company_id)
    return {"data": result}
