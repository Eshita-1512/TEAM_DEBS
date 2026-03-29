"""Canonical enums shared across BE-3 modules.

These enums mirror the build-spec section 26 contracts exactly.
UserRole is defined in app.models.user (BE-1 owned) and re-exported here
for convenience.
"""

import enum


class ExpenseStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    pending_approval = "pending_approval"
    on_hold = "on_hold"
    approved = "approved"
    rejected = "rejected"
    reimbursed = "reimbursed"


class ApprovalActionType(str, enum.Enum):
    approve = "approve"
    reject = "reject"
    hold = "hold"
    resume = "resume"


class ReimbursementStatus(str, enum.Enum):
    not_ready = "not_ready"
    ready = "ready"
    batched = "batched"
    paid = "paid"


class RuleType(str, enum.Enum):
    sequential = "sequential"
    percentage = "percentage"
    specific_approver = "specific_approver"
    combined = "combined"


class RuleOperator(str, enum.Enum):
    AND = "AND"
    OR = "OR"


class ApproverType(str, enum.Enum):
    manager = "manager"
    specific_user = "specific_user"
    role = "role"


class AuditActionType(str, enum.Enum):
    expense_submitted = "expense_submitted"
    ocr_extraction_confirmed = "ocr_extraction_confirmed"
    approval = "approval"
    rejection = "rejection"
    hold = "hold"
    resume = "resume"
    trigger_evaluation = "trigger_evaluation"
    reimbursement = "reimbursement"
    role_change = "role_change"
    approval_rule_change = "approval_rule_change"
    manager_relationship_change = "manager_relationship_change"
    line_inclusion_change = "line_inclusion_change"
    compliance_export = "compliance_export"
    budget_created = "budget_created"
    budget_updated = "budget_updated"
    policy_created = "policy_created"
    policy_updated = "policy_updated"
    user_created = "user_created"
    user_deleted = "user_deleted"


class BudgetScopeType(str, enum.Enum):
    department = "department"
    category = "category"
    period = "period"


class ComplianceExportStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


class OcrStatus(str, enum.Enum):
    """Processing status of a receipt's OCR pipeline."""
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class OcrStage(str, enum.Enum):
    """Individual stage within the OCR pipeline."""
    raw_ocr = "raw_ocr"
    llm_interpretation = "llm_interpretation"
    llm_structured = "llm_structured"
    regex_validated = "regex_validated"

