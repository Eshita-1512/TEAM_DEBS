"""Audit log router.

Endpoint:
  GET /api/v1/audit-logs
"""

from typing import Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.permissions import require_role
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogResponse
from app.services import audit_query_service
from app.pagination import paginate

router = APIRouter(prefix="/api/v1/audit-logs", tags=["Audit"])


@router.get("")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[UUID] = Query(None),
    actor_id: Optional[UUID] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    q: Optional[str] = Query(None),
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """List audit logs with filters. Admin only."""
    offset = (page - 1) * page_size
    items, total = await audit_query_service.query_audit_logs(
        db,
        company_id=current_user.company_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        q=q,
        offset=offset,
        limit=page_size,
    )
    serialized = [AuditLogResponse.model_validate(item).model_dump(mode="json") for item in items]
    return paginate(serialized, total, page, page_size)
