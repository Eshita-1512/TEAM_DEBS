"""Pydantic schemas for audit log and compliance export endpoints.

Matches Section 27.8 of the build spec.
"""

from __future__ import annotations

from typing import Optional, Any
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel


# ── Audit Log ─────────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: UUID
    actor_id: Optional[UUID] = None
    action: str
    entity_type: str
    entity_id: Optional[UUID] = None
    company_id: Optional[UUID] = None
    details_before: Optional[dict] = None
    details_after: Optional[dict] = None
    compliance_note: Optional[str] = None
    timestamp: datetime

    model_config = {"from_attributes": True}


class AuditLogFilter(BaseModel):
    action: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    actor_id: Optional[UUID] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    q: Optional[str] = None


# ── Compliance Export ─────────────────────────────────────────────────

class ComplianceExportCreate(BaseModel):
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    action_types: Optional[list[str]] = None
    entity_types: Optional[list[str]] = None


class ComplianceExportResponse(BaseModel):
    id: UUID
    company_id: UUID
    requested_by: UUID
    filters: Optional[dict] = None
    file_name: Optional[str] = None
    record_count: Optional[str] = None
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
