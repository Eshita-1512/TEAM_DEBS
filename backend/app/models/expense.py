"""Expense model — core expense record with currency normalization and line items.

Originally stubbed by BE-3 for approval/reimbursement queries.
Expanded by BE-2 with receipt FK, proper Enum status, Date type for expense_date,
and ExpenseLineItem model.
"""

from sqlalchemy import Column, String, Numeric, Date, DateTime, Enum, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin
from app.enums import ExpenseStatus


class Expense(Base, UUIDMixin, TimestampMixin):
    """Core expense record with locked currency conversion and line-item tracking."""
    __tablename__ = "expenses"

    employee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)

    # Core fields
    category = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    expense_date = Column(Date, nullable=False)
    status = Column(
        Enum(ExpenseStatus, name="expense_status"),
        nullable=False,
        default=ExpenseStatus.submitted,
        index=True,
    )

    # Currency fields (locked at submission)
    original_currency = Column(String(3), nullable=False)
    original_amount = Column(Numeric(precision=18, scale=2), nullable=False)
    company_currency = Column(String(3), nullable=True)
    converted_amount = Column(Numeric(precision=18, scale=2), nullable=True)
    conversion_rate = Column(Numeric(precision=18, scale=8), nullable=True)
    conversion_rate_source = Column(String(100), nullable=True)
    conversion_rate_timestamp = Column(DateTime(timezone=True), nullable=True)

    # Line-item totals
    submitted_total_before_exclusions = Column(Numeric(precision=18, scale=2), nullable=True)
    final_included_total = Column(Numeric(precision=18, scale=2), nullable=True)

    # Receipt reference (BE-2 owns)
    receipt_id = Column(UUID(as_uuid=True), ForeignKey("expense_receipts.id"), nullable=True)

    # Submission timestamp
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    # Reimbursement fields (BE-3 owned)
    reimbursement_status = Column(String(20), nullable=False, default="not_ready")
    reimbursement_amount = Column(Numeric(precision=18, scale=2), nullable=True)
    reimbursement_currency = Column(String(3), nullable=True)
    reimbursement_batch_id = Column(UUID(as_uuid=True), ForeignKey("reimbursement_batches.id"), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    employee = relationship("User", foreign_keys=[employee_id], lazy="selectin")
    company = relationship("Company", lazy="selectin")
    receipt = relationship("ExpenseReceipt", lazy="selectin")
    line_items = relationship("ExpenseLineItem", back_populates="expense", lazy="selectin")


class ExpenseLineItem(Base, UUIDMixin, TimestampMixin):
    """Employee-confirmed line item attached to a submitted expense."""
    __tablename__ = "expense_line_items"

    expense_id = Column(UUID(as_uuid=True), ForeignKey("expenses.id"), nullable=False, index=True)
    source_line_id = Column(UUID(as_uuid=True), ForeignKey("expense_receipt_lines.id"), nullable=True)
    name = Column(String(500), nullable=False)
    amount = Column(Numeric(precision=18, scale=2), nullable=False)
    category = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    included = Column(Boolean, default=True, nullable=False)

    # Relationships
    expense = relationship("Expense", back_populates="line_items")
    source_line = relationship("ExpenseReceiptLine", lazy="selectin")
