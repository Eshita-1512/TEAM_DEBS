"""Analytics router.

Endpoints:
  GET /api/v1/analytics/overview
  GET /api/v1/analytics/spend-patterns
"""

from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.permissions import require_role
from app.models.user import User, UserRole
from app.services import analytics_service

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


@router.get("/overview")
async def get_overview(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Get analytics overview for the company. Admin only."""
    result = await analytics_service.get_overview(db, current_user.company_id)
    return {"data": result}


@router.get("/spend-patterns")
async def get_spend_patterns(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Get spend pattern analysis with anomaly detection. Admin only."""
    result = await analytics_service.get_spend_patterns(
        db, current_user.company_id, date_from, date_to
    )
    return {"data": result}
