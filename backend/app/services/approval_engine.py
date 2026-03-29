"""Approval engine — core rule evaluation and workflow state machine.

This is the heart of the approval system. It handles:
- Snapshot creation at submission time
- Sequential step progression
- Percentage, specific_approver, and combined (AND/OR) rule evaluation
- Hold/resume/reject/approve transitions
- Impossible-threshold detection
- On-hold freeze enforcement

All domain logic lives here — routers stay thin.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.approval_policy import ApprovalPolicy, ApprovalStep, ApprovalRule
from app.models.approval_instance import (
    ExpenseApprovalInstance,
    ApprovalAction,
    ApprovalTriggerEvaluation,
)
from app.models.expense import Expense
from app.models.manager_assignment import ManagerAssignment
from app.models.user import User
from app.services.audit_service import log_event


# ─── Snapshot Creation ────────────────────────────────────────────────

async def create_approval_instance(
    db: AsyncSession,
    expense: Expense,
    employee_id: UUID,
    company_id: UUID,
    policy_id: UUID,
) -> ExpenseApprovalInstance:
    """Create the snapshotted approval workflow instance at submission time.

    Resolves the employee's manager if the policy has is_manager_approver,
    then freezes the step chain and rules into JSONB snapshots so later
    policy/manager changes don't affect in-flight workflows.
    """
    # Load the policy with relationships
    q = (
        select(ApprovalPolicy)
        .where(ApprovalPolicy.id == policy_id)
        .options(selectinload(ApprovalPolicy.steps), selectinload(ApprovalPolicy.rules))
    )
    result = await db.execute(q)
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval policy not found")

    # Resolve manager
    resolved_manager_id = None
    snapshot_steps = []

    if policy.is_manager_approver:
        mgr_q = select(ManagerAssignment).where(
            ManagerAssignment.employee_id == employee_id,
            ManagerAssignment.is_active == True,
        )
        mgr_result = await db.execute(mgr_q)
        mgr_assignment = mgr_result.scalar_one_or_none()
        if mgr_assignment:
            resolved_manager_id = mgr_assignment.manager_id
            snapshot_steps.append({
                "sequence": 0,
                "approver_type": "manager",
                "approver_user_id": str(resolved_manager_id),
                "approver_role_label": "manager",
                "source": "is_manager_approver",
            })

    # Add configured steps (adjust sequence if manager step was prepended)
    offset = 1 if snapshot_steps else 0
    for step in sorted(policy.steps, key=lambda s: s.sequence):
        snapshot_steps.append({
            "sequence": step.sequence + offset,
            "approver_type": step.approver_type,
            "approver_user_id": str(step.approver_user_id) if step.approver_user_id else None,
            "approver_role_label": step.approver_role_label,
            "source": "policy_step",
            "step_id": str(step.id),
        })

    # Snapshot rules
    snapshot_rules = []
    for rule in policy.rules:
        snapshot_rules.append({
            "rule_id": str(rule.id),
            "rule_type": rule.rule_type,
            "operator": rule.operator,
            "percentage_threshold": str(rule.percentage_threshold) if rule.percentage_threshold else None,
            "specific_approver_user_id": str(rule.specific_approver_user_id) if rule.specific_approver_user_id else None,
        })

    instance = ExpenseApprovalInstance(
        expense_id=expense.id,
        policy_id=policy.id,
        company_id=company_id,
        resolved_manager_id=resolved_manager_id,
        snapshot_steps=snapshot_steps,
        snapshot_rules=snapshot_rules,
        current_step_sequence=snapshot_steps[0]["sequence"] if snapshot_steps else 0,
        status="pending_approval",
    )
    db.add(instance)
    await db.flush()

    # Initial trigger evaluation
    await _evaluate_and_store_triggers(db, instance)

    return instance


# ─── Action Processing ────────────────────────────────────────────────

async def process_approval_action(
    db: AsyncSession,
    expense_id: UUID,
    approver: User,
    action_type: str,
    comment: Optional[str] = None,
) -> dict:
    """Process an approval action (approve/reject/hold/resume).

    Enforces:
    - Only current-step approver can act
    - Hold freezes workflow
    - Only hold-owner or admin can resume
    - Reject is terminal
    - On each approve, evaluate conditional rules
    """
    # Load instance
    q = (
        select(ExpenseApprovalInstance)
        .where(ExpenseApprovalInstance.expense_id == expense_id)
        .options(
            selectinload(ExpenseApprovalInstance.actions),
            selectinload(ExpenseApprovalInstance.trigger_evaluations),
        )
    )
    result = await db.execute(q)
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Approval instance not found for this expense")

    # Load expense
    exp_result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = exp_result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    # Validate company match
    if instance.company_id != approver.company_id:
        raise HTTPException(status_code=403, detail="Not authorized for this company")

    # -- HOLD action --
    if action_type == "hold":
        return await _handle_hold(db, instance, expense, approver, comment)

    # -- RESUME action --
    if action_type == "resume":
        return await _handle_resume(db, instance, expense, approver, comment)

    # Guard: if on hold, no approval/rejection can proceed
    if instance.is_on_hold == "Y":
        raise HTTPException(
            status_code=400,
            detail="Expense is on hold. Resume it before taking further action.",
        )

    # -- REJECT action --
    if action_type == "reject":
        return await _handle_reject(db, instance, expense, approver, comment)

    # -- APPROVE action --
    if action_type == "approve":
        return await _handle_approve(db, instance, expense, approver, comment)

    raise HTTPException(status_code=400, detail=f"Unknown action type: {action_type}")


# ─── Hold ─────────────────────────────────────────────────────────────

async def _handle_hold(
    db: AsyncSession,
    instance: ExpenseApprovalInstance,
    expense: Expense,
    approver: User,
    comment: Optional[str],
) -> dict:
    if instance.status not in ("pending_approval",):
        raise HTTPException(status_code=400, detail="Only pending expenses can be put on hold")
    if not comment:
        raise HTTPException(status_code=400, detail="Comment is required when putting an expense on hold")

    # Verify approver is the current-step approver
    _verify_current_step_approver(instance, approver)

    instance.is_on_hold = "Y"
    instance.held_by = approver.id
    expense.status = "on_hold"

    action = ApprovalAction(
        instance_id=instance.id,
        step_sequence=instance.current_step_sequence,
        approver_id=approver.id,
        action="hold",
        comment=comment,
    )
    db.add(action)

    await log_event(
        db,
        actor_id=approver.id,
        action="hold",
        entity_type="expense",
        entity_id=expense.id,
        company_id=instance.company_id,
        details_after={"comment": comment, "step": instance.current_step_sequence},
    )

    await db.flush()
    return {"status": "on_hold", "message": "Expense put on hold"}


# ─── Resume ───────────────────────────────────────────────────────────

async def _handle_resume(
    db: AsyncSession,
    instance: ExpenseApprovalInstance,
    expense: Expense,
    approver: User,
    comment: Optional[str],
) -> dict:
    if instance.is_on_hold != "Y":
        raise HTTPException(status_code=400, detail="Expense is not on hold")

    # Only the holder or an admin can resume
    if instance.held_by != approver.id and approver.role.value != "admin":
        raise HTTPException(status_code=403, detail="Only the approver who held this expense or an admin can resume it")

    instance.is_on_hold = "N"
    instance.held_by = None
    expense.status = "pending_approval"

    action = ApprovalAction(
        instance_id=instance.id,
        step_sequence=instance.current_step_sequence,
        approver_id=approver.id,
        action="resume",
        comment=comment,
    )
    db.add(action)

    await log_event(
        db,
        actor_id=approver.id,
        action="resume",
        entity_type="expense",
        entity_id=expense.id,
        company_id=instance.company_id,
        details_after={"comment": comment},
    )

    await db.flush()
    return {"status": "pending_approval", "message": "Expense resumed"}


# ─── Reject ───────────────────────────────────────────────────────────

async def _handle_reject(
    db: AsyncSession,
    instance: ExpenseApprovalInstance,
    expense: Expense,
    approver: User,
    comment: Optional[str],
) -> dict:
    if instance.status not in ("pending_approval",):
        raise HTTPException(status_code=400, detail="Only pending expenses can be rejected")
    if not comment:
        raise HTTPException(status_code=400, detail="Comment is required when rejecting an expense")

    _verify_current_step_approver(instance, approver)

    instance.status = "rejected"
    expense.status = "rejected"

    action = ApprovalAction(
        instance_id=instance.id,
        step_sequence=instance.current_step_sequence,
        approver_id=approver.id,
        action="reject",
        comment=comment,
    )
    db.add(action)

    # Mark all trigger evaluations as failed
    for te in instance.trigger_evaluations:
        if te.state == "pending":
            te.state = "failed"
            te.failed_conditions.append("Rejected by approver")

    await log_event(
        db,
        actor_id=approver.id,
        action="rejection",
        entity_type="expense",
        entity_id=expense.id,
        company_id=instance.company_id,
        details_after={"comment": comment, "step": instance.current_step_sequence},
    )

    await db.flush()
    return {"status": "rejected", "message": "Expense rejected"}


# ─── Approve ──────────────────────────────────────────────────────────

async def _handle_approve(
    db: AsyncSession,
    instance: ExpenseApprovalInstance,
    expense: Expense,
    approver: User,
    comment: Optional[str],
) -> dict:
    if instance.status not in ("pending_approval",):
        raise HTTPException(status_code=400, detail="Only pending expenses can be approved")

    _verify_current_step_approver(instance, approver)

    # Record the approve action
    action = ApprovalAction(
        instance_id=instance.id,
        step_sequence=instance.current_step_sequence,
        approver_id=approver.id,
        action="approve",
        comment=comment,
    )
    db.add(action)
    await db.flush()

    # Reload actions
    actions_q = select(ApprovalAction).where(ApprovalAction.instance_id == instance.id)
    all_actions = list((await db.execute(actions_q)).scalars().all())

    # Evaluate conditional rules
    eval_result = await _evaluate_and_store_triggers(db, instance, all_actions)

    # Check if conditional rules say we're done
    if eval_result == "approved":
        instance.status = "approved"
        expense.status = "approved"
        expense.reimbursement_status = "ready"

        await log_event(
            db,
            actor_id=approver.id,
            action="approval",
            entity_type="expense",
            entity_id=expense.id,
            company_id=instance.company_id,
            details_after={
                "comment": comment,
                "step": instance.current_step_sequence,
                "final": True,
            },
        )
        await db.flush()
        return {"status": "approved", "message": "Expense fully approved"}

    if eval_result == "failed":
        instance.status = "rejected"
        expense.status = "rejected"

        await log_event(
            db,
            actor_id=approver.id,
            action="rejection",
            entity_type="expense",
            entity_id=expense.id,
            company_id=instance.company_id,
            details_after={"reason": "Conditional rule impossible to satisfy"},
        )
        await db.flush()
        return {"status": "rejected", "message": "Approval conditions can no longer be satisfied"}

    # Move to next sequential step if no conditional rules resolved the outcome
    steps = instance.snapshot_steps
    current_seq = instance.current_step_sequence
    next_steps = [s for s in steps if s["sequence"] > current_seq]

    if next_steps:
        instance.current_step_sequence = next_steps[0]["sequence"]
        await log_event(
            db,
            actor_id=approver.id,
            action="approval",
            entity_type="expense",
            entity_id=expense.id,
            company_id=instance.company_id,
            details_after={
                "comment": comment,
                "step": current_seq,
                "next_step": next_steps[0]["sequence"],
            },
        )
    else:
        # No more steps and conditional rules haven't decided — fully approved
        instance.status = "approved"
        expense.status = "approved"
        expense.reimbursement_status = "ready"

        await log_event(
            db,
            actor_id=approver.id,
            action="approval",
            entity_type="expense",
            entity_id=expense.id,
            company_id=instance.company_id,
            details_after={"comment": comment, "step": current_seq, "final": True},
        )

    await db.flush()
    return {"status": expense.status, "message": f"Step {current_seq} approved"}


# ─── Rule Evaluation Engine ──────────────────────────────────────────

async def _evaluate_and_store_triggers(
    db: AsyncSession,
    instance: ExpenseApprovalInstance,
    actions: Optional[list[ApprovalAction]] = None,
) -> str:
    """Evaluate conditional rules after each action.

    Returns: "approved", "failed", or "pending".

    Implements:
    - Percentage threshold: requires X of Y approvers to approve
    - Specific approver: requires a named approver to approve
    - Combined AND: all conditions must pass
    - Combined OR: any condition can pass
    - Impossible threshold detection
    """
    rules = instance.snapshot_rules
    if not rules:
        return "pending"  # no conditional rules — sequential only

    if actions is None:
        actions_q = select(ApprovalAction).where(ApprovalAction.instance_id == instance.id)
        actions = list((await db.execute(actions_q)).scalars().all())

    trigger_eval_q = select(ApprovalTriggerEvaluation).where(
        ApprovalTriggerEvaluation.instance_id == instance.id
    )
    existing_trigger_evaluations = list((await db.execute(trigger_eval_q)).scalars().all())

    steps = instance.snapshot_steps
    total_approvers = len(steps)
    approve_actions = [a for a in actions if a.action == "approve"]
    reject_actions = [a for a in actions if a.action == "reject"]
    approved_user_ids = {str(a.approver_id) for a in approve_actions}
    rejected_user_ids = {str(a.approver_id) for a in reject_actions}

    rule_results = []

    for rule_spec in rules:
        rule_type = rule_spec["rule_type"]
        rule_id = rule_spec.get("rule_id")
        passed_conditions = []
        failed_conditions = []
        state = "pending"

        if rule_type == "percentage":
            threshold = Decimal(rule_spec["percentage_threshold"]) if rule_spec.get("percentage_threshold") else Decimal("1.0")
            required_count = int((threshold * total_approvers).to_integral_value())
            if required_count < 1:
                required_count = 1

            current_approvals = len(approve_actions)
            current_rejections = len(reject_actions)
            remaining = total_approvers - current_approvals - current_rejections

            if current_approvals >= required_count:
                state = "passed"
                passed_conditions.append(
                    f"{current_approvals} of {total_approvers} approved (threshold: {threshold})"
                )
            elif current_approvals + remaining < required_count:
                # Mathematically impossible
                state = "failed"
                failed_conditions.append(
                    f"Only {current_approvals + remaining} possible approvals, need {required_count}"
                )
            else:
                passed_conditions.append(f"{current_approvals} of {required_count} needed so far")

        elif rule_type == "specific_approver":
            specific_id = rule_spec.get("specific_approver_user_id")
            if specific_id and specific_id in approved_user_ids:
                state = "passed"
                passed_conditions.append(f"Specific approver {specific_id} approved")
            elif specific_id and specific_id in rejected_user_ids:
                state = "failed"
                failed_conditions.append(f"Specific approver {specific_id} rejected")
            else:
                passed_conditions.append(f"Waiting for specific approver {specific_id}")

        elif rule_type == "combined":
            operator = rule_spec.get("operator", "AND")

            # Evaluate percentage sub-condition
            pct_state = "pending"
            threshold = Decimal(rule_spec["percentage_threshold"]) if rule_spec.get("percentage_threshold") else None
            if threshold is not None:
                required_count = int((threshold * total_approvers).to_integral_value())
                if required_count < 1:
                    required_count = 1
                current_approvals = len(approve_actions)
                current_rejections = len(reject_actions)
                remaining = total_approvers - current_approvals - current_rejections

                if current_approvals >= required_count:
                    pct_state = "passed"
                    passed_conditions.append(
                        f"Percentage: {current_approvals}/{total_approvers} (threshold {threshold})"
                    )
                elif current_approvals + remaining < required_count:
                    pct_state = "failed"
                    failed_conditions.append(
                        f"Percentage impossible: max {current_approvals + remaining}, need {required_count}"
                    )

            # Evaluate specific approver sub-condition
            spec_state = "pending"
            specific_id = rule_spec.get("specific_approver_user_id")
            if specific_id:
                if specific_id in approved_user_ids:
                    spec_state = "passed"
                    passed_conditions.append(f"Specific approver {specific_id} approved")
                elif specific_id in rejected_user_ids:
                    spec_state = "failed"
                    failed_conditions.append(f"Specific approver {specific_id} rejected")

            # Combine with operator
            if operator == "AND":
                sub_states = []
                if threshold is not None:
                    sub_states.append(pct_state)
                if specific_id:
                    sub_states.append(spec_state)

                if all(s == "passed" for s in sub_states):
                    state = "passed"
                elif any(s == "failed" for s in sub_states):
                    state = "failed"
                # else stays pending

            elif operator == "OR":
                sub_states = []
                if threshold is not None:
                    sub_states.append(pct_state)
                if specific_id:
                    sub_states.append(spec_state)

                if any(s == "passed" for s in sub_states):
                    state = "passed"
                elif all(s == "failed" for s in sub_states):
                    state = "failed"
                # else stays pending

        # Store / update trigger evaluation
        existing_te = None
        for te in existing_trigger_evaluations:
            if te.rule_id and str(te.rule_id) == rule_id:
                existing_te = te
                break

        if existing_te:
            existing_te.state = state
            existing_te.passed_conditions = passed_conditions
            existing_te.failed_conditions = failed_conditions
            existing_te.evaluated_at = datetime.now(timezone.utc)
        else:
            te = ApprovalTriggerEvaluation(
                instance_id=instance.id,
                rule_id=UUID(rule_id) if rule_id else None,
                state=state,
                passed_conditions=passed_conditions,
                failed_conditions=failed_conditions,
            )
            db.add(te)
            existing_trigger_evaluations.append(te)

        rule_results.append(state)

        # Audit the trigger evaluation
        await log_event(
            db,
            actor_id=None,
            action="trigger_evaluation",
            entity_type="approval_trigger",
            entity_id=instance.expense_id,
            company_id=instance.company_id,
            details_after={
                "rule_id": rule_id,
                "rule_type": rule_type,
                "state": state,
                "passed": passed_conditions,
                "failed": failed_conditions,
            },
        )

    await db.flush()

    # Determine overall outcome
    if all(r == "passed" for r in rule_results):
        return "approved"
    if any(r == "failed" for r in rule_results):
        # For AND logic with any failure, it's failed overall
        # For OR logic, only all-failed means failed
        # Since rules are policy-level, check if ANY remains possible
        if all(r == "failed" for r in rule_results):
            return "failed"
        # If some passed and some failed, check if any pending remain
        if "pending" not in rule_results and "passed" in rule_results:
            # Mixed: some passed, some failed — depends on policy
            # Default: if any rule failed, the overall is failed (AND semantics at policy level)
            return "failed"
    return "pending"


# ─── Approval Queue ──────────────────────────────────────────────────

async def get_approval_queue(
    db: AsyncSession,
    approver: User,
    offset: int = 0,
    limit: int = 20,
    status_filter: Optional[str] = None,
) -> tuple[list[dict], int]:
    """Get the approval queue for a given approver.

    Returns expenses where the approver is the current-step approver and
    the expense is pending_approval or on_hold.
    """
    from sqlalchemy import func as sa_func

    # Get all pending instances for this company
    conditions = [
        ExpenseApprovalInstance.company_id == approver.company_id,
        ExpenseApprovalInstance.status.in_(["pending_approval"]),
    ]

    q = (
        select(ExpenseApprovalInstance)
        .where(and_(*conditions))
        .options(
            selectinload(ExpenseApprovalInstance.expense),
            selectinload(ExpenseApprovalInstance.actions),
            selectinload(ExpenseApprovalInstance.trigger_evaluations),
        )
        .order_by(ExpenseApprovalInstance.created_at.asc())
    )
    result = await db.execute(q)
    all_instances = list(result.scalars().unique().all())

    # Filter to items where this approver is the current step approver
    queue_items = []
    for inst in all_instances:
        if _is_approver_for_current_step(inst, approver):
            expense = inst.expense
            if not expense:
                continue

            # Get employee name
            emp_result = await db.execute(select(User).where(User.id == expense.employee_id))
            emp = emp_result.scalar_one_or_none()

            # Build trigger eval summary
            trigger_eval = _build_trigger_summary(inst)

            queue_items.append({
                "id": str(inst.id),
                "expense_id": str(expense.id),
                "employee_name": emp.name if emp else "Unknown",
                "category": expense.category,
                "status": expense.status,
                "company_currency": expense.company_currency,
                "company_currency_amount": str(expense.converted_amount) if expense.converted_amount else None,
                "original_amount": str(expense.original_amount),
                "original_currency": expense.original_currency,
                "submitted_at": expense.submitted_at.isoformat() if expense.submitted_at else None,
                "current_step_sequence": inst.current_step_sequence,
                "trigger_evaluation": trigger_eval,
            })

    # Also include on-hold items this approver held
    on_hold_q = (
        select(ExpenseApprovalInstance)
        .where(
            ExpenseApprovalInstance.company_id == approver.company_id,
            ExpenseApprovalInstance.is_on_hold == "Y",
            ExpenseApprovalInstance.held_by == approver.id,
        )
        .options(
            selectinload(ExpenseApprovalInstance.expense),
            selectinload(ExpenseApprovalInstance.trigger_evaluations),
        )
    )
    on_hold_result = await db.execute(on_hold_q)
    for inst in on_hold_result.scalars().unique().all():
        expense = inst.expense
        if not expense:
            continue
        emp_result = await db.execute(select(User).where(User.id == expense.employee_id))
        emp = emp_result.scalar_one_or_none()
        trigger_eval = _build_trigger_summary(inst)

        queue_items.append({
            "id": str(inst.id),
            "expense_id": str(expense.id),
            "employee_name": emp.name if emp else "Unknown",
            "category": expense.category,
            "status": "on_hold",
            "company_currency": expense.company_currency,
            "company_currency_amount": str(expense.converted_amount) if expense.converted_amount else None,
            "original_amount": str(expense.original_amount),
            "original_currency": expense.original_currency,
            "submitted_at": expense.submitted_at.isoformat() if expense.submitted_at else None,
            "current_step_sequence": inst.current_step_sequence,
            "trigger_evaluation": trigger_eval,
        })

    total = len(queue_items)
    paginated = queue_items[offset: offset + limit]
    return paginated, total


async def get_approval_instance_for_expense(
    db: AsyncSession,
    expense_id: UUID,
    company_id: UUID,
) -> Optional[ExpenseApprovalInstance]:
    """Get the approval instance for a given expense."""
    q = (
        select(ExpenseApprovalInstance)
        .where(
            ExpenseApprovalInstance.expense_id == expense_id,
            ExpenseApprovalInstance.company_id == company_id,
        )
        .options(
            selectinload(ExpenseApprovalInstance.actions),
            selectinload(ExpenseApprovalInstance.trigger_evaluations),
        )
    )
    result = await db.execute(q)
    return result.scalar_one_or_none()


# ─── Helpers ──────────────────────────────────────────────────────────

def _verify_current_step_approver(instance: ExpenseApprovalInstance, approver: User) -> None:
    """Verify that the given user is the approver for the current step."""
    steps = instance.snapshot_steps
    current_seq = instance.current_step_sequence

    current_step = None
    for s in steps:
        if s["sequence"] == current_seq:
            current_step = s
            break

    if not current_step:
        raise HTTPException(status_code=400, detail="No current step found in approval chain")

    # Check if this approver matches the step
    approver_type = current_step.get("approver_type")
    step_user_id = current_step.get("approver_user_id")
    step_role = current_step.get("approver_role_label")

    is_authorized = False

    if approver_type == "manager" and step_user_id:
        is_authorized = str(approver.id) == step_user_id
    elif approver_type == "specific_user" and step_user_id:
        is_authorized = str(approver.id) == step_user_id
    elif approver_type == "role" and step_role:
        # Match by role label (e.g., user with role "manager" matches step with label "manager")
        is_authorized = approver.role.value == step_role

    # Admin can always act
    if approver.role.value == "admin":
        is_authorized = True

    if not is_authorized:
        raise HTTPException(
            status_code=403,
            detail=f"You are not the approver for step {current_seq}",
        )


def _is_approver_for_current_step(instance: ExpenseApprovalInstance, approver: User) -> bool:
    """Check if the approver matches the current step without raising exceptions."""
    steps = instance.snapshot_steps
    current_seq = instance.current_step_sequence

    current_step = None
    for s in steps:
        if s["sequence"] == current_seq:
            current_step = s
            break
    if not current_step:
        return False

    approver_type = current_step.get("approver_type")
    step_user_id = current_step.get("approver_user_id")
    step_role = current_step.get("approver_role_label")

    if approver_type == "manager" and step_user_id:
        return str(approver.id) == step_user_id
    elif approver_type == "specific_user" and step_user_id:
        return str(approver.id) == step_user_id
    elif approver_type == "role" and step_role:
        return approver.role.value == step_role

    # Admin sees all
    if approver.role.value == "admin":
        return True

    return False


def _build_trigger_summary(instance: ExpenseApprovalInstance) -> dict:
    """Build the trigger evaluation summary for a queue item."""
    if not instance.trigger_evaluations:
        return {"state": "pending", "passed_conditions": [], "failed_conditions": []}

    all_passed = []
    all_failed = []
    overall_state = "pending"

    for te in instance.trigger_evaluations:
        all_passed.extend(te.passed_conditions or [])
        all_failed.extend(te.failed_conditions or [])

    states = [te.state for te in instance.trigger_evaluations]
    if all(s == "passed" for s in states):
        overall_state = "passed"
    elif any(s == "failed" for s in states):
        overall_state = "failed"

    return {
        "state": overall_state,
        "passed_conditions": all_passed,
        "failed_conditions": all_failed,
    }
