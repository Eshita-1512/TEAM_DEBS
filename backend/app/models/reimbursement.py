"""Reimbursement batch model — grouping for bulk reimbursement processing."""

from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin, TimestampMixin

from datetime import datetime, timezone


class ReimbursementBatch(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "reimbursement_batches"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="batched")  # batched | paid
    paid_at = Column(DateTime(timezone=True), nullable=True)
    reference = Column(String(255), nullable=True)  # optional batch reference

    # Note: Expenses link to this batch via expense.reimbursement_batch_id
