"""
Shared pytest fixtures for the Reimbursement Management System backend tests.

Uses an in-memory SQLite database (via aiosqlite) — which means we need to
work around two PostgreSQL-specific types that the production models use:
  - postgresql.UUID  -> mapped to String(36) for SQLite
  - postgresql.JSONB -> mapped to JSON for SQLite

We achieve this with type decorator overrides registered BEFORE any engine is
created, using the standard SQLAlchemy colspecs mechanism exposed via
TypeDecorator and the special class-level registration trick.
"""

import json
import uuid as _uuid_module
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import AsyncGenerator, Any, Optional

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import String, event, types
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import get_db
from main import app as fastapi_app

# ── Patch pg-specific types to work with SQLite ─────────────────────────────
# This must happen before any model import that brings in the dialect types.

from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB as PG_JSONB
from sqlalchemy import JSON


class _SQLiteUUID(types.TypeDecorator):
    """Store UUID as a 36-char string in SQLite."""
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return _uuid_module.UUID(str(value))


class _SQLiteJSONB(types.TypeDecorator):
    """Store JSONB as TEXT (JSON serialized) in SQLite."""
    impl = types.Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, (dict, list)):
            return value
        return json.loads(value)


# Override colspecs for the aiosqlite dialect  ───────────────────────────────
# SQLAlchemy uses each dialect's colspecs dict to decide how to render types.
# By patching the pgsql type's class hierarchy mapping we can make it fall back
# to our wrappers when the target dialect is SQLite.

from sqlalchemy.dialects.sqlite import base as sqlite_base

# Map pg JSONB -> our wrapper for _any_ rendering through sqlite
_orig_jsonb_compile = None

def _patch_types():
    """Monkeypatch postgresql.JSONB and postgresql.UUID for sqlite compilation."""
    from sqlalchemy.dialects.postgresql.json import JSONB
    from sqlalchemy.dialects.postgresql.base import UUID

    # For CREATE TABLE we need the TypeCompiler to handle these.
    # We add them to the sqlite TypeCompiler's colspecs:
    from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

    def visit_UUID(self, type_, **kw):
        return "VARCHAR(36)"

    def visit_JSONB(self, type_, **kw):
        return "TEXT"

    SQLiteTypeCompiler.visit_UUID = visit_UUID
    SQLiteTypeCompiler.visit_JSONB = visit_JSONB

    # Also make the result processor work (bind/result processing) by
    # patching process_bind_param at the instance level via event. We do this
    # by replacing the column type on CREATE TABLE execution.
    # Simpler: override render_postfetch return for sqlite.

_patch_types()


# ── SQLAlchemy also needs to know how to bind/fetch UUID/JSONB values ────────
# We monkey-patch at the dialect type level so every column that uses pg.UUID
# or pg.JSONB automatically goes through our wrappers.

from sqlalchemy.dialects.postgresql import JSONB as _JSONB_cls, UUID as _UUID_cls


# Intercept bind/result at the type level
_orig_uuid_bind = _UUID_cls.process_bind_param if hasattr(_UUID_cls, 'process_bind_param') else None
_orig_jsonb_bind = _JSONB_cls.process_bind_param if hasattr(_JSONB_cls, 'process_bind_param') else None

def _uuid_bind(self, value, dialect):
    if value is None:
        return None
    return str(value)

def _uuid_result(self, value, dialect):
    if value is None:
        return None
    try:
        return _uuid_module.UUID(str(value))
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

_UUID_cls.process_bind_param = _uuid_bind
_UUID_cls.process_result_value = _uuid_result
_UUID_cls.hashable = False

_JSONB_cls.process_bind_param = _jsonb_bind
_JSONB_cls.process_result_value = _jsonb_result


# ── Now import models (after patches are in place) ───────────────────────────
from app.models.base import Base
from app.models import (  # noqa: F401
    company, user, manager_assignment, reference,
    audit_log, expense, approval_policy, approval_instance,
    budget, reimbursement, compliance_export, receipt, ocr,
)
from app.models.company import Company
from app.models.user import User, UserRole
from app.models.reference import Country, ExchangeRate
from app.models.expense import Expense, ExpenseLineItem
from app.models.approval_policy import ApprovalPolicy, ApprovalStep, ApprovalRule
from app.models.approval_instance import ExpenseApprovalInstance, ApprovalAction
from app.models.manager_assignment import ManagerAssignment
from app.models.reimbursement import ReimbursementBatch

from app.core.security import hash_password


