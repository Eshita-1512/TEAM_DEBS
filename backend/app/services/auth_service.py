"""Auth service — signup, login, get_me logic.

Handles company bootstrap atomically during signup.
"""

from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.company import Company
from app.models.user import User, UserRole
from app.models.reference import Country
from app.core.security import hash_password, verify_password, create_access_token
from app.core.permissions import get_permissions_for_role
from app.services.audit_service import log_event
from app.schemas.auth import SignupRequest, MeData, UserInfo, CompanyInfo


async def signup(db: AsyncSession, req: SignupRequest) -> dict:
    """
    Create a new Company and its first Admin user atomically.

    1. Validate that the email is not already registered.
    2. Look up default currency from the local Country table.
    3. Create Company → Create Admin User → Audit log.
    4. Return JWT access token.
    """
    # Check for duplicate email
    existing = await db.execute(select(User).where(User.email == req.admin_email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Resolve default currency from local country data
    country_result = await db.execute(
        select(Country).where(Country.code == req.country_code.upper())
    )
    country = country_result.scalar_one_or_none()
    if country is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown country code: {req.country_code}",
        )

    default_currency = country.currency_code

    # Create company
    company = Company(
        name=req.company_name,
        country_code=req.country_code.upper(),
        default_currency=default_currency,
    )
    db.add(company)
    await db.flush()  # Get company.id

    # Create admin user
    user = User(
        name=req.admin_name,
        email=req.admin_email,
        hashed_password=hash_password(req.password),
        role=UserRole.admin,
        company_id=company.id,
        is_active=True,
    )
    db.add(user)
    await db.flush()  # Get user.id

    # Audit log
    await log_event(
        db,
        actor_id=user.id,
        action="company_bootstrap",
        entity_type="company",
        entity_id=company.id,
        company_id=company.id,
        details_after={
            "company_name": company.name,
            "country_code": company.country_code,
            "default_currency": company.default_currency,
            "admin_email": user.email,
        },
    )

    # Generate token
    token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


async def login(db: AsyncSession, email: str, password: str) -> dict:
    """Validate credentials and return JWT token."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


async def get_me(user: User) -> MeData:
    """Build the /me response from a loaded User."""
    company = user.company
    permissions = get_permissions_for_role(user.role)

    return MeData(
        user=UserInfo(
            id=str(user.id),
            name=user.name,
            email=user.email,
            role=user.role.value,
        ),
        company=CompanyInfo(
            id=str(company.id),
            name=company.name,
            country_code=company.country_code,
            default_currency=company.default_currency,
        ),
        permissions=permissions,
    )
