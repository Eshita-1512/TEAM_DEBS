"""Approval policy service — CRUD for policies, steps, and rules.

Admin-only operations for configuring approval workflows.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID
from decimal import Decimal

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.approval_policy import ApprovalPolicy, ApprovalStep, ApprovalRule
from app.models.manager_assignment import ManagerAssignment
from app.models.user import User
from app.schemas.approval_policy import (
    ApprovalPolicyCreate,
    ApprovalPolicyUpdate,
    ApprovalStepCreate,
    ApprovalRuleCreate,
)
from app.services.audit_service import log_event


async def list_policies(
    db: AsyncSession,
    company_id: UUID,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[ApprovalPolicy], int]:
    """List all approval policies for a company."""
    conditions = [ApprovalPolicy.company_id == company_id]
    where = and_(*conditions)

    count_q = select(func.count()).select_from(ApprovalPolicy).where(where)
    total = (await db.execute(count_q)).scalar() or 0

    items_q = (
        select(ApprovalPolicy)
        .where(where)
        .options(selectinload(ApprovalPolicy.steps), selectinload(ApprovalPolicy.rules))
        .order_by(ApprovalPolicy.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(items_q)
    items = list(result.scalars().unique().all())
    return items, total


async def get_policy(db: AsyncSession, policy_id: UUID, company_id: UUID) -> ApprovalPolicy:
    """Get a single approval policy by ID."""
    q = (
        select(ApprovalPolicy)
        .where(ApprovalPolicy.id == policy_id, ApprovalPolicy.company_id == company_id)
        .options(selectinload(ApprovalPolicy.steps), selectinload(ApprovalPolicy.rules))
    )
    result = await db.execute(q)
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval policy not found")
    return policy


async def create_policy(
    db: AsyncSession,
    company_id: UUID,
    actor_id: UUID,
    data: ApprovalPolicyCreate,
) -> ApprovalPolicy:
    """Create a new approval policy with steps and rules."""
    policy = ApprovalPolicy(
        company_id=company_id,
        name=data.name,
        description=data.description,
        is_manager_approver=data.is_manager_approver,
    )
    db.add(policy)
    await db.flush()

    # Add steps
    for step_data in data.steps:
        step = ApprovalStep(
            policy_id=policy.id,
            sequence=step_data.sequence,
            approver_type=step_data.approver_type,
            approver_user_id=step_data.approver_user_id,
            approver_role_label=step_data.approver_role_label,
        )
        db.add(step)

    # Add rules
    for rule_data in data.rules:
        rule = ApprovalRule(
            policy_id=policy.id,
            rule_type=rule_data.type,
            operator=rule_data.operator,
            percentage_threshold=(
                Decimal(rule_data.percentage_threshold) if rule_data.percentage_threshold else None
            ),
            specific_approver_user_id=rule_data.specific_approver_user_id,
        )
        db.add(rule)

    await db.flush()

    # Audit
    await log_event(
        db,
        actor_id=actor_id,
        action="policy_created",
        entity_type="approval_policy",
        entity_id=policy.id,
        company_id=company_id,
        details_after={"name": data.name, "is_manager_approver": data.is_manager_approver},
    )

    # Refresh with relationships
    return await get_policy(db, policy.id, company_id)


async def update_policy(
    db: AsyncSession,
    policy_id: UUID,
    company_id: UUID,
    actor_id: UUID,
    data: ApprovalPolicyUpdate,
) -> ApprovalPolicy:
    """Update an existing approval policy."""
    policy = await get_policy(db, policy_id, company_id)
    before = {"name": policy.name, "is_manager_approver": policy.is_manager_approver,
              "is_active": policy.is_active}

    if data.name is not None:
        policy.name = data.name
    if data.description is not None:
        policy.description = data.description
    if data.is_manager_approver is not None:
        policy.is_manager_approver = data.is_manager_approver
    if data.is_active is not None:
        policy.is_active = data.is_active

    # Replace steps if provided
    if data.steps is not None:
        # Delete existing steps
        for step in list(policy.steps):
            await db.delete(step)
        await db.flush()
        # Add new steps
        for step_data in data.steps:
            step = ApprovalStep(
                policy_id=policy.id,
                sequence=step_data.sequence,
                approver_type=step_data.approver_type,
                approver_user_id=step_data.approver_user_id,
                approver_role_label=step_data.approver_role_label,
            )
            db.add(step)

    # Replace rules if provided
    if data.rules is not None:
        for rule in list(policy.rules):
            await db.delete(rule)
        await db.flush()
        for rule_data in data.rules:
            rule = ApprovalRule(
                policy_id=policy.id,
                rule_type=rule_data.type,
                operator=rule_data.operator,
                percentage_threshold=(
                    Decimal(rule_data.percentage_threshold) if rule_data.percentage_threshold else None
                ),
                specific_approver_user_id=rule_data.specific_approver_user_id,
            )
            db.add(rule)

    await db.flush()

    # Audit
    after = {"name": policy.name, "is_manager_approver": policy.is_manager_approver,
             "is_active": policy.is_active}
    await log_event(
        db,
        actor_id=actor_id,
        action="policy_updated",
        entity_type="approval_policy",
        entity_id=policy.id,
        company_id=company_id,
        details_before=before,
        details_after=after,
    )

    return await get_policy(db, policy_id, company_id)


async def preview_policy(
    db: AsyncSession,
    policy_id: UUID,
    company_id: UUID,
    employee_id: Optional[UUID] = None,
) -> dict:
    """Preview the resolved approval chain for a given policy and employee.

    If employee_id is provided and is_manager_approver is True, the resolved
    manager is shown as the first step.
    """
    policy = await get_policy(db, policy_id, company_id)
    resolved_steps = []

    # Resolve manager step if enabled
    if policy.is_manager_approver and employee_id:
        mgr_q = select(ManagerAssignment).where(
            ManagerAssignment.employee_id == employee_id,
            ManagerAssignment.is_active == True,
        )
        mgr_result = await db.execute(mgr_q)
        mgr_assignment = mgr_result.scalar_one_or_none()
        if mgr_assignment:
            # Fetch manager name
            mgr_user = await db.execute(select(User).where(User.id == mgr_assignment.manager_id))
            mgr = mgr_user.scalar_one_or_none()
            resolved_steps.append({
                "sequence": 0,
                "approver_type": "manager",
                "approver_user_id": str(mgr_assignment.manager_id),
                "approver_name": mgr.name if mgr else None,
                "approver_role_label": "manager",
                "source": "is_manager_approver",
            })

    # Add configured steps
    for step in policy.steps:
        step_info = {
            "sequence": step.sequence if not resolved_steps else step.sequence + 1,
            "approver_type": step.approver_type,
            "approver_user_id": str(step.approver_user_id) if step.approver_user_id else None,
            "approver_role_label": step.approver_role_label,
            "source": "policy_step",
        }
        # Resolve user name if specific user
        if step.approver_user_id:
            u_result = await db.execute(select(User).where(User.id == step.approver_user_id))
            u = u_result.scalar_one_or_none()
            step_info["approver_name"] = u.name if u else None
        resolved_steps.append(step_info)

    return {
        "policy_id": str(policy.id),
        "policy_name": policy.name,
        "is_manager_approver": policy.is_manager_approver,
        "resolved_steps": resolved_steps,
        "rules": [
            {
                "id": str(r.id),
                "type": r.rule_type,
                "operator": r.operator,
                "percentage_threshold": str(r.percentage_threshold) if r.percentage_threshold else None,
                "specific_approver_user_id": str(r.specific_approver_user_id) if r.specific_approver_user_id else None,
            }
            for r in policy.rules
        ],
    }


async def delete_policy(
    db: AsyncSession,
    policy_id: UUID,
    company_id: UUID,
    actor_id: UUID,
) -> None:
    """Delete an approval policy and its child records."""
    policy = await get_policy(db, policy_id, company_id)

    await log_event(
        db,
        actor_id=actor_id,
        action="policy_deleted",
        entity_type="approval_policy",
        entity_id=policy.id,
        company_id=company_id,
        details_before={
            "name": policy.name,
            "is_manager_approver": policy.is_manager_approver,
            "is_active": policy.is_active,
        },
    )

    await db.delete(policy)
    await db.flush()
