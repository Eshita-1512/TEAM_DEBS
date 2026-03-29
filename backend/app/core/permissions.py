"""Role-based permission framework.

Defines permissions per role, and provides FastAPI dependencies for
auth enforcement.
"""

from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole

security_scheme = HTTPBearer()

# ── Canonical permission map ──────────────────────────────────────────
ROLE_PERMISSIONS: dict[UserRole, list[str]] = {
    UserRole.admin: [
        "users.manage",
        "users.read",
        "expenses.read_all",
        "expenses.submit",
        "approval_policies.manage",
        "approval_policies.read",
        "approvals.act",
        "audit.read",
        "audit.export",
        "budgets.manage",
        "budgets.read",
        "reimbursements.manage",
        "reimbursements.read",
        "analytics.read",
        "reference_data.manage",
        "reference_data.read",
    ],
    UserRole.manager: [
        "users.read",
        "expenses.read_team",
        "expenses.submit",
        "approvals.act",
        "approval_policies.read",
        "budgets.read",
        "reference_data.read",
    ],
    UserRole.employee: [
        "expenses.submit",
        "expenses.read_own",
        "reference_data.read",
    ],
}


def get_permissions_for_role(role: UserRole) -> list[str]:
    """Return the list of permission strings for a given role."""
    return ROLE_PERMISSIONS.get(role, [])


# ── FastAPI dependencies ──────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Decode JWT and return the authenticated User or raise 401."""
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(select(User).where(User.id == UUID(str(user_id))))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def require_role(*allowed_roles: UserRole):
    """Return a dependency that enforces the user has one of the allowed roles."""
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return role_checker


def require_permission(permission: str):
    """Return a dependency that enforces the user has a specific permission."""
    async def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        user_permissions = get_permissions_for_role(current_user.role)
        if permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}",
            )
        return current_user
    return permission_checker
