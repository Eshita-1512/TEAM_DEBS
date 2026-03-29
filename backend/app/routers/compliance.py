"""Compliance export router.

Endpoints:
  GET  /api/v1/compliance-exports
  POST /api/v1/compliance-exports
"""

from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.permissions import require_role
from app.models.user import User, UserRole
from app.schemas.audit import ComplianceExportCreate, ComplianceExportResponse
from app.services import compliance_service
from app.pagination import paginate

router = APIRouter(prefix="/api/v1/compliance-exports", tags=["Compliance"])


@router.get("")
async def list_exports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """List compliance exports for the company. Admin only."""
    offset = (page - 1) * page_size
    items, total = await compliance_service.list_exports(
        db, current_user.company_id, offset, page_size
    )
    serialized = [ComplianceExportResponse.model_validate(item).model_dump(mode="json") for item in items]
    return paginate(serialized, total, page, page_size)


@router.post("", status_code=201)
async def create_export(
    data: ComplianceExportCreate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new compliance text log export. Admin only."""
    export = await compliance_service.create_export(
        db,
        company_id=current_user.company_id,
        actor_id=current_user.id,
        date_from=data.date_from,
        date_to=data.date_to,
        action_types=data.action_types,
        entity_types=data.entity_types,
    )
    return {"data": ComplianceExportResponse.model_validate(export).model_dump(mode="json")}
