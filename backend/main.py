"""FastAPI application entry point.

Configures CORS, includes all routers, and runs seed data loading on startup.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, async_session_factory
from app.models.base import Base

# Import all models so they register with the Base metadata
from app.models import company, user, manager_assignment, reference, audit_log  # noqa: F401
from app.models import expense, approval_policy, approval_instance  # noqa: F401 — BE-3
from app.models import budget, reimbursement, compliance_export  # noqa: F401 — BE-3
from app.models import receipt, ocr  # noqa: F401  (BE-2 models)

from app.routers import auth, users, manager_assignments, reference as reference_router
from app.routers import approval_policies, approvals, audit, compliance  # BE-3
from app.routers import budgets, reimbursements, analytics, health  # BE-3
from app.routers import receipts, expenses  # BE-2 routers
from app.seeds.seed_loader import load_seed_data

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables and load seed data. Shutdown: dispose engine."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed reference data
    async with async_session_factory() as session:
        await load_seed_data(session)

    yield

    await engine.dispose()


app = FastAPI(
    title="Reimbursement Management System",
    version="0.1.0",
    description="Backend API for the Reimbursement Management System — BE-1 module",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers — BE-1
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(manager_assignments.router)
app.include_router(reference_router.router)

# Register routers — BE-3
app.include_router(approval_policies.router)
app.include_router(approvals.router)
app.include_router(audit.router)
app.include_router(compliance.router)
app.include_router(budgets.router)
app.include_router(reimbursements.router)
app.include_router(analytics.router)
app.include_router(health.router)

# Register routers — BE-2
app.include_router(receipts.router)
app.include_router(expenses.router)
