"""Async SQLAlchemy database engine and session management."""

import json
import uuid as uuid_module

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB, UUID as PG_UUID
from app.config import get_settings

settings = get_settings()

if settings.DATABASE_URL.startswith("sqlite"):
    from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

    def visit_UUID(self, type_, **kw):
        return "VARCHAR(36)"

    def visit_JSONB(self, type_, **kw):
        return "TEXT"

    SQLiteTypeCompiler.visit_UUID = visit_UUID
    SQLiteTypeCompiler.visit_JSONB = visit_JSONB

    def _uuid_bind(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def _uuid_result(self, value, dialect):
        if value is None:
            return None
        try:
            return uuid_module.UUID(str(value))
        except Exception:
            return value

    def _jsonb_bind(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "sqlite":
            return json.dumps(value)
        return value

    def _jsonb_result(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, (dict, list)):
            return value
        if dialect.name == "sqlite":
            try:
                return json.loads(value)
            except Exception:
                return value
        return value

    PG_UUID.process_bind_param = _uuid_bind
    PG_UUID.process_result_value = _uuid_result
    PG_JSONB.process_bind_param = _jsonb_bind
    PG_JSONB.process_result_value = _jsonb_result

engine_kwargs = {
    "echo": False,
}

if settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs["pool_pre_ping"] = False
else:
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """FastAPI dependency that yields a database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
