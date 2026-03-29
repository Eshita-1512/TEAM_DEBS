"""ComplianceExport model — generated compliance text log export."""

from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import Base, UUIDMixin, TimestampMixin

from datetime import datetime, timezone


class ComplianceExport(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "compliance_exports"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    filters = Column(JSONB, nullable=True)  # date range, action types, etc.
    file_path = Column(Text, nullable=True)  # path to generated text file
    file_name = Column(String(255), nullable=True)
    record_count = Column(String(20), nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending | completed | failed
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
