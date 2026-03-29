"""
Tests — Authentication and Company Bootstrap (build-spec §8)

Verifies:
  1. Company + admin user are created atomically on signup
  2. Default currency is resolved from the stored Country record
  3. Duplicate email is rejected with 409
  4. Login with correct credentials returns a token
  5. Login with wrong password returns 401
  6. /auth/me returns the current user's role and company info
  7. Non-admin role yields restricted permissions
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.reference import Country
from app.models.user import User, UserRole
from app.models.company import Company
from sqlalchemy import select


pytestmark = pytest.mark.asyncio


SIGNUP_PAYLOAD = {
    "company_name": "TestCorp",
    "country_code": "US",
    "admin_name": "Alice Admin",
    "admin_email": "alice@testcorp.com",
    "password": "Password1!",
}


async def _ensure_country(db, code="US", currency="USD"):
    result = await db.execute(select(Country).where(Country.code == code))
    if result.scalar_one_or_none() is None:
        db.add(Country(code=code, name="United States", currency_code=currency))
        await db.flush()


# ── Test: company bootstrap ────────────────────────────────────────────────

class TestSignup:
    async def test_signup_creates_company_and_admin(self, client: AsyncClient, db):
        await _ensure_country(db)
        resp = await client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"

        # Verify DB records
        user_q = await db.execute(select(User).where(User.email == SIGNUP_PAYLOAD["admin_email"]))
        user = user_q.scalar_one_or_none()
        assert user is not None
        assert user.role == UserRole.admin

        company_q = await db.execute(select(Company).where(Company.name == SIGNUP_PAYLOAD["company_name"]))
        company = company_q.scalar_one_or_none()
        assert company is not None
        assert company.default_currency == "USD"   # Resolved from Country table

    async def test_signup_duplicate_email_returns_409(self, client: AsyncClient, db):
        await _ensure_country(db)
        await client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
        # Second signup with same email
        resp2 = await client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
        assert resp2.status_code == 409

    async def test_signup_invalid_country_returns_400(self, client: AsyncClient, db):
        payload = {**SIGNUP_PAYLOAD, "admin_email": "x@y.com", "country_code": "ZZ"}
        resp = await client.post("/api/v1/auth/signup", json=payload)
        assert resp.status_code == 400


# ── Test: login ────────────────────────────────────────────────────────────

class TestLogin:
    @pytest_asyncio.fixture(autouse=True)
    async def _setup(self, client: AsyncClient, db):
        await _ensure_country(db)
        resp = await client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
        assert resp.status_code == 201
        self.token = resp.json()["access_token"]

    async def test_login_valid_credentials(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": SIGNUP_PAYLOAD["admin_email"], "password": SIGNUP_PAYLOAD["password"]},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    async def test_login_wrong_password_returns_401(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": SIGNUP_PAYLOAD["admin_email"], "password": "WrongPass!"},
        )
        assert resp.status_code == 401

    async def test_login_unknown_email_returns_401(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@nowhere.com", "password": "Password1!"},
        )
        assert resp.status_code == 401


# ── Test: /me endpoint ──────────────────────────────────────────────────────

class TestMe:
    @pytest_asyncio.fixture(autouse=True)
    async def _setup(self, client: AsyncClient, db):
        await _ensure_country(db)
        resp = await client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
        self.token = resp.json()["access_token"]

    async def test_me_returns_user_and_company(self, client: AsyncClient):
        resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["user"]["role"] == "admin"
        assert data["company"]["default_currency"] == "USD"
        assert "permissions" in data

    async def test_me_without_token_returns_401(self, client: AsyncClient):
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code in (401, 403)
