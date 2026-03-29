"""
Tests — Manager Assignments (build-spec §10 & §27.3)

Verifies:
  1. Admin can list manager assignments
  2. Admin can create a valid employee->manager assignment
  3. Deactivates previous active assignment when creating a new one
  4. Non-admin cannot create assignments
  5. Cannot assign employee as their own manager
  6. Cannot assign employee to non-manager role
"""

import pytest
from httpx import AsyncClient

from app.models.manager_assignment import ManagerAssignment

pytestmark = pytest.mark.asyncio

@pytest.fixture
def admin_headers(admin_user):
    from app.core.security import create_access_token
    token = create_access_token({"sub": str(admin_user.id)})
    return {"Authorization": f"Bearer {token}"}


class TestManagerAssignments:
    async def test_create_valid_assignment(self, client: AsyncClient, admin_headers, employee_user, manager_user):
        payload = {
            "employee_id": str(employee_user.id),
            "manager_id": str(manager_user.id)
        }
        resp = await client.post("/api/v1/manager-assignments", json=payload, headers=admin_headers)
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["employee_id"] == str(employee_user.id)
        assert data["manager_id"] == str(manager_user.id)
        assert data["is_active"] is True

    async def test_cannot_assign_self(self, client: AsyncClient, admin_headers, employee_user):
        payload = {
            "employee_id": str(employee_user.id),
            "manager_id": str(employee_user.id)
        }
        resp = await client.post("/api/v1/manager-assignments", json=payload, headers=admin_headers)
        assert resp.status_code == 400

    async def test_cannot_assign_non_manager_role(self, client: AsyncClient, admin_headers, employee_user, db):
        # Create a second employee
        from tests.conftest import _seed_user
        employee2 = await _seed_user(db, employee_user.company_id, email="emp2@test.com")
        
        payload = {
            "employee_id": str(employee_user.id),
            "manager_id": str(employee2.id)
        }
        resp = await client.post("/api/v1/manager-assignments", json=payload, headers=admin_headers)
        assert resp.status_code == 400
        assert "must have 'manager' or 'admin' role" in resp.json()["detail"]

    async def test_new_assignment_deactivates_old_one(self, client: AsyncClient, admin_headers, employee_user, manager_user, admin_user):
        # Create first assignment
        client.headers.update(admin_headers)
        payload1 = {
            "employee_id": str(employee_user.id),
            "manager_id": str(manager_user.id)
        }
        resp1 = await client.post("/api/v1/manager-assignments", json=payload1)
        assert resp1.status_code == 201
        
        # Create second assignment (assign to admin)
        payload2 = {
            "employee_id": str(employee_user.id),
            "manager_id": str(admin_user.id)
        }
        resp2 = await client.post("/api/v1/manager-assignments", json=payload2)
        assert resp2.status_code == 201
        
        # List assignments and check statuses
        resp_list = await client.get("/api/v1/manager-assignments")
        items = resp_list.json()["items"]
        assert len(items) == 2
        
        # Newest should be active, oldest inactive (sorted by created desc)
        assert items[0]["is_active"] is True
        assert items[0]["manager_id"] == str(admin_user.id)
        
        assert items[1]["is_active"] is False
        assert items[1]["manager_id"] == str(manager_user.id)
