"""Common response envelopes matching Section 26.7 of the build spec."""

from pydantic import BaseModel
from typing import Any, Generic, Optional, TypeVar

T = TypeVar("T")


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class PaginatedResponse(BaseModel):
    items: list[Any]
    pagination: PaginationMeta


class SingleResponse(BaseModel, Generic[T]):
    data: T


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[dict[str, Any]] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