# ── Engine ────────────────────────────────────────────────────────────────────

DATABASE_URL = "sqlite+aiosqlite:///./test.db"

test_engine = create_async_engine(
    DATABASE_URL,
    echo=False,
)

TestSessionFactory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture(scope="function", autouse=True)
async def create_tables():
    """Create all tables before each test and drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture()
async def db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a fresh async session per test, fully isolated via savepoints."""
    async with test_engine.connect() as conn:
        await conn.begin()
        await conn.begin_nested()
        session = AsyncSession(
            bind=conn, 
            join_transaction_mode="create_savepoint", 
            expire_on_commit=False
        )
        try:
            yield session
        finally:
            await session.close()
            await conn.rollback()


# ── FastAPI test client ───────────────────────────────────────────────────────

@pytest_asyncio.fixture()
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient backed by the FastAPI app; DB dependency overridden."""

    async def override_get_db():
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db
    
    # Disable actual lifespan hook which connects to real Postgres
    from contextlib import asynccontextmanager
    @asynccontextmanager
    async def mock_lifespan(app):
        yield
    fastapi_app.router.lifespan_context = mock_lifespan

    async with AsyncClient(
        transport=ASGITransport(app=fastapi_app),
        base_url="http://test",
    ) as ac:
        yield ac

    fastapi_app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def admin_user(db: AsyncSession) -> User:
    await _seed_country(db, code="US", currency="USD")
    company = await _seed_company(db, currency="USD")
    return await _seed_user(
        db,
        company.id,
        role=UserRole.admin,
        email="admin@test.com",
        name="Admin User",
    )


@pytest_asyncio.fixture()
async def employee_user(db: AsyncSession, admin_user: User) -> User:
    return await _seed_user(
        db,
        admin_user.company_id,
        role=UserRole.employee,
        email="employee@test.com",
        name="Employee User",
    )


@pytest_asyncio.fixture()
async def manager_user(db: AsyncSession, admin_user: User) -> User:
    return await _seed_user(
        db,
        admin_user.company_id,
        role=UserRole.manager,
        email="manager@test.com",
        name="Manager User",
    )


# ── Seed helpers ─────────────────────────────────────────────────────────────

async def _seed_country(db: AsyncSession, code: str = "US", currency: str = "USD") -> Country:
    c = Country(code=code, name=f"Country-{code}", currency_code=currency)
    db.add(c)
    await db.flush()
    return c


async def _seed_rate(
    db: AsyncSession,
    base: str,
    target: str,
    rate: Decimal = Decimal("1.10"),
) -> ExchangeRate:
    er = ExchangeRate(
        base_currency=base,
        target_currency=target,
        rate=rate,
        source="test_seed",
        effective_date=datetime.now(timezone.utc),
    )
    db.add(er)
    await db.flush()
    return er


async def _seed_company(
    db: AsyncSession,
    name: str = "Acme Corp",
    country_code: str = "US",
    currency: str = "USD",
) -> Company:
    co = Company(name=name, country_code=country_code, default_currency=currency)
    db.add(co)
    await db.flush()
    return co


async def _seed_user(
    db: AsyncSession,
    company_id,
    role: UserRole = UserRole.employee,
    email: Optional[str] = None,
    name: str = "Test User",
) -> User:
    email = email or f"user-{_uuid_module.uuid4().hex[:6]}@test.com"
    u = User(
        name=name,
        email=email,
        hashed_password=hash_password("Password1!"),
        role=role,
        company_id=company_id,
        is_active=True,
    )
    db.add(u)
    await db.flush()
    return u


async def _seed_expense(
    db: AsyncSession,
    employee_id,
    company_id,
    status="submitted",
    amount: Decimal = Decimal("100.00"),
    currency: str = "USD",
) -> Expense:
    from app.enums import ExpenseStatus
    exp = Expense(
        employee_id=employee_id,
        company_id=company_id,
        category="Travel",
        description="Business trip",
        expense_date=date.today(),
        status=getattr(ExpenseStatus, status, ExpenseStatus.submitted),
        original_currency=currency,
        original_amount=amount,
        company_currency="USD",
        converted_amount=amount,
        conversion_rate=Decimal("1.00"),
        conversion_rate_source="identity",
        conversion_rate_timestamp=datetime.now(timezone.utc),
        submitted_total_before_exclusions=amount,
        final_included_total=amount,
        submitted_at=datetime.now(timezone.utc),
        reimbursement_status="not_ready",
    )
    db.add(exp)
    await db.flush()
    return exp
