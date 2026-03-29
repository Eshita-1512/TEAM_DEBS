"""Pydantic schemas for expense creation and retrieval — matching §27.5."""

from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ---- Request Schemas ----

class ExpenseLineItemCreate(BaseModel):
    """Single line item in an expense creation request."""
    source_line_id: Optional[UUID] = None
    name: str
    amount: str  # decimal string per §26.1
    category: Optional[str] = None
    description: Optional[str] = None
    included: bool = True


class ExpenseCreate(BaseModel):
    """Request body for POST /api/v1/expenses — matching §27.5."""
    category: str
    description: str
    expense_date: date
    original_currency: str
    original_amount: str  # decimal string per §26.1
    receipt_id: Optional[UUID] = None
    line_items: list[ExpenseLineItemCreate] = Field(default_factory=list)


# ---- Response Schemas ----

class ReceiptSummaryResponse(BaseModel):
    """Receipt summary embedded in expense detail."""
    id: UUID
    file_name: str
    ocr_status: str

    class Config:
        from_attributes = True


class ExpenseLineItemResponse(BaseModel):
    """Line item in expense detail response."""
    id: UUID
    source_line_id: Optional[UUID] = None
    name: str
    amount: str
    category: Optional[str] = None
    description: Optional[str] = None
    included: bool

    class Config:
        from_attributes = True


class ApprovalSummaryResponse(BaseModel):
    """Approval summary stub — populated by BE-3."""
    current_step_sequence: Optional[int] = None
    current_pending_approver_ids: list[UUID] = Field(default_factory=list)
    policy_id: Optional[UUID] = None


class ReimbursementSummaryResponse(BaseModel):
    """Reimbursement summary in expense detail."""
    status: str = "not_ready"
    amount: Optional[str] = None
    currency: Optional[str] = None
    paid_at: Optional[datetime] = None


class ExpenseDetailResponse(BaseModel):
    """Full expense detail matching §27.5 response shape."""
    id: UUID
    employee_id: UUID
    employee_name: str
    status: str
    category: str
    description: str
    expense_date: date
    original_currency: str
    original_amount: str
    company_currency: Optional[str] = None
    converted_amount: Optional[str] = None
    conversion_rate: Optional[str] = None
    conversion_rate_source: Optional[str] = None
    conversion_rate_timestamp: Optional[datetime] = None
    submitted_total_before_exclusions: Optional[str] = None
    final_included_total: Optional[str] = None
    receipt: Optional[ReceiptSummaryResponse] = None
    line_items: list[ExpenseLineItemResponse] = Field(default_factory=list)
    approval_summary: ApprovalSummaryResponse = Field(default_factory=ApprovalSummaryResponse)
    reimbursement: ReimbursementSummaryResponse = Field(default_factory=ReimbursementSummaryResponse)
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExpenseListItemResponse(BaseModel):
    """Compact expense item for list endpoints."""
    id: UUID
    employee_id: UUID
    employee_name: str
    status: str
    category: str
    description: str
    expense_date: date
    original_currency: str
    original_amount: str
    company_currency: Optional[str] = None
    converted_amount: Optional[str] = None
    submitted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TimelineEventResponse(BaseModel):
    """Single event in the expense timeline."""
    event_type: str
    actor_name: Optional[str] = None
    comment: Optional[str] = None
    timestamp: datetime
    details: Optional[dict] = None
