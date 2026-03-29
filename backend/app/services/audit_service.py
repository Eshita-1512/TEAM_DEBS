"""Audit service — generic audit log writer.

Shared utility for all backend agents to emit audit events.
"""

from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog


async def log_event(
    db: AsyncSession,
    *,
    actor_id: Optional[UUID],
    action: str,
    entity_type: str,
    entity_id: Optional[UUID] = None,
    company_id: Optional[UUID] = None,
    details_before: Optional[dict] = None,
    details_after: Optional[dict] = None,
    compliance_note: Optional[str] = None,
) -> AuditLog:
    """Insert an immutable audit log entry."""
    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        company_id=company_id,
        details_before=details_before,
        details_after=details_after,
        compliance_note=compliance_note,
    )
    db.add(entry)
    await db.flush()
    return entry
