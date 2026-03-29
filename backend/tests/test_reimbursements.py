"""
Tests — Reimbursement Service (build-spec §14)

Verifies:
  1. list_reimbursements returns only approved/reimbursed expenses for the company
  2. create_reimbursement_batch groups expenses, updates status to 'batched'
  3. Double-batching is rejected
  4. Rejected expenses cannot be batched
  5. mark_batch_paid sets status=paid and updates each expense to 'reimbursed'
  6. Batch cannot be paid twice
  7. Batching expenses from another company is rejected
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.services import reimbursement_service
from app.models.expense import Expense
from app.enums import ExpenseStatus
from sqlalchemy import select

from tests.conftest import (
    _seed_company, _seed_user, _seed_country, _seed_expense
)
from app.models.user import UserRole

pytestmark = pytest.mark.asyncio


async def _approved_expense(db, employee_id, company_id, amount=Decimal("150.00")):
    """Seed an expense that is already approved and reimbursement_status=ready."""
    exp = Expense(
        employee_id=employee_id,
        company_id=company_id,
        category="Meals",
        description="Client lunch",
        expense_date=date.today(),
        status=ExpenseStatus.approved,
        original_currency="USD",
        original_amount=amount,
        company_currency="USD",
        converted_amount=amount,
        conversion_rate=Decimal("1.0"),
        conversion_rate_source="identity",
        conversion_rate_timestamp=datetime.now(timezone.utc),
        submitted_total_before_exclusions=amount,
        final_included_total=amount,
        submitted_at=datetime.now(timezone.utc),
        reimbursement_status="ready",
    )
    db.add(exp)
    await db.flush()
    return exp


class TestListReimbursements:
    async def test_returns_only_approved_or_reimbursed(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm@t.com")

        approved = await _approved_expense(db, emp.id, co.id)
        rejected = await _seed_expense(db, emp.id, co.id, status="rejected")

        items, total = await reimbursement_service.list_reimbursements(db, co.id)
        ids = [i["expense_id"] for i in items]
        assert str(approved.id) in ids
        assert str(rejected.id) not in ids


class TestCreateBatch:
    async def test_creates_batch_for_approved_expenses(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm2@t.com")

        exp1 = await _approved_expense(db, emp.id, co.id, Decimal("100.00"))
        exp2 = await _approved_expense(db, emp.id, co.id, Decimal("200.00"))

        result = await reimbursement_service.create_reimbursement_batch(
            db, co.id, admin.id, [exp1.id, exp2.id], reference="REF-001"
        )
        assert result["expense_count"] == 2
        assert Decimal(result["total_amount"]) == Decimal("300.00")
        assert result["status"] == "batched"

    async def test_rejected_expense_cannot_be_batched(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm3@t.com")

        rejected_exp = await _seed_expense(db, emp.id, co.id, status="rejected")

        with pytest.raises(HTTPException) as exc:
            await reimbursement_service.create_reimbursement_batch(
                db, co.id, admin.id, [rejected_exp.id]
            )
        assert exc.value.status_code == 400

    async def test_already_batched_expense_raises_400(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm4@t.com")

        exp = await _approved_expense(db, emp.id, co.id)
        await reimbursement_service.create_reimbursement_batch(db, co.id, admin.id, [exp.id])
        await db.flush()

        # Attempt to batch again
        with pytest.raises(HTTPException) as exc:
            await reimbursement_service.create_reimbursement_batch(db, co.id, admin.id, [exp.id])
        assert exc.value.status_code == 400

    async def test_cross_company_expense_rejected(self, db):
        await _seed_country(db)
        co1 = await _seed_company(db, name="Co1", currency="USD")
        co2 = await _seed_company(db, name="Co2", currency="USD")
        emp = await _seed_user(db, co1.id, role=UserRole.employee, email="e1@co1.com")
        admin = await _seed_user(db, co2.id, role=UserRole.admin, email="adm5@t.com")

        exp = await _approved_expense(db, emp.id, co1.id)

        # co2 tries to batch co1's expense
        with pytest.raises(HTTPException) as exc:
            await reimbursement_service.create_reimbursement_batch(
                db, co2.id, admin.id, [exp.id]
            )
        assert exc.value.status_code == 400

    async def test_empty_ids_raises_400(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm6@t.com")

        with pytest.raises(HTTPException) as exc:
            await reimbursement_service.create_reimbursement_batch(db, co.id, admin.id, [])
        assert exc.value.status_code == 400


class TestMarkBatchPaid:
    async def test_batch_paid_marks_expenses_reimbursed(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm7@t.com")

        exp = await _approved_expense(db, emp.id, co.id)
        batch_result = await reimbursement_service.create_reimbursement_batch(
            db, co.id, admin.id, [exp.id]
        )
        await db.flush()
        batch_id = uuid.UUID(batch_result["id"])

        paid_result = await reimbursement_service.mark_batch_paid(
            db, batch_id, co.id, admin.id
        )
        await db.flush()

        assert paid_result["status"] == "paid"

        exp_q = await db.execute(select(Expense).where(Expense.id == exp.id))
        exp_reloaded = exp_q.scalar_one()
        assert exp_reloaded.status == "reimbursed"
        assert exp_reloaded.reimbursement_status == "paid"
        assert exp_reloaded.paid_at is not None

    async def test_batch_cannot_be_paid_twice(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm8@t.com")

        exp = await _approved_expense(db, emp.id, co.id)
        batch = await reimbursement_service.create_reimbursement_batch(
            db, co.id, admin.id, [exp.id]
        )
        await db.flush()
        batch_id = uuid.UUID(batch["id"])

        await reimbursement_service.mark_batch_paid(db, batch_id, co.id, admin.id)
        await db.flush()

        with pytest.raises(HTTPException) as exc:
            await reimbursement_service.mark_batch_paid(db, batch_id, co.id, admin.id)
        assert exc.value.status_code == 400
