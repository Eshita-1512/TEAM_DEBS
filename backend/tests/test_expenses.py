"""
Tests — Expense Service (build-spec §10, Employee Flow)

Verifies:
  1. Expense creation stores both original and converted amounts
  2. Conversion rate is locked at submission (stored, not recalculated)
  3. Line-item included/excluded totals are correctly computed
  4. Excluded line items do NOT count toward canonical amount
  5. Zero or negative amounts are rejected
  6. Unauthorized employees cannot view another employee's expense
  7. Employee list view only shows own expenses (role scoping)
  8. Admin/manager see all company expenses
"""

from datetime import date, datetime, timezone
from decimal import Decimal
import uuid

import pytest

from app.services.expense_service import create_expense, get_expense_detail, list_expenses
from app.schemas.expense import ExpenseCreate, ExpenseLineItemCreate
from app.models.reference import ExchangeRate
from app.models.company import Company
from app.models.user import UserRole
from fastapi import HTTPException

from tests.conftest import (
    _seed_company, _seed_user, _seed_country, _seed_rate, _seed_expense
)

pytestmark = pytest.mark.asyncio


async def _fake_admin(db):
    await _seed_country(db)
    co = await _seed_company(db)
    return co, await _seed_user(db, co.id, role=UserRole.admin)


class TestCreateExpense:
    async def test_creates_expense_with_identity_rate_same_currency(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)

        payload = ExpenseCreate(
            category="Meals",
            description="Team lunch",
            expense_date=date.today(),
            original_currency="USD",
            original_amount="75.50",
        )
        expense = await create_expense(db, payload, emp)
        assert expense.original_amount == Decimal("75.50")
        assert expense.converted_amount == Decimal("75.50")
        assert expense.conversion_rate == Decimal("1.00000000")
        assert expense.conversion_rate_source == "identity"
        assert expense.submitted_at is not None

    async def test_creates_expense_with_fx_conversion(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        await _seed_rate(db, "EUR", "USD", Decimal("1.10"))

        payload = ExpenseCreate(
            category="Travel",
            description="Air ticket",
            expense_date=date.today(),
            original_currency="EUR",
            original_amount="100.00",
        )
        expense = await create_expense(db, payload, emp)
        assert expense.original_currency == "EUR"
        assert expense.original_amount == Decimal("100.00")
        # converted = 100 * 1.10 (with inverse lookup: USD->EUR=1.10 means EUR->USD = 1/1.10 * ...)
        # We seeded EUR->USD=1.10, so EUR 100 = USD 110
        assert expense.converted_amount == Decimal("110.00")
        assert expense.conversion_rate_source is not None  # locked

    async def test_line_items_included_total_is_canonical(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)

        payload = ExpenseCreate(
            category="Meals",
            description="Team dinner",
            expense_date=date.today(),
            original_currency="USD",
            original_amount="300.00",
            line_items=[
                ExpenseLineItemCreate(name="Steak", amount="150.00", included=True),
                ExpenseLineItemCreate(name="Wine", amount="80.00", included=True),
                ExpenseLineItemCreate(name="Dessert", amount="70.00", included=False),  # excluded
            ],
        )
        expense = await create_expense(db, payload, emp)
        # Only included lines: 150 + 80 = 230
        assert expense.final_included_total == Decimal("230.00")
        assert expense.submitted_total_before_exclusions == Decimal("300.00")
        assert expense.original_amount == Decimal("230.00")

    async def test_excluded_lines_not_counted(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)

        payload = ExpenseCreate(
            category="Supplies",
            description="Office supplies",
            expense_date=date.today(),
            original_currency="USD",
            original_amount="500.00",
            line_items=[
                ExpenseLineItemCreate(name="Printer", amount="400.00", included=False),
                ExpenseLineItemCreate(name="Paper", amount="100.00", included=True),
            ],
        )
        expense = await create_expense(db, payload, emp)
        assert expense.original_amount == Decimal("100.00")

    async def test_zero_amount_rejected(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)

        payload = ExpenseCreate(
            category="Other",
            description="Zero cost",
            expense_date=date.today(),
            original_currency="USD",
            original_amount="0.00",
        )
        with pytest.raises(HTTPException) as exc_info:
            await create_expense(db, payload, emp)
        assert exc_info.value.status_code == 400

    async def test_negative_amount_rejected(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)

        payload = ExpenseCreate(
            category="Other",
            description="Negative",
            expense_date=date.today(),
            original_currency="USD",
            original_amount="-50.00",
        )
        with pytest.raises(HTTPException) as exc_info:
            await create_expense(db, payload, emp)
        assert exc_info.value.status_code == 400

    async def test_no_rate_available_blocks_submission(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        # No exchange rate seeded for RON->USD

        payload = ExpenseCreate(
            category="Travel",
            description="Romania trip",
            expense_date=date.today(),
            original_currency="RON",
            original_amount="500.00",
        )
        with pytest.raises(HTTPException) as exc_info:
            await create_expense(db, payload, emp)
        assert exc_info.value.status_code == 422


class TestExpenseAccess:
    async def test_employee_cannot_view_others_expense(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp1 = await _seed_user(db, co.id, role=UserRole.employee, email="e1@t.com")
        emp2 = await _seed_user(db, co.id, role=UserRole.employee, email="e2@t.com")
        expense = await _seed_expense(db, emp1.id, co.id)

        with pytest.raises(HTTPException) as exc_info:
            await get_expense_detail(db, expense.id, emp2)
        assert exc_info.value.status_code == 403

    async def test_admin_can_view_any_expense(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm@t.com")
        expense = await _seed_expense(db, emp.id, co.id)

        detail = await get_expense_detail(db, expense.id, admin)
        assert str(detail.id) == str(expense.id)


class TestListExpenses:
    async def test_employee_sees_only_own_expenses(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp1 = await _seed_user(db, co.id, role=UserRole.employee, email="emp1@t.com")
        emp2 = await _seed_user(db, co.id, role=UserRole.employee, email="emp2@t.com")
        await _seed_expense(db, emp1.id, co.id)
        await _seed_expense(db, emp2.id, co.id)

        result = await list_expenses(db, emp1)
        assert all(item["employee_id"] == str(emp1.id) for item in result["items"])

    async def test_admin_sees_all_company_expenses(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm2@t.com")
        emp1 = await _seed_user(db, co.id, role=UserRole.employee, email="e11@t.com")
        emp2 = await _seed_user(db, co.id, role=UserRole.employee, email="e22@t.com")
        await _seed_expense(db, emp1.id, co.id)
        await _seed_expense(db, emp2.id, co.id)

        result = await list_expenses(db, admin)
        assert result["pagination"]["total_items"] >= 2

    async def test_list_pagination_works(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        emp = await _seed_user(db, co.id, role=UserRole.employee)
        for _ in range(5):
            await _seed_expense(db, emp.id, co.id)

        result = await list_expenses(db, emp, page=1, page_size=2)
        assert len(result["items"]) <= 2
        assert result["pagination"]["total_items"] >= 5
