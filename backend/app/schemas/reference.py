"""Reference data schemas matching Section 27.4."""

from pydantic import BaseModel
from typing import Optional


class CountryResponse(BaseModel):
    code: str
    name: str
    currency_code: str


class CurrencyResponse(BaseModel):
    code: str
    name: str
    symbol: Optional[str] = None


class ExchangeRateCreate(BaseModel):
    base_currency: str
    target_currency: str
    rate: str  # Decimal string per spec
    source: str = "manual_seed"


class ExchangeRateResponse(BaseModel):
    id: str
    base_currency: str
    target_currency: str
    rate: str  # Decimal string per spec
    source: str
    effective_date: str  # ISO 8601 UTC
