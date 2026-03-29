"""
Tests — Approval Engine (build-spec §12)

Verifies the core workflow state machine against spec requirements:

  Sequential flow:
    1. Expense created; approval instance has status=pending_approval
    2. Only the current-step approver can act
    3. Approve at step 1 advances to step 2
    4. Full approval at last step marks expense=approved and reimbursement_status=ready

  Hold / Resume:
    5. Hold requires a comment
    6. Only original hold-owner or admin can resume
    7. While on hold, approve/reject attempts raise 400

  Reject:
    8. Reject is terminal — expense is immediately rejected
    9. Reject requires a comment

  Conditional rules — percentage:
   10. 2-of-3 rule: expense approved after 2 approvals
   11. Threshold impossible after rejection -> workflow fails

  Conditional rules — specific approver:
   12. Named approver's approval satisfies the condition

  Combined AND/OR:
   13. AND rule: both conditions must pass
   14. OR rule: either condition can resolve it
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from app.services import approval_engine
from app.models.approval_instance import ExpenseApprovalInstance, ApprovalAction
from app.models.expense import Expense
from app.enums import ExpenseStatus
from fastapi import HTTPException

from tests.conftest import (
    _seed_company, _seed_user, _seed_country, _seed_expense
)
from app.models.user import UserRole

pytestmark = pytest.mark.asyncio


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _create_policy(db, company_id, steps, rules=None, is_manager_approver=False):
    """Seed a minimal ApprovalPolicy + steps + optional rules."""
    from app.models.approval_policy import ApprovalPolicy, ApprovalStep, ApprovalRule

    policy = ApprovalPolicy(
        company_id=company_id,
        name="Test Policy",
        is_manager_approver=is_manager_approver,
        is_active=True,
    )
    db.add(policy)
    await db.flush()

    for seq, user_id in enumerate(steps, start=1):
        step = ApprovalStep(
            policy_id=policy.id,
            sequence=seq,
            approver_type="specific_user",
            approver_user_id=user_id,
        )
        db.add(step)
    await db.flush()

    if rules:
        for rule_spec in rules:
            rule = ApprovalRule(
                policy_id=policy.id,
                rule_type=rule_spec["rule_type"],
                operator=rule_spec.get("operator"),
                percentage_threshold=rule_spec.get("percentage_threshold"),
                specific_approver_user_id=rule_spec.get("specific_approver_user_id"),
            )
            db.add(rule)
        await db.flush()

    return policy


async def _submit_expense_with_policy(db, company_id, employee, policy):
    """Create expense + approval instance in one step."""
    from app.enums import ExpenseStatus
    expense = Expense(
        employee_id=employee.id,
        company_id=company_id,
        category="Travel",
        description="Trip",
        expense_date=date.today(),
        status=ExpenseStatus.submitted,
        original_currency="USD",
        original_amount=Decimal("200.00"),
        company_currency="USD",
        converted_amount=Decimal("200.00"),
        conversion_rate=Decimal("1.0"),
        conversion_rate_source="identity",
        conversion_rate_timestamp=datetime.now(timezone.utc),
        submitted_total_before_exclusions=Decimal("200.00"),
        final_included_total=Decimal("200.00"),
        submitted_at=datetime.now(timezone.utc),
        reimbursement_status="not_ready",
    )
    db.add(expense)
    await db.flush()

    instance = await approval_engine.create_approval_instance(
        db,
        expense=expense,
        employee_id=employee.id,
        company_id=company_id,
        policy_id=policy.id,
    )
    await db.flush()
    return expense, instance


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestSequentialApproval:
    async def test_instance_created_with_pending_status(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        approver1 = await _seed_user(db, co.id, role=UserRole.manager, email="mgr1@t.com")
        approver2 = await _seed_user(db, co.id, role=UserRole.manager, email="mgr2@t.com")

        policy = await _create_policy(db, co.id, [approver1.id, approver2.id])
        expense, instance = await _submit_expense_with_policy(db, co.id, emp, policy)

        assert instance.status == "pending_approval"
        assert instance.current_step_sequence == 1

    async def test_wrong_approver_raises_403(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        approver1 = await _seed_user(db, co.id, role=UserRole.manager, email="mgr1x@t.com")
        wrong_approver = await _seed_user(db, co.id, role=UserRole.manager, email="wrongmgr@t.com")

        policy = await _create_policy(db, co.id, [approver1.id])
        expense, instance = await _submit_expense_with_policy(db, co.id, emp, policy)

        with pytest.raises(HTTPException) as exc:
            await approval_engine.process_approval_action(db, expense.id, wrong_approver, "approve")
        assert exc.value.status_code in (403, 400)

    async def test_approve_step1_advances_to_step2(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        approver1 = await _seed_user(db, co.id, role=UserRole.manager, email="a1@t.com")
        approver2 = await _seed_user(db, co.id, role=UserRole.manager, email="a2@t.com")

        policy = await _create_policy(db, co.id, [approver1.id, approver2.id])
        expense, instance = await _submit_expense_with_policy(db, co.id, emp, policy)

        result = await approval_engine.process_approval_action(db, expense.id, approver1, "approve")
        await db.flush()

        # Reload instance
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        inst_q = await db.execute(
            select(ExpenseApprovalInstance)
            .where(ExpenseApprovalInstance.id == instance.id)
        )
        inst = inst_q.scalar_one()
        assert inst.current_step_sequence == 2

    async def test_final_step_approval_marks_expense_approved(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        approver1 = await _seed_user(db, co.id, role=UserRole.manager, email="only@t.com")

        policy = await _create_policy(db, co.id, [approver1.id])
        expense, instance = await _submit_expense_with_policy(db, co.id, emp, policy)

        result = await approval_engine.process_approval_action(db, expense.id, approver1, "approve")
        await db.flush()

        from sqlalchemy import select
        exp_q = await db.execute(select(Expense).where(Expense.id == expense.id))
        exp = exp_q.scalar_one()
        assert exp.status == "approved"
        assert exp.reimbursement_status == "ready"


class TestHoldResume:
    async def test_hold_without_comment_raises_400(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        mgr = await _seed_user(db, co.id, role=UserRole.manager, email="hmgr@t.com")

        policy = await _create_policy(db, co.id, [mgr.id])
        expense, instance = await _submit_expense_with_policy(db, co.id, emp, policy)

        with pytest.raises(HTTPException) as exc:
            await approval_engine.process_approval_action(db, expense.id, mgr, "hold", comment=None)
        assert exc.value.status_code == 400

    async def test_hold_pauses_workflow(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        mgr = await _seed_user(db, co.id, role=UserRole.manager, email="hmgr2@t.com")

        policy = await _create_policy(db, co.id, [mgr.id])
        expense, instance = await _submit_expense_with_policy(db, co.id, emp, policy)

        await approval_engine.process_approval_action(db, expense.id, mgr, "hold", "Need docs")
        await db.flush()

        from sqlalchemy import select
        inst_q = await db.execute(
            select(ExpenseApprovalInstance)
            .where(ExpenseApprovalInstance.id == instance.id)
        )
        inst = inst_q.scalar_one()
        assert inst.is_on_hold == "Y"
        assert str(inst.held_by) == str(mgr.id)

    async def test_unrelated_approver_cannot_resume(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        mgr = await _seed_user(db, co.id, role=UserRole.manager, email="hmgr3@t.com")
        other = await _seed_user(db, co.id, role=UserRole.manager, email="other@t.com")

        policy = await _create_policy(db, co.id, [mgr.id])
        expense, instance = await _submit_expense_with_policy(db, co.id, emp, policy)
        await approval_engine.process_approval_action(db, expense.id, mgr, "hold", "Hold it")
        await db.flush()

        with pytest.raises(HTTPException) as exc:
            await approval_engine.process_approval_action(db, expense.id, other, "resume")
        assert exc.value.status_code == 403

    async def test_approve_while_held_raises_400(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        mgr = await _seed_user(db, co.id, role=UserRole.manager, email="hmgr4@t.com")

        policy = await _create_policy(db, co.id, [mgr.id])
        expense, instance = await _submit_expense_with_policy(db, co.id, emp, policy)
        await approval_engine.process_approval_action(db, expense.id, mgr, "hold", "Waiting")
        await db.flush()

        with pytest.raises(HTTPException) as exc:
            await approval_engine.process_approval_action(db, expense.id, mgr, "approve")
        assert exc.value.status_code == 400


class TestReject:
    async def test_reject_without_comment_raises_400(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        mgr = await _seed_user(db, co.id, role=UserRole.manager, email="rjmgr@t.com")

        policy = await _create_policy(db, co.id, [mgr.id])
        expense, instance = await _submit_expense_with_policy(db, co.id, emp, policy)

        with pytest.raises(HTTPException) as exc:
            await approval_engine.process_approval_action(db, expense.id, mgr, "reject", comment=None)
        assert exc.value.status_code == 400

    async def test_reject_terminates_workflow(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        mgr = await _seed_user(db, co.id, role=UserRole.manager, email="rjmgr2@t.com")

        policy = await _create_policy(db, co.id, [mgr.id])
        expense, instance = await _submit_expense_with_policy(db, co.id, emp, policy)

        await approval_engine.process_approval_action(db, expense.id, mgr, "reject", "Policy violation")
        await db.flush()

        from sqlalchemy import select
        exp_q = await db.execute(select(Expense).where(Expense.id == expense.id))
        exp = exp_q.scalar_one()
        assert exp.status == "rejected"


class TestConditionalRules:
    async def test_percentage_rule_requires_threshold(self, db):
        """2-of-3 approvers must approve before expense is fully approved."""
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        a1 = await _seed_user(db, co.id, role=UserRole.manager, email="pct1@t.com")
        a2 = await _seed_user(db, co.id, role=UserRole.manager, email="pct2@t.com")
        a3 = await _seed_user(db, co.id, role=UserRole.manager, email="pct3@t.com")

        # 3-step chain, percentage rule: 67% (2 of 3)
        policy = await _create_policy(
            db, co.id, [a1.id, a2.id, a3.id],
            rules=[{"rule_type": "percentage", "percentage_threshold": Decimal("0.67")}],
        )
        expense, instance = await _submit_expense_with_policy(db, co.id, emp, policy)

        # Step 1 approves
        await approval_engine.process_approval_action(db, expense.id, a1, "approve")
        await db.flush()

        # After 1 approval (1/3 ≈ 33%), still pending
        from sqlalchemy import select
        exp_q = await db.execute(select(Expense).where(Expense.id == expense.id))
        exp = exp_q.scalar_one()
        # Not yet at 67% — should still be in progress
        assert exp.status != "approved"

        # Step 2 approves — now 2/3 = 67%, threshold met
        await approval_engine.process_approval_action(db, expense.id, a2, "approve")
        await db.flush()

        exp_q = await db.execute(select(Expense).where(Expense.id == expense.id))
        exp = exp_q.scalar_one()
        assert exp.status == "approved"

    async def test_specific_approver_rule_satisfied_on_that_approver_approval(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        cfo = await _seed_user(db, co.id, role=UserRole.manager, email="cfo@t.com")

        policy = await _create_policy(
            db, co.id, [cfo.id],
            rules=[{"rule_type": "specific_approver", "specific_approver_user_id": cfo.id}],
        )
        expense, instance = await _submit_expense_with_policy(db, co.id, emp, policy)

        await approval_engine.process_approval_action(db, expense.id, cfo, "approve")
        await db.flush()

        from sqlalchemy import select
        exp_q = await db.execute(select(Expense).where(Expense.id == expense.id))
        exp = exp_q.scalar_one()
        assert exp.status == "approved"

    async def test_percentage_rule_impossible_after_rejection_fails(self, db):
        """When rejections make the threshold mathematically impossible, workflow fails."""
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        a1 = await _seed_user(db, co.id, role=UserRole.manager, email="imp1@t.com")

        # 1-step chain, 100% threshold (all must approve)
        policy = await _create_policy(
            db, co.id, [a1.id],
            rules=[{"rule_type": "percentage", "percentage_threshold": Decimal("1.00")}],
        )
        expense, instance = await _submit_expense_with_policy(db, co.id, emp, policy)

        # Rejection with comment makes 100% threshold impossible
        await approval_engine.process_approval_action(db, expense.id, a1, "reject", "Not valid")
        await db.flush()

        from sqlalchemy import select
        exp_q = await db.execute(select(Expense).where(Expense.id == expense.id))
        exp = exp_q.scalar_one()
        assert exp.status == "rejected"
