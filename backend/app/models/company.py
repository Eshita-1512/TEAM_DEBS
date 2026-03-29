"""Company model — root tenant boundary."""

from sqlalchemy import Column, String
from app.models.base import Base, UUIDMixin, TimestampMixin


class Company(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "companies"

    name = Column(String(255), nullable=False)
    country_code = Column(String(3), nullable=False)
    default_currency = Column(String(3), nullable=False)
