"""Receipt upload and OCR endpoints — §27.6.

Thin router that delegates to receipt_service and ocr_result_service.
Owned by BE-2.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.pagination import SingleResponse
from app.schemas.receipt import ReceiptUploadResponse, ReceiptDetailResponse
from app.schemas.ocr import OcrResultResponse
from app.services import receipt_service
from app.services.ocr_result_service import get_ocr_result

router = APIRouter(prefix="/api/v1/receipts", tags=["Receipts"])


@router.post("", response_model=SingleResponse, status_code=201)
async def upload_receipt(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a receipt image and trigger OCR processing.

    Accepts multipart/form-data with a single file field.
    Returns receipt record ID and OCR processing state.
    """
    receipt = await receipt_service.upload_receipt(db, file, current_user)
    return {
        "data": ReceiptUploadResponse(
            id=receipt.id,
            file_name=receipt.file_name,
            mime_type=receipt.mime_type,
            ocr_status=receipt.ocr_status.value if hasattr(receipt.ocr_status, 'value') else str(receipt.ocr_status),
            created_at=receipt.created_at,
        )
    }


@router.get("/{receipt_id}", response_model=SingleResponse)
async def get_receipt(
    receipt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get receipt details by ID."""
    receipt = await receipt_service.get_receipt(db, receipt_id, current_user)
    return {
        "data": ReceiptDetailResponse(
            id=receipt.id,
            file_name=receipt.file_name,
            mime_type=receipt.mime_type,
            file_size=receipt.file_size,
            ocr_status=receipt.ocr_status.value if hasattr(receipt.ocr_status, 'value') else str(receipt.ocr_status),
            uploaded_by=receipt.uploaded_by,
            created_at=receipt.created_at,
            updated_at=receipt.updated_at,
        )
    }


@router.get("/{receipt_id}/ocr", response_model=SingleResponse)
async def get_ocr_results(
    receipt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get OCR extraction results for a receipt.

    Pollable endpoint — returns current processing state and any
    extracted structured fields and line items.
    """
    receipt = await receipt_service.get_receipt(db, receipt_id, current_user)
    ocr_result = await get_ocr_result(db, receipt)
    return {"data": ocr_result}


@router.post("/{receipt_id}/reprocess", response_model=SingleResponse, status_code=200)
async def reprocess_receipt(
    receipt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-run the OCR pipeline on an existing receipt."""
    receipt = await receipt_service.reprocess_receipt(db, receipt_id, current_user)
    return {
        "data": ReceiptUploadResponse(
            id=receipt.id,
            file_name=receipt.file_name,
            mime_type=receipt.mime_type,
            ocr_status=receipt.ocr_status.value if hasattr(receipt.ocr_status, 'value') else str(receipt.ocr_status),
            created_at=receipt.created_at,
        )
    }
