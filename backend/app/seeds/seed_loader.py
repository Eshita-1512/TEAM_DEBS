"""Seed loader — loads country and currency data from local JSON on startup.

Idempotent: skips if data already exists.
"""

import json
import os
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.reference import Country, Currency


SEED_FILE = os.path.join(os.path.dirname(__file__), "countries.json")


async def load_seed_data(db: AsyncSession) -> None:
    """Load country and currency seed data if tables are empty."""
    # Check if countries already populated
    count_result = await db.execute(select(func.count()).select_from(Country))
    country_count = count_result.scalar()
    if country_count and country_count > 0:
        return  # Already seeded

    with open(SEED_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    currencies_seen: set[str] = set()

    for entry in data:
        # Insert country
        country = Country(
            code=entry["code"],
            name=entry["name"],
            currency_code=entry["currency_code"],
        )
        db.add(country)

        # Insert currency (deduplicated)
        cc = entry["currency_code"]
        if cc not in currencies_seen:
            currencies_seen.add(cc)
            currency = Currency(
                code=cc,
                name=entry.get("currency_name", cc),
                symbol=entry.get("currency_symbol"),
            )
            db.add(currency)

    await db.commit()
