"""AuditLog model — immutable action history.

Shared model available for all backend agents to use.
"""

from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.types import JSON
CustomJSONB = JSONB().with_variant(JSON(), "sqlite")
from app.models.base import Base, UUIDMixin

import uuid
from datetime import datetime, timezone


class AuditLog(Base, UUIDMixin):
    __tablename__ = "audit_logs"

    actor_id = Column(UUID(as_uuid=True), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(100), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    company_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    details_before = Column(CustomJSONB, nullable=True)
    details_after = Column(CustomJSONB, nullable=True)
    compliance_note = Column(Text, nullable=True)
    timestamp = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
