"""
Tests — Currency Service (build-spec §10 Currency Rules)

Verifies:
  1. Same-currency conversion returns rate=1, source="identity"
  2. Direct rate lookup from ExchangeRate table works correctly
  3. Inverse rate is used when only the reverse pair exists
  4. Cross-rate via USD is used when no direct or inverse pair exists
  5. Returns None when no rate exists anywhere (caller must block submission)
  6. Amount is correctly multiplied and quantized to 2dp
"""

from decimal import Decimal
from datetime import datetime, timezone

import pytest
import pytest_asyncio

from app.services.currency_service import get_conversion_rate, convert_amount
from app.models.reference import ExchangeRate


pytestmark = pytest.mark.asyncio


async def _add_rate(db, base, target, rate, source="test"):
    er = ExchangeRate(
        base_currency=base,
        target_currency=target,
        rate=Decimal(str(rate)),
        source=source,
        effective_date=datetime.now(timezone.utc),
    )
    db.add(er)
    await db.flush()


class TestGetConversionRate:
    async def test_identity_same_currency(self, db):
        result = await get_conversion_rate(db, "USD", "USD")
        assert result is not None
        assert result.rate == Decimal("1.00000000")
        assert result.source == "identity"

    async def test_direct_rate_lookup(self, db):
        await _add_rate(db, "USD", "EUR", "0.92")
        result = await get_conversion_rate(db, "USD", "EUR")
        assert result is not None
        assert result.rate == Decimal("0.92")
        assert result.base_currency == "USD"
        assert result.target_currency == "EUR"

    async def test_inverse_rate_used_when_only_reverse_exists(self, db):
        await _add_rate(db, "EUR", "USD", "1.10")
        result = await get_conversion_rate(db, "USD", "EUR")
        assert result is not None
        # Should be ~0.909090… (1/1.10)
        expected = (Decimal("1") / Decimal("1.10")).quantize(Decimal("0.00000001"))
        assert result.rate == expected
        assert "inverse" in result.source

    async def test_cross_usd_rate(self, db):
        await _add_rate(db, "GBP", "USD", "1.25")
        await _add_rate(db, "USD", "JPY", "150.00")
        result = await get_conversion_rate(db, "GBP", "JPY")
        assert result is not None
        expected = (Decimal("1.25") * Decimal("150.00")).quantize(Decimal("0.00000001"))
        assert result.rate == expected
        assert result.source == "cross_usd"

    async def test_returns_none_when_no_rate_available(self, db):
        # No rates seeded for ZZZ -> AAA pair
        result = await get_conversion_rate(db, "ZZZ", "AAA")
        assert result is None


class TestConvertAmount:
    async def test_convert_amount_correct_multiplication(self, db):
        await _add_rate(db, "USD", "EUR", "0.90")
        result = await convert_amount(db, Decimal("100.00"), "USD", "EUR")
        assert result is not None
        converted, rate_info = result
        assert converted == Decimal("90.00")

    async def test_convert_amount_returns_none_when_no_rate(self, db):
        result = await convert_amount(db, Decimal("50.00"), "XYZ", "QRS")
        assert result is None

    async def test_convert_amount_quantized_to_2dp(self, db):
        await _add_rate(db, "USD", "INR", "83.123456")
        result = await convert_amount(db, Decimal("1.00"), "USD", "INR")
        assert result is not None
        converted, _ = result
        # Must be rounded to 2 decimal places
        assert converted == converted.quantize(Decimal("0.01"))
