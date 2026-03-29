"""Reference data router — countries, currencies, exchange rates.

Endpoints:
  GET  /api/v1/reference/countries
  GET  /api/v1/reference/currencies
  GET  /api/v1/reference/exchange-rates
  POST /api/v1/reference/exchange-rates
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.permissions import get_current_user, require_permission
from app.models.user import User
from app.schemas.reference import ExchangeRateCreate
from app.services import reference_service

router = APIRouter(prefix="/api/v1/reference", tags=["Reference Data"])


@router.get("/countries")
async def list_countries(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all countries from local seed data."""
    items = await reference_service.get_countries(db)
    return {"items": items}


@router.get("/currencies")
async def list_currencies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all currencies from local seed data."""
    items = await reference_service.get_currencies(db)
    return {"items": items}


@router.get("/exchange-rates")
async def list_exchange_rates(
    base_currency: Optional[str] = Query(None),
    target_currency: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Query exchange rates from the local table."""
    items = await reference_service.get_exchange_rates(
        db, base_currency=base_currency, target_currency=target_currency
    )
    return {"items": items}


@router.post("/exchange-rates", status_code=201)
async def create_exchange_rate(
    req: ExchangeRateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reference_data.manage")),
):
    """Admin creates a new exchange rate entry."""
    result = await reference_service.create_exchange_rate(
        db,
        current_user.id,
        current_user.company_id,
        base_currency=req.base_currency,
        target_currency=req.target_currency,
        rate=req.rate,
        source=req.source,
    )
    return {"data": result}
