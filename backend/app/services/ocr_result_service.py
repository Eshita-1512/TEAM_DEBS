"""OCR result service — retrieves and formats OCR pipeline output.

Builds the §27.6 OCR response shape from persisted pipeline records.
Owned by BE-2.
"""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.enums import OcrStage
from app.models.receipt import ExpenseReceipt
from app.models.ocr import OcrProcessingRecord, ExpenseReceiptLine
from app.schemas.ocr import (
    OcrResultResponse,
    OcrStructuredFields,
    OcrLineItemResponse,
)


async def get_ocr_result(
    db: AsyncSession,
    receipt: ExpenseReceipt,
) -> OcrResultResponse:
    """Build the §27.6 OCR response from persisted records."""

    # Fetch OCR records
    stmt = (
        select(OcrProcessingRecord)
        .where(OcrProcessingRecord.receipt_id == receipt.id)
        .order_by(OcrProcessingRecord.created_at.asc())
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    # Fetch extracted lines
    lines_stmt = (
        select(ExpenseReceiptLine)
        .where(ExpenseReceiptLine.receipt_id == receipt.id)
        .order_by(ExpenseReceiptLine.sort_order.asc())
    )
    lines_result = await db.execute(lines_stmt)
    lines = lines_result.scalars().all()

    # Find stage outputs
    raw_text = None
    structured_data = None
    validated_data = None
    overall_confidence = None
    all_warnings = []

    for rec in records:
        if rec.stage == OcrStage.raw_ocr and rec.output_text:
            raw_text = rec.output_text
        if rec.stage == OcrStage.llm_structured and rec.output_json:
            structured_data = rec.output_json
        if rec.stage == OcrStage.regex_validated:
            validated_data = rec.output_json
            if rec.warnings:
                all_warnings.extend(rec.warnings)
        if rec.confidence and (overall_confidence is None or rec.confidence < overall_confidence):
            overall_confidence = rec.confidence

    # Use validated data if available, fall back to structured
    final_data = validated_data or structured_data or {}

    structured_fields = None
    if final_data:
        structured_fields = OcrStructuredFields(
            merchant_name=final_data.get("merchant_name"),
            expense_date=final_data.get("expense_date"),
            currency=final_data.get("currency"),
            total_amount=final_data.get("total_amount"),
            subtotal=final_data.get("subtotal"),
            tax=final_data.get("tax"),
            description_hint=final_data.get("description_hint"),
        )

    line_item_responses = [
        OcrLineItemResponse(
            id=line.id,
            name=line.name,
            amount=str(line.amount),
            quantity=line.quantity,
            unit_price=str(line.unit_price) if line.unit_price else None,
            category=line.category,
            confidence=str(line.confidence) if line.confidence else None,
            included=line.included,
        )
        for line in lines
    ]

    ocr_status = receipt.ocr_status.value if hasattr(receipt.ocr_status, 'value') else str(receipt.ocr_status)

    return OcrResultResponse(
        receipt_id=receipt.id,
        status=ocr_status,
        confidence=str(overall_confidence) if overall_confidence else None,
        raw_text=raw_text,
        structured_fields=structured_fields,
        line_items=line_item_responses,
        warnings=all_warnings,
    )
