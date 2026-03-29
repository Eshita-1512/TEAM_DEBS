"""Audit query service — extends BE-1's audit_service with query capabilities.

BE-1 owns the core log_event function. This module adds query/filter/export
support needed by the audit-log and compliance-export routers.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID
from datetime import datetime

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def query_audit_logs(
    db: AsyncSession,
    *,
    company_id: UUID,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    actor_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    q: Optional[str] = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[AuditLog], int]:
    """Query audit logs with filtering and pagination.

    Returns (items, total_count).
    """
    conditions = [AuditLog.company_id == company_id]

    if action:
        conditions.append(AuditLog.action == action)
    if entity_type:
        conditions.append(AuditLog.entity_type == entity_type)
    if entity_id:
        conditions.append(AuditLog.entity_id == entity_id)
    if actor_id:
        conditions.append(AuditLog.actor_id == actor_id)
    if date_from:
        conditions.append(AuditLog.timestamp >= date_from)
    if date_to:
        conditions.append(AuditLog.timestamp <= date_to)
    if q:
        conditions.append(
            or_(
                AuditLog.action.ilike(f"%{q}%"),
                AuditLog.entity_type.ilike(f"%{q}%"),
                AuditLog.compliance_note.ilike(f"%{q}%"),
            )
        )

    where_clause = and_(*conditions)

    # Count
    count_q = select(func.count()).select_from(AuditLog).where(where_clause)
    total = (await db.execute(count_q)).scalar() or 0

    # Items
    items_q = (
        select(AuditLog)
        .where(where_clause)
        .order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(items_q)
    items = list(result.scalars().all())

    return items, total
