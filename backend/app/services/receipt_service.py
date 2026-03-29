"""Receipt service — upload, retrieval, and OCR orchestration.

Handles receipt file validation, storage, DB record management,
and triggers the OCR pipeline.

Owned by BE-2.
"""

from __future__ import annotations

import os
import uuid
import logging
from typing import Optional

from fastapi import UploadFile, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.enums import OcrStatus
from app.models.receipt import ExpenseReceipt
from app.models.user import User
from app.services.ocr_pipeline import run_ocr_pipeline
from app.services.audit_service import log_event

logger = logging.getLogger(__name__)
settings = get_settings()


async def upload_receipt(
    db: AsyncSession,
    file: UploadFile,
    current_user: User,
) -> ExpenseReceipt:
    """Validate, save, and create DB record for an uploaded receipt.

    Triggers OCR pipeline after saving.
    """
    # ---- Validate file ----
    _validate_file(file)

    # ---- Save file to disk ----
    file_ext = os.path.splitext(file.filename or "receipt")[1] or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{file_ext}"
    upload_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.company_id))
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_name)

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    # ---- Create DB record ----
    receipt = ExpenseReceipt(
        id=uuid.uuid4(),
        company_id=current_user.company_id,
        uploaded_by=current_user.id,
        file_name=file.filename or unique_name,
        file_path=file_path,
        file_size=len(contents),
        mime_type=file.content_type or "application/octet-stream",
        ocr_status=OcrStatus.pending,
    )
    db.add(receipt)
    await db.flush()

    # ---- Audit log ----
    await log_event(
        db,
        actor_id=current_user.id,
        action="receipt_uploaded",
        entity_type="receipt",
        entity_id=receipt.id,
        company_id=current_user.company_id,
        details_after={"file_name": receipt.file_name, "mime_type": receipt.mime_type},
    )

    # ---- Run OCR pipeline (in-process for v1) ----
    try:
        await run_ocr_pipeline(db, receipt)
    except Exception as exc:
        logger.exception(f"OCR pipeline error for receipt {receipt.id}")
        receipt.ocr_status = OcrStatus.failed
        await db.flush()

    return receipt


async def get_receipt(
    db: AsyncSession,
    receipt_id: uuid.UUID,
    current_user: User,
) -> ExpenseReceipt:
    """Fetch a receipt by ID with company-scoped authorization."""
    stmt = select(ExpenseReceipt).where(ExpenseReceipt.id == receipt_id)
    result = await db.execute(stmt)
    receipt = result.scalar_one_or_none()

    if receipt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")

    if receipt.company_id != current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return receipt


async def reprocess_receipt(
    db: AsyncSession,
    receipt_id: uuid.UUID,
    current_user: User,
) -> ExpenseReceipt:
    """Re-run the OCR pipeline on an existing receipt."""
    receipt = await get_receipt(db, receipt_id, current_user)

    # Reset OCR status
    receipt.ocr_status = OcrStatus.pending
    await db.flush()

    # ---- Audit log ----
    await log_event(
        db,
        actor_id=current_user.id,
        action="receipt_reprocessed",
        entity_type="receipt",
        entity_id=receipt.id,
        company_id=current_user.company_id,
    )

    # Re-run pipeline
    try:
        await run_ocr_pipeline(db, receipt)
    except Exception as exc:
        logger.exception(f"OCR reprocess error for receipt {receipt.id}")
        receipt.ocr_status = OcrStatus.failed
        await db.flush()

    return receipt


def _validate_file(file: UploadFile) -> None:
    """Validate file type and size."""
    if not file.content_type or file.content_type not in settings.ALLOWED_RECEIPT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Allowed: {settings.ALLOWED_RECEIPT_TYPES}",
        )

    # Check file size if available from headers
    if file.size and file.size > settings.MAX_RECEIPT_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {settings.MAX_RECEIPT_SIZE_MB}MB",
        )
