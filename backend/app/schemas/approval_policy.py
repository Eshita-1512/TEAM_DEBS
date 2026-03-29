"""Pydantic schemas for approval policy endpoints.

Matches Section 27.3 of the build spec exactly.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field


# ── Step Schemas ──────────────────────────────────────────────────────

class ApprovalStepCreate(BaseModel):
    sequence: int
    approver_type: str  # manager | specific_user | role
    approver_user_id: Optional[UUID] = None
    approver_role_label: Optional[str] = None


class ApprovalStepResponse(BaseModel):
    id: UUID
    sequence: int
    approver_type: str
    approver_user_id: Optional[UUID] = None
    approver_role_label: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Rule Schemas ──────────────────────────────────────────────────────

class ApprovalRuleCreate(BaseModel):
    type: str = Field(..., alias="rule_type")  # percentage | specific_approver | combined
    operator: Optional[str] = None  # AND | OR
    percentage_threshold: Optional[str] = None  # decimal string
    specific_approver_user_id: Optional[UUID] = None

    model_config = {"populate_by_name": True}


class ApprovalRuleResponse(BaseModel):
    id: UUID
    type: str = Field(..., alias="rule_type")
    operator: Optional[str] = None
    percentage_threshold: Optional[str] = None
    specific_approver_user_id: Optional[UUID] = None

    model_config = {"from_attributes": True, "populate_by_name": True}

    @classmethod
    def from_model(cls, rule) -> "ApprovalRuleResponse":
        return cls(
            id=rule.id,
            rule_type=rule.rule_type,
            operator=rule.operator,
            percentage_threshold=str(rule.percentage_threshold) if rule.percentage_threshold else None,
            specific_approver_user_id=rule.specific_approver_user_id,
        )


# ── Policy Schemas ────────────────────────────────────────────────────

class ApprovalPolicyCreate(BaseModel):
    name: str
    is_manager_approver: bool = False
    description: Optional[str] = None
    steps: list[ApprovalStepCreate] = []
    rules: list[ApprovalRuleCreate] = []


class ApprovalPolicyUpdate(BaseModel):
    name: Optional[str] = None
    is_manager_approver: Optional[bool] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    steps: Optional[list[ApprovalStepCreate]] = None
    rules: Optional[list[ApprovalRuleCreate]] = None


class ApprovalPolicyResponse(BaseModel):
    id: UUID
    name: str
    is_manager_approver: bool
    description: Optional[str] = None
    is_active: bool
    steps: list[ApprovalStepResponse] = []
    rules: list[ApprovalRuleResponse] = []

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, policy) -> "ApprovalPolicyResponse":
        return cls(
            id=policy.id,
            name=policy.name,
            is_manager_approver=policy.is_manager_approver,
            description=policy.description,
            is_active=policy.is_active,
            steps=[ApprovalStepResponse.model_validate(s) for s in (policy.steps or [])],
            rules=[ApprovalRuleResponse.from_model(r) for r in (policy.rules or [])],
        )


class ApprovalPolicyPreview(BaseModel):
    """Preview showing the resolved approval chain for a given employee."""
    policy_id: UUID
    policy_name: str
    is_manager_approver: bool
    resolved_steps: list[dict]
    rules: list[ApprovalRuleResponse]
