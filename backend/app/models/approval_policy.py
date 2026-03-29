"""Approval policy, step, and rule models.

These define the reusable approval workflow templates that admins configure.
"""

from sqlalchemy import Column, String, Boolean, Integer, Numeric, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class ApprovalPolicy(Base, UUIDMixin, TimestampMixin):
    """Reusable approval policy definition for a policy scope or expense type."""
    __tablename__ = "approval_policies"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_manager_approver = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    steps = relationship("ApprovalStep", back_populates="policy", lazy="selectin",
                         order_by="ApprovalStep.sequence", cascade="all, delete-orphan")
    rules = relationship("ApprovalRule", back_populates="policy", lazy="selectin",
                         cascade="all, delete-orphan")


class ApprovalStep(Base, UUIDMixin, TimestampMixin):
    """Sequential approval step within a policy.

    Each step defines one approver position in the chain.
    approver_type can be 'manager', 'specific_user', or 'role'.
    """
    __tablename__ = "approval_steps"

    policy_id = Column(UUID(as_uuid=True), ForeignKey("approval_policies.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    sequence = Column(Integer, nullable=False)
    approver_type = Column(String(30), nullable=False)  # manager | specific_user | role
    approver_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approver_role_label = Column(String(50), nullable=True)  # e.g. "finance", "cfo", "director"

    # Relationships
    policy = relationship("ApprovalPolicy", back_populates="steps")
    approver_user = relationship("User", lazy="selectin")


class ApprovalRule(Base, UUIDMixin, TimestampMixin):
    """Conditional approval rule within a policy.

    Supports: percentage, specific_approver, combined.
    For 'combined' rules, operator is AND or OR, and both percentage_threshold
    and specific_approver_user_id should be set.
    """
    __tablename__ = "approval_rules"

    policy_id = Column(UUID(as_uuid=True), ForeignKey("approval_policies.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    rule_type = Column(String(30), nullable=False)  # percentage | specific_approver | combined
    operator = Column(String(3), nullable=True)  # AND | OR (for combined rules)
    percentage_threshold = Column(Numeric(precision=5, scale=2), nullable=True)  # e.g., 0.67
    specific_approver_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    policy = relationship("ApprovalPolicy", back_populates="rules")
    specific_approver = relationship("User", lazy="selectin")
