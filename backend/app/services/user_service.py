"""User service — CRUD operations for admin user management."""

from typing import Optional
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.models.manager_assignment import ManagerAssignment
from app.core.security import hash_password
from app.services.audit_service import log_event


async def list_users(
    db: AsyncSession,
    company_id: UUID,
    *,
    page: int = 1,
    page_size: int = 20,
    q: Optional[str] = None,
    role: Optional[str] = None,
) -> dict:
    """List users in the company with pagination and filtering."""
    base_query = select(User).where(User.company_id == company_id)

    if q:
        base_query = base_query.where(
            User.name.ilike(f"%{q}%") | User.email.ilike(f"%{q}%")
        )
    if role:
        base_query = base_query.where(User.role == role)

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total_items = total_result.scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    users_result = await db.execute(
        base_query.order_by(User.created_at.desc()).offset(offset).limit(page_size)
    )
    users = users_result.scalars().all()

    # For each user, look up active manager assignment
    items = []
    for user in users:
        manager_info = await _get_manager_info(db, user.id)
        items.append(_user_to_dict(user, manager_info))

    total_pages = (total_items + page_size - 1) // page_size if total_items > 0 else 0

    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": total_pages,
        },
    }


async def create_user(
    db: AsyncSession,
    company_id: UUID,
    admin_id: UUID,
    *,
    name: str,
    email: str,
    password: str,
    role: str,
) -> dict:
    """Admin creates a new employee or manager in the same company."""
    if role not in ("employee", "manager"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'employee' or 'manager'",
        )

    # Check for duplicate email
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        name=name,
        email=email,
        hashed_password=hash_password(password),
        role=UserRole(role),
        company_id=company_id,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    await log_event(
        db,
        actor_id=admin_id,
        action="user_created",
        entity_type="user",
        entity_id=user.id,
        company_id=company_id,
        details_after={"name": name, "email": email, "role": role},
    )

    return _user_to_dict(user, None)


async def get_user(db: AsyncSession, user_id: UUID, company_id: UUID) -> dict:
    """Get a single user by ID within the company."""
    user = await _load_user(db, user_id, company_id)
    manager_info = await _get_manager_info(db, user.id)
    return _user_to_dict(user, manager_info)


async def update_user(
    db: AsyncSession,
    user_id: UUID,
    company_id: UUID,
    admin_id: UUID,
    *,
    name: Optional[str] = None,
    email: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> dict:
    """Update user fields. Emits audit log on changes."""
    user = await _load_user(db, user_id, company_id)
    before = {"name": user.name, "email": user.email, "role": user.role.value, "is_active": user.is_active}

    if name is not None:
        user.name = name
    if email is not None:
        # Check for duplicate
        existing = await db.execute(
            select(User).where(and_(User.email == email, User.id != user_id))
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )
        user.email = email
    if role is not None:
        if role not in ("admin", "employee", "manager"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role",
            )
        user.role = UserRole(role)
    if is_active is not None:
        user.is_active = is_active

    await db.flush()

    after = {"name": user.name, "email": user.email, "role": user.role.value, "is_active": user.is_active}
    await log_event(
        db,
        actor_id=admin_id,
        action="user_updated",
        entity_type="user",
        entity_id=user.id,
        company_id=company_id,
        details_before=before,
        details_after=after,
    )

    manager_info = await _get_manager_info(db, user.id)
    return _user_to_dict(user, manager_info)


async def delete_user(
    db: AsyncSession,
    user_id: UUID,
    company_id: UUID,
    admin_id: UUID,
) -> None:
    """Soft-delete a user by setting is_active=False."""
    user = await _load_user(db, user_id, company_id)

    if user.id == admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    user.is_active = False
    await db.flush()

    await log_event(
        db,
        actor_id=admin_id,
        action="user_deleted",
        entity_type="user",
        entity_id=user.id,
        company_id=company_id,
        details_before={"is_active": True},
        details_after={"is_active": False},
    )


# ── Helpers ───────────────────────────────────────────────────────────

async def _load_user(db: AsyncSession, user_id: UUID, company_id: UUID) -> User:
    result = await db.execute(
        select(User).where(and_(User.id == user_id, User.company_id == company_id))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


async def _get_manager_info(db: AsyncSession, employee_id: UUID) -> Optional[dict]:
    """Get the active manager assignment for a given employee."""
    result = await db.execute(
        select(ManagerAssignment).where(
            and_(
                ManagerAssignment.employee_id == employee_id,
                ManagerAssignment.is_active == True,
            )
        )
    )
    assignment = result.scalar_one_or_none()
    if assignment is None:
        return None
    return {
        "manager_id": str(assignment.manager_id),
        "manager_name": assignment.manager.name if assignment.manager else None,
    }


def _user_to_dict(user: User, manager_info: Optional[dict]) -> dict:
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "is_active": user.is_active,
        "manager_id": manager_info["manager_id"] if manager_info else None,
        "manager_name": manager_info["manager_name"] if manager_info else None,
    }
