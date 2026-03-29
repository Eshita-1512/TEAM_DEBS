"""Pydantic schemas for reimbursement endpoints."""

from __future__ import annotations

from typing import Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel


class ReimbursementItem(BaseModel):
    expense_id: UUID
    employee_id: UUID
    employee_name: str
    category: str
    original_amount: str
    original_currency: str
    company_currency_amount: str
    reimbursement_status: str
    reimbursement_amount: Optional[str] = None
    reimbursement_currency: Optional[str] = None
    paid_at: Optional[datetime] = None
    batch_id: Optional[UUID] = None

    model_config = {"from_attributes": True}


class ReimbursementBatchCreate(BaseModel):
    expense_ids: list[UUID]
    reference: Optional[str] = None


class ReimbursementBatchResponse(BaseModel):
    id: UUID
    company_id: UUID
    created_by: UUID
    status: str
    reference: Optional[str] = None
    expense_count: int
    total_amount: str
    currency: str
    created_at: datetime
    paid_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ReimbursementMarkPaid(BaseModel):
    paid_at: Optional[datetime] = None  # defaults to now if not provided
