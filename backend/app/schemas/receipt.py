"""Pydantic schemas for receipt upload and retrieval — matching §27.6."""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class ReceiptUploadResponse(BaseModel):
    """Response after uploading a receipt."""
    id: UUID
    file_name: str
    mime_type: str
    ocr_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReceiptDetailResponse(BaseModel):
    """Full receipt detail."""
    id: UUID
    file_name: str
    mime_type: str
    file_size: int
    ocr_status: str
    uploaded_by: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
