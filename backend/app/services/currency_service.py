"""Currency service — reads conversion rates from local exchange-rate table.

All rate lookups come from the persisted ExchangeRate table (BE-1 owned seed data).
This service is used by expense creation to lock the conversion rate at submission time.

Owned by BE-2.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional
from datetime import datetime

from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reference import ExchangeRate

logger = logging.getLogger(__name__)


class ConversionResult:
    """Result of a currency conversion lookup."""
    def __init__(
        self,
        rate: Decimal,
        source: str,
        effective_date: datetime,
        base_currency: str,
        target_currency: str,
    ):
        self.rate = rate
        self.source = source
        self.effective_date = effective_date
        self.base_currency = base_currency
        self.target_currency = target_currency

    @property
    def rate_str(self) -> str:
        return str(self.rate)


async def get_conversion_rate(
    db: AsyncSession,
    base_currency: str,
    target_currency: str,
) -> Optional[ConversionResult]:
    """Look up the most recent exchange rate from local storage.

    Returns None if no rate is available — caller must block submission
    per spec §10 edge cases.
    """
    base = base_currency.upper()
    target = target_currency.upper()

    if base == target:
        return ConversionResult(
            rate=Decimal("1.00000000"),
            source="identity",
            effective_date=datetime.utcnow(),
            base_currency=base,
            target_currency=target,
        )

    # Direct rate lookup
    result = await _lookup_rate(db, base, target)
    if result:
        return result

    # Try inverse rate
    inverse = await _lookup_rate(db, target, base)
    if inverse:
        inverted_rate = Decimal("1") / inverse.rate
        return ConversionResult(
            rate=inverted_rate.quantize(Decimal("0.00000001")),
            source=f"{inverse.source}_inverse",
            effective_date=inverse.effective_date,
            base_currency=base,
            target_currency=target,
        )

    # Try cross-rate through USD
    if base != "USD" and target != "USD":
        base_to_usd = await _lookup_rate(db, base, "USD")
        usd_to_target = await _lookup_rate(db, "USD", target)
        if base_to_usd and usd_to_target:
            cross = base_to_usd.rate * usd_to_target.rate
            return ConversionResult(
                rate=cross.quantize(Decimal("0.00000001")),
                source="cross_usd",
                effective_date=min(base_to_usd.effective_date, usd_to_target.effective_date),
                base_currency=base,
                target_currency=target,
            )

    logger.warning(f"No exchange rate found for {base} -> {target}")
    return None


async def convert_amount(
    db: AsyncSession,
    amount: Decimal,
    base_currency: str,
    target_currency: str,
) -> Optional[tuple[Decimal, ConversionResult]]:
    """Convert an amount and return (converted_amount, conversion_result).

    Returns None if no rate is available.
    """
    rate_result = await get_conversion_rate(db, base_currency, target_currency)
    if rate_result is None:
        return None

    converted = (amount * rate_result.rate).quantize(Decimal("0.01"))
    return converted, rate_result


async def _lookup_rate(
    db: AsyncSession,
    base: str,
    target: str,
) -> Optional[ConversionResult]:
    """Find the most recent rate for a specific pair."""
    stmt = (
        select(ExchangeRate)
        .where(
            and_(
                ExchangeRate.base_currency == base,
                ExchangeRate.target_currency == target,
            )
        )
        .order_by(desc(ExchangeRate.effective_date))
        .limit(1)
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()

    if row is None:
        return None

    return ConversionResult(
        rate=row.rate,
        source=row.source,
        effective_date=row.effective_date,
        base_currency=base,
        target_currency=target,
    )
