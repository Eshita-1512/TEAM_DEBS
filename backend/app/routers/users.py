"""Users router — admin-only CRUD for user management.

Endpoints:
  GET    /api/v1/users
  POST   /api/v1/users
  GET    /api/v1/users/{user_id}
  PATCH  /api/v1/users/{user_id}
  DELETE /api/v1/users/{user_id}
"""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.permissions import require_permission
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.services import user_service

router = APIRouter(prefix="/api/v1/users", tags=["Users"])


@router.get("")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    """List users in the company (admin only)."""
    return await user_service.list_users(
        db, current_user.company_id, page=page, page_size=page_size, q=q, role=role
    )


@router.post("", status_code=201)
async def create_user(
    req: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    """Create a new employee or manager (admin only)."""
    result = await user_service.create_user(
        db,
        current_user.company_id,
        current_user.id,
        name=req.name,
        email=req.email,
        password=req.password,
        role=req.role,
    )
    return {"data": result}


@router.get("/{user_id}")
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    """Get a single user by ID (admin only)."""
    result = await user_service.get_user(db, user_id, current_user.company_id)
    return {"data": result}


@router.patch("/{user_id}")
async def update_user(
    user_id: UUID,
    req: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    """Update user fields (admin only)."""
    result = await user_service.update_user(
        db,
        user_id,
        current_user.company_id,
        current_user.id,
        name=req.name,
        email=req.email,
        role=req.role,
        is_active=req.is_active,
    )
    return {"data": result}


@router.delete("/{user_id}", status_code=200)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    """Soft-delete a user (admin only)."""
    await user_service.delete_user(db, user_id, current_user.company_id, current_user.id)
    return {"message": "User deactivated"}
