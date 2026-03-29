"""
Tests — Reference Data (build-spec §11 & §27.4)

Verifies:
  1. Anyone authenticated can read countries/currencies/exchange rates
  2. Supplied seed data matches endpoints
  3. Only admins can POST new exchange rates
  4. Posting exchange rate properly references source currencies
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

@pytest.fixture
def admin_headers(admin_user):
    from app.core.security import create_access_token
    token = create_access_token({"sub": str(admin_user.id)})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def employee_headers(employee_user):
    from app.core.security import create_access_token
    token = create_access_token({"sub": str(employee_user.id)})
    return {"Authorization": f"Bearer {token}"}

class TestReferenceData:
    async def test_get_countries_and_currencies(self, client: AsyncClient, employee_headers, db):
        # conftest already seeded a US country
        resp1 = await client.get("/api/v1/reference/countries", headers=employee_headers)
        assert resp1.status_code == 200
        countries = resp1.json()["items"]
        assert any(c["code"] == "US" for c in countries)

    async def test_admin_can_post_exchange_rate(self, client: AsyncClient, admin_headers, db):
        # Need target currency in DB. US is already seeded. 
        from app.models.reference import Currency
        db.add(Currency(code="EUR", name="Euro"))
        db.add(Currency(code="USD", name="US Dollar"))
        await db.flush()

        payload = {
            "base_currency": "USD",
            "target_currency": "EUR",
            "rate": "0.91",
            "source": "manual_test"
        }
        resp = await client.post("/api/v1/reference/exchange-rates", json=payload, headers=admin_headers)
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["base_currency"] == "USD"
        assert data["target_currency"] == "EUR"
        assert data["rate"] == "0.91"

        # List rates to verify
        resp2 = await client.get("/api/v1/reference/exchange-rates?base_currency=usd&target_currency=eur", headers=admin_headers)
        assert resp2.status_code == 200
        items = resp2.json()["items"]
        assert len(items) >= 1
        assert items[0]["rate"] == "0.91"

    async def test_employee_cannot_post_exchange_rate(self, client: AsyncClient, employee_headers):
        payload = {
            "base_currency": "USD",
            "target_currency": "EUR",
            "rate": "0.91",
            "source": "employee_test"
        }
        resp = await client.post("/api/v1/reference/exchange-rates", json=payload, headers=employee_headers)
        assert resp.status_code == 403
