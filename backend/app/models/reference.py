"""Reference data models — Country, Currency, ExchangeRate.

These are local persisted data, not dependent on external APIs.
"""

from sqlalchemy import Column, String, Numeric, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin, TimestampMixin

import uuid
from datetime import datetime, timezone


class Country(Base):
    __tablename__ = "countries"

    code = Column(String(3), primary_key=True)
    name = Column(String(255), nullable=False)
    currency_code = Column(String(3), nullable=False, index=True)


class Currency(Base):
    __tablename__ = "currencies"

    code = Column(String(3), primary_key=True)
    name = Column(String(100), nullable=False)
    symbol = Column(String(10), nullable=True)


class ExchangeRate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "exchange_rates"

    base_currency = Column(String(3), nullable=False, index=True)
    target_currency = Column(String(3), nullable=False, index=True)
    rate = Column(Numeric(precision=18, scale=8), nullable=False)
    source = Column(String(100), nullable=False, default="manual_seed")
    effective_date = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
