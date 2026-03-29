"""
Tests — User Management, Roles, and Permissions (build-spec §9)

Verifies:
  1. Admin can create employees and managers
  2. Duplicate email raises 409
  3. Admin can change a user's role via update_user()
  4. Admin can deactivate a user via delete_user()
  5. list_users is scoped to the admin's company
  6. Admin cannot deactivate themself
"""

import pytest
from tests.conftest import _seed_country, _seed_company, _seed_user
from app.models.user import UserRole
from app.services.user_service import create_user, list_users, update_user, delete_user
from fastapi import HTTPException
from sqlalchemy import select
from app.models.user import User

pytestmark = pytest.mark.asyncio


class TestUserManagement:
    async def test_admin_can_create_employee(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm@users.com")

        result = await create_user(
            db,
            company_id=co.id,
            admin_id=admin.id,
            name="New Employee",
            email="newemp@users.com",
            password="Pass123!",
            role="employee",
        )
        assert result["role"] == "employee"

    async def test_admin_can_create_manager(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm2@users.com")

        result = await create_user(
            db,
            company_id=co.id,
            admin_id=admin.id,
            name="New Manager",
            email="newmgr@users.com",
            password="Pass123!",
            role="manager",
        )
        assert result["role"] == "manager"

    async def test_duplicate_email_raises_409(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm3@users.com")
        existing_emp = await _seed_user(db, co.id, role=UserRole.employee, email="taken@users.com")

        with pytest.raises(HTTPException) as exc:
            await create_user(
                db,
                company_id=co.id,
                admin_id=admin.id,
                name="Dupe",
                email="taken@users.com",
                password="Pass123!",
                role="employee",
            )
        assert exc.value.status_code == 409

    async def test_invalid_role_raises_400(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm4@users.com")

        with pytest.raises(HTTPException) as exc:
            await create_user(
                db,
                company_id=co.id,
                admin_id=admin.id,
                name="Bad Role",
                email="badrole@users.com",
                password="Pass123!",
                role="superuser",   # invalid role
            )
        assert exc.value.status_code == 400

    async def test_admin_can_change_user_role(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm5@users.com")
        emp = await _seed_user(db, co.id, role=UserRole.employee, email="promote@users.com")

        result = await update_user(
            db, user_id=emp.id, company_id=co.id, admin_id=admin.id, role="manager"
        )
        assert result["role"] == "manager"

    async def test_admin_can_deactivate_user(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm6@users.com")
        emp = await _seed_user(db, co.id, role=UserRole.employee, email="deact@users.com")

        await delete_user(db, user_id=emp.id, company_id=co.id, admin_id=admin.id)
        await db.flush()

        q = await db.execute(select(User).where(User.id == emp.id))
        u = q.scalar_one()
        assert u.is_active is False

    async def test_admin_cannot_deactivate_self(self, db):
        await _seed_country(db)
        co = await _seed_company(db, currency="USD")
        admin = await _seed_user(db, co.id, role=UserRole.admin, email="adm7@users.com")

        with pytest.raises(HTTPException) as exc:
            await delete_user(db, user_id=admin.id, company_id=co.id, admin_id=admin.id)
        assert exc.value.status_code == 400

    async def test_list_users_scoped_to_company(self, db):
        await _seed_country(db)
        co1 = await _seed_company(db, name="Co1Usr", currency="USD")
        co2 = await _seed_company(db, name="Co2Usr", currency="USD")
        admin = await _seed_user(db, co1.id, role=UserRole.admin, email="adm8@users.com")
        emp_co2 = await _seed_user(db, co2.id, role=UserRole.employee, email="other_co@users.com")

        result = await list_users(db, company_id=co1.id)
        ids = [u["id"] for u in result["items"]]
        assert str(emp_co2.id) not in ids
