"""Pydantic schemas for analytics endpoints."""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class AnalyticsOverview(BaseModel):
    total_expenses: int
    total_submitted: int
    total_approved: int
    total_rejected: int
    total_pending: int
    total_on_hold: int
    total_reimbursed: int
    total_original_amount: str
    total_converted_amount: str
    currency: str


class CategoryBreakdown(BaseModel):
    category: str
    count: int
    total_amount: str
    percentage: str


class TimeSeriesPoint(BaseModel):
    period: str  # e.g. "2026-03", "2026-W13"
    count: int
    total_amount: str


class SpendPatternResponse(BaseModel):
    by_category: list[CategoryBreakdown] = []
    by_time_period: list[TimeSeriesPoint] = []
    anomalies: list[dict] = []  # rule-based flags


class IndividualSpend(BaseModel):
    user_id: str
    user_name: str
    total_amount: str
    expense_count: int
    top_category: Optional[str] = None
