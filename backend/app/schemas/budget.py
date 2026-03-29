"""Pydantic schemas for budget endpoints."""

from __future__ import annotations

from typing import Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel


class BudgetCreate(BaseModel):
    name: str
    scope_type: str  # department | category | period
    scope_value: str
    amount: str  # decimal string per spec
    currency: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None


class BudgetUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[str] = None
    is_active: Optional[bool] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None


class BudgetResponse(BaseModel):
    id: UUID
    company_id: UUID
    name: str
    scope_type: str
    scope_value: str
    amount: str
    currency: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    created_by: UUID
    is_active: bool
    spent: Optional[str] = None  # computed field: total approved expenses in scope
    remaining: Optional[str] = None  # computed field

    model_config = {"from_attributes": True}
