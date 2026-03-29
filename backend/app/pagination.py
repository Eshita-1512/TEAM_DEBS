"""Shared pagination utilities matching the build-spec API envelope."""

from __future__ import annotations

import math
from typing import Any, Generic, TypeVar, Optional

from pydantic import BaseModel

T = TypeVar("T")


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class PaginatedResponse(BaseModel):
    items: list[Any]
    pagination: PaginationMeta


class SingleResponse(BaseModel):
    data: Any


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[dict] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


def paginate(
    items: list,
    total: int,
    page: int,
    page_size: int,
) -> dict:
    """Build the standard paginated response envelope."""
    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total,
            "total_pages": math.ceil(total / page_size) if page_size > 0 else 0,
        },
    }
