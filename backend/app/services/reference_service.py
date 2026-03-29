"""Reference data service — countries, currencies, exchange rates.

All data is read from local persisted tables, not remote APIs.
"""

from typing import Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.reference import Country, Currency, ExchangeRate
from app.services.audit_service import log_event


async def get_countries(db: AsyncSession) -> list[dict]:
    """Return all countries from the local seed table."""
    result = await db.execute(select(Country).order_by(Country.name))
    countries = result.scalars().all()
    return [
        {"code": c.code, "name": c.name, "currency_code": c.currency_code}
        for c in countries
    ]


async def get_currencies(db: AsyncSession) -> list[dict]:
    """Return all currencies from the local seed table."""
    result = await db.execute(select(Currency).order_by(Currency.code))
    currencies = result.scalars().all()
    return [
        {"code": c.code, "name": c.name, "symbol": c.symbol}
        for c in currencies
    ]


async def get_exchange_rates(
    db: AsyncSession,
    *,
    base_currency: Optional[str] = None,
    target_currency: Optional[str] = None,
) -> list[dict]:
    """Query exchange rates from the local table, optionally filtered."""
    query = select(ExchangeRate).order_by(ExchangeRate.effective_date.desc())

    if base_currency:
        query = query.where(ExchangeRate.base_currency == base_currency.upper())
    if target_currency:
        query = query.where(ExchangeRate.target_currency == target_currency.upper())

    result = await db.execute(query)
    rates = result.scalars().all()
    return [_rate_to_dict(r) for r in rates]


async def create_exchange_rate(
    db: AsyncSession,
    admin_id: UUID,
    company_id: UUID,
    *,
    base_currency: str,
    target_currency: str,
    rate: str,
    source: str = "manual_seed",
) -> dict:
    """Admin inserts or adds a new exchange rate entry.

    Does NOT update in place — creates a new record so rate history is preserved.
    """
    # Validate currencies exist
    base_result = await db.execute(
        select(Currency).where(Currency.code == base_currency.upper())
    )
    if base_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown base currency: {base_currency}",
        )

    target_result = await db.execute(
        select(Currency).where(Currency.code == target_currency.upper())
    )
    if target_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown target currency: {target_currency}",
        )

    try:
        rate_decimal = Decimal(rate)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rate must be a valid decimal string",
        )

    if rate_decimal <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rate must be positive",
        )

    exchange_rate = ExchangeRate(
        base_currency=base_currency.upper(),
        target_currency=target_currency.upper(),
        rate=rate_decimal,
        source=source,
        effective_date=datetime.now(timezone.utc),
    )
    db.add(exchange_rate)
    await db.flush()

    await log_event(
        db,
        actor_id=admin_id,
        action="exchange_rate_created",
        entity_type="exchange_rate",
        entity_id=exchange_rate.id,
        company_id=company_id,
        details_after={
            "base_currency": exchange_rate.base_currency,
            "target_currency": exchange_rate.target_currency,
            "rate": str(exchange_rate.rate),
            "source": exchange_rate.source,
        },
    )

    return _rate_to_dict(exchange_rate)


def _rate_to_dict(rate: ExchangeRate) -> dict:
    normalized_rate = format(rate.rate.normalize(), "f") if rate.rate is not None else None
    return {
        "id": str(rate.id),
        "base_currency": rate.base_currency,
        "target_currency": rate.target_currency,
        "rate": normalized_rate,
        "source": rate.source,
        "effective_date": rate.effective_date.isoformat() if rate.effective_date else None,
    }
