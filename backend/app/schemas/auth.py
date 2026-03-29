"""Auth schemas matching Section 27.1 of the build spec."""

from pydantic import BaseModel, EmailStr
from uuid import UUID


class SignupRequest(BaseModel):
    company_name: str
    country_code: str
    admin_name: str
    admin_email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserInfo(BaseModel):
    id: str
    name: str
    email: str
    role: str


class CompanyInfo(BaseModel):
    id: str
    name: str
    country_code: str
    default_currency: str


class MeData(BaseModel):
    user: UserInfo
    company: CompanyInfo
    permissions: list[str]


class MeResponse(BaseModel):
    data: MeData
