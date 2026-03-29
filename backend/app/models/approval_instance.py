"""Approval instance models — snapshotted per-expense workflow state.

Created at submission time so later manager/policy changes do not
mutate an in-flight workflow.
"""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin

from datetime import datetime, timezone


class ExpenseApprovalInstance(Base, UUIDMixin, TimestampMixin):
    """Snapshotted resolved workflow instance for a submitted expense.

    snapshot_steps and snapshot_rules are JSONB copies of the policy at
    the moment the expense was submitted, so that later policy edits
    don't affect in-flight expenses.
    """
    __tablename__ = "expense_approval_instances"

    expense_id = Column(UUID(as_uuid=True), ForeignKey("expenses.id"), nullable=False,
                        unique=True, index=True)
    policy_id = Column(UUID(as_uuid=True), ForeignKey("approval_policies.id"), nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)

    # Resolved manager for IS_MANAGER_APPROVER
    resolved_manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Snapshots of the policy at submission time
    snapshot_steps = Column(JSONB, nullable=False, default=list)
    snapshot_rules = Column(JSONB, nullable=False, default=list)

    # Current state
    current_step_sequence = Column(Integer, nullable=False, default=1)
    status = Column(String(30), nullable=False, default="pending_approval")
    is_on_hold = Column(String(1), nullable=False, default="N")  # Y/N
    held_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    expense = relationship("Expense", lazy="selectin")
    policy = relationship("ApprovalPolicy", lazy="selectin")
    resolved_manager = relationship("User", foreign_keys=[resolved_manager_id], lazy="selectin")
    held_by_user = relationship("User", foreign_keys=[held_by], lazy="selectin")
    actions = relationship("ApprovalAction", back_populates="instance",
                           lazy="selectin", order_by="ApprovalAction.acted_at")
    trigger_evaluations = relationship("ApprovalTriggerEvaluation", back_populates="instance",
                                       lazy="selectin", order_by="ApprovalTriggerEvaluation.evaluated_at")


class ApprovalAction(Base, UUIDMixin):
    """Recorded approval/reject/hold/resume event by an approver."""
    __tablename__ = "approval_actions"

    instance_id = Column(UUID(as_uuid=True), ForeignKey("expense_approval_instances.id",
                         ondelete="CASCADE"), nullable=False, index=True)
    step_sequence = Column(Integer, nullable=False)
    approver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action = Column(String(10), nullable=False)  # approve | reject | hold | resume
    comment = Column(Text, nullable=True)
    acted_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    instance = relationship("ExpenseApprovalInstance", back_populates="actions")
    approver = relationship("User", lazy="selectin")


class ApprovalTriggerEvaluation(Base, UUIDMixin):
    """Stored result of conditional rule evaluation per expense.

    Captures which conditions passed/failed after each approval action.
    """
    __tablename__ = "approval_trigger_evaluations"

    instance_id = Column(UUID(as_uuid=True), ForeignKey("expense_approval_instances.id",
                         ondelete="CASCADE"), nullable=False, index=True)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("approval_rules.id", ondelete="SET NULL"), nullable=True)
    state = Column(String(20), nullable=False, default="pending")  # pending | passed | failed
    passed_conditions = Column(JSONB, nullable=False, default=list)
    failed_conditions = Column(JSONB, nullable=False, default=list)
    evaluated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    instance = relationship("ExpenseApprovalInstance", back_populates="trigger_evaluations")
