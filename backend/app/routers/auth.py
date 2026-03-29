"""Auth router — thin layer delegating to auth_service.

Endpoints:
  POST /api/v1/auth/signup
  POST /api/v1/auth/login
  GET  /api/v1/auth/me
  POST /api/v1/auth/logout
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.permissions import get_current_user
from app.models.user import User
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponse, MeResponse
from app.services import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Bootstrap a new company with its first admin user."""
    result = await auth_service.signup(db, req)
    return result


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate and receive an access token."""
    result = await auth_service.login(db, req.email, req.password)
    return result


@router.get("/me", response_model=MeResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Return the current authenticated user, company, and permissions."""
    data = await auth_service.get_me(current_user)
    return {"data": data}


@router.post("/logout", status_code=200)
async def logout(current_user: User = Depends(get_current_user)):
    """Logout — client-side token discard. Server acknowledges."""
    return {"message": "Logged out successfully"}
