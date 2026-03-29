"""Pydantic schemas for OCR pipeline results — matching §27.6 OCR response shape."""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel


class OcrLineItemResponse(BaseModel):
    """Single extracted line item from OCR."""
    id: UUID
    name: str
    amount: str  # decimal string per spec
    quantity: Optional[str] = None
    unit_price: Optional[str] = None
    category: Optional[str] = None
    confidence: Optional[str] = None
    included: bool = True

    class Config:
        from_attributes = True


class OcrStructuredFields(BaseModel):
    """Structured fields extracted from the receipt."""
    merchant_name: Optional[str] = None
    expense_date: Optional[str] = None
    currency: Optional[str] = None
    total_amount: Optional[str] = None
    subtotal: Optional[str] = None
    tax: Optional[str] = None
    description_hint: Optional[str] = None


class OcrResultResponse(BaseModel):
    """Full OCR result matching §27.6 response shape."""
    receipt_id: UUID
    status: str
    confidence: Optional[str] = None
    raw_text: Optional[str] = None
    structured_fields: Optional[OcrStructuredFields] = None
    line_items: list[OcrLineItemResponse] = []
    warnings: list[str] = []


class OcrStageDetail(BaseModel):
    """Detail of a single OCR pipeline stage for audit/debug."""
    stage: str
    input_text: Optional[str] = None
    output_text: Optional[str] = None
    output_json: Optional[dict] = None
    confidence: Optional[str] = None
    warnings: list[str] = []
    processing_time_ms: Optional[int] = None
    model_used: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
        protected_namespaces = ()
