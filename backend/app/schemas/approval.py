"""Pydantic schemas for approval queue and actions.

Matches Section 27.7 of the build spec.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field


# ── Trigger Evaluation ────────────────────────────────────────────────

class TriggerEvaluationResponse(BaseModel):
    state: str  # pending | passed | failed
    passed_conditions: list[str] = Field(default_factory=list)
    failed_conditions: list[str] = Field(default_factory=list)


# ── Queue Item ────────────────────────────────────────────────────────

class ApprovalQueueItem(BaseModel):
    id: UUID  # instance id
    expense_id: UUID
    employee_name: str
    category: str
    status: str
    company_currency_amount: Optional[str] = None
    original_amount: str
    original_currency: str
    submitted_at: Optional[datetime] = None
    current_step_sequence: int
    trigger_evaluation: TriggerEvaluationResponse

    model_config = {"from_attributes": True}


# ── Action Request ────────────────────────────────────────────────────

class ApprovalActionRequest(BaseModel):
    comment: Optional[str] = None
    reason_code: Optional[str] = None


# ── Action Response ───────────────────────────────────────────────────

class ApprovalActionResponse(BaseModel):
    id: UUID
    instance_id: UUID
    step_sequence: int
    approver_id: UUID
    action: str
    comment: Optional[str] = None
    acted_at: datetime

    model_config = {"from_attributes": True}


# ── Instance detail ───────────────────────────────────────────────────

class ApprovalInstanceResponse(BaseModel):
    id: UUID
    expense_id: UUID
    policy_id: UUID
    resolved_manager_id: Optional[UUID] = None
    snapshot_steps: list[dict]
    snapshot_rules: list[dict]
    current_step_sequence: int
    status: str
    is_on_hold: str
    actions: list[ApprovalActionResponse] = Field(default_factory=list)
    trigger_evaluations: list[dict] = Field(default_factory=list)

    model_config = {"from_attributes": True}
