"""OCR pipeline orchestrator — runs the full extraction pipeline on a receipt.

Pipeline stages per §11:
1. Raw OCR (EasyOCR)
2. LLM Interpretation (semantic recovery via Ollama)
3. LLM Structured Extraction (JSON fields via Ollama)
4. Regex Validation & Correction
5. Line Structuring (create ExpenseReceiptLine records)

Every stage output is persisted in OcrProcessingRecord for auditability.
Owned by BE-2.
"""

from __future__ import annotations

import asyncio
import time
import logging
import uuid
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import OcrStatus, OcrStage
from app.models.receipt import ExpenseReceipt
from app.models.ocr import OcrProcessingRecord, ExpenseReceiptLine
from app.services.ollama_adapter import OllamaAdapterBase, get_ollama_adapter
from app.services.regex_validator import validate_and_correct

logger = logging.getLogger(__name__)

# Module-level EasyOCR reader (lazy-initialised, reused across calls)
_easyocr_reader = None


def _get_easyocr_reader():
    """Lazily initialise and cache the EasyOCR reader.

    Creating the reader is expensive (loads models), so we do it once.
    """
    global _easyocr_reader
    if _easyocr_reader is None:
        import easyocr
        _easyocr_reader = easyocr.Reader(["en"], gpu=False)
    return _easyocr_reader


async def run_ocr_pipeline(
    db: AsyncSession,
    receipt: ExpenseReceipt,
    adapter: Optional[OllamaAdapterBase] = None,
) -> None:
    """Execute the full OCR pipeline for a receipt.

    Updates the receipt ocr_status and persists stage outputs.
    This is designed to be called as an async task after upload.
    """
    if adapter is None:
        adapter = get_ollama_adapter()

    receipt.ocr_status = OcrStatus.processing
    await db.flush()

    try:
        # ---- Stage 1: Raw OCR (EasyOCR) ----
        raw_result = await _run_stage(
            db, receipt, adapter, OcrStage.raw_ocr,
            _stage_raw_ocr_easyocr, receipt,
        )
        if not raw_result:
            receipt.ocr_status = OcrStatus.failed
            await db.flush()
            return

        raw_text = raw_result.output_text or ""

        # ---- Stage 2: LLM Interpretation ----
        interp_result = await _run_stage(
            db, receipt, adapter, OcrStage.llm_interpretation,
            _stage_llm_interpretation, adapter, raw_text,
        )
        interpreted_text = (interp_result.output_text if interp_result else raw_text) or raw_text

        # ---- Stage 3: LLM Structured Extraction ----
        struct_result = await _run_stage(
            db, receipt, adapter, OcrStage.llm_structured,
            _stage_llm_structured, adapter, interpreted_text,
        )
        structured_data = (struct_result.output_json if struct_result else {}) or {}

        # ---- Stage 4: Regex Validation ----
        validated_result = await _run_stage(
            db, receipt, adapter, OcrStage.regex_validated,
            _stage_regex_validation, structured_data,
        )
        validated_data = (validated_result.output_json if validated_result else structured_data) or structured_data

        # ---- Stage 5: Line Structuring ----
        await _create_line_items(db, receipt, validated_result, validated_data)

        receipt.ocr_status = OcrStatus.completed
        await db.flush()

    except Exception as exc:
        logger.exception(f"OCR pipeline failed for receipt {receipt.id}")
        receipt.ocr_status = OcrStatus.failed
        error_record = OcrProcessingRecord(
            id=uuid.uuid4(),
            receipt_id=receipt.id,
            stage=OcrStage.raw_ocr,
            error_message=str(exc),
        )
        db.add(error_record)
        await db.flush()


async def _run_stage(
    db: AsyncSession,
    receipt: ExpenseReceipt,
    adapter: OllamaAdapterBase,
    stage: OcrStage,
    stage_fn,
    *args,
) -> Optional[OcrProcessingRecord]:
    """Run a single pipeline stage, persist the record, and return it."""
    try:
        record = await stage_fn(db, receipt, *args)
        return record
    except Exception as exc:
        logger.warning(f"OCR stage {stage.value} failed for receipt {receipt.id}: {exc}")
        error_record = OcrProcessingRecord(
            id=uuid.uuid4(),
            receipt_id=receipt.id,
            stage=stage,
            error_message=str(exc),
        )
        db.add(error_record)
        await db.flush()
        return None


# ---------------------------------------------------------------------------
# Stage 1: EasyOCR raw text extraction
# ---------------------------------------------------------------------------

def _easyocr_extract(file_path: str) -> dict[str, Any]:
    """Run EasyOCR synchronously on an image file.

    Returns dict with text, confidence, and timing info.
    """
    start = time.monotonic()
    reader = _get_easyocr_reader()

    # EasyOCR returns list of (bbox, text, confidence) tuples
    results = reader.readtext(file_path)

    # Concatenate all detected text blocks
    text_parts = []
    confidences = []
    for (_bbox, text, conf) in results:
        text_parts.append(text)
        confidences.append(conf)

    full_text = "\n".join(text_parts)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    elapsed_ms = int((time.monotonic() - start) * 1000)
    return {
        "text": full_text.strip(),
        "confidence": round(avg_confidence, 4),
        "model": "easyocr",
        "time_ms": elapsed_ms,
    }


async def _stage_raw_ocr_easyocr(
    db: AsyncSession,
    receipt: ExpenseReceipt,
    source_receipt: ExpenseReceipt,
) -> OcrProcessingRecord:
    """Stage 1: Extract raw text from receipt image using EasyOCR."""
    # Run EasyOCR in a thread to avoid blocking the event loop
    result = await asyncio.to_thread(_easyocr_extract, source_receipt.file_path)

    record = OcrProcessingRecord(
        id=uuid.uuid4(),
        receipt_id=receipt.id,
        stage=OcrStage.raw_ocr,
        input_text=None,
        output_text=result["text"],
        confidence=Decimal(str(result["confidence"])),
        model_used=result["model"],
        processing_time_ms=result["time_ms"],
    )
    db.add(record)
    await db.flush()
    return record


# ---------------------------------------------------------------------------
# Stages 2–4: LLM + Regex  (unchanged, uses Ollama adapter)
# ---------------------------------------------------------------------------

async def _stage_llm_interpretation(
    db: AsyncSession,
    receipt: ExpenseReceipt,
    adapter: OllamaAdapterBase,
    raw_text: str,
) -> OcrProcessingRecord:
    """Stage 2: LLM interprets noisy OCR text."""
    result = await adapter.interpret_ocr_text(raw_text)
    record = OcrProcessingRecord(
        id=uuid.uuid4(),
        receipt_id=receipt.id,
        stage=OcrStage.llm_interpretation,
        input_text=raw_text,
        output_text=result["text"],
        confidence=Decimal(str(result.get("confidence", 0))),
        model_used=result.get("model"),
        processing_time_ms=result.get("time_ms"),
    )
    db.add(record)
    await db.flush()
    return record


async def _stage_llm_structured(
    db: AsyncSession,
    receipt: ExpenseReceipt,
    adapter: OllamaAdapterBase,
    interpreted_text: str,
) -> OcrProcessingRecord:
    """Stage 3: LLM extracts structured JSON fields."""
    result = await adapter.extract_structured_fields(interpreted_text)
    record = OcrProcessingRecord(
        id=uuid.uuid4(),
        receipt_id=receipt.id,
        stage=OcrStage.llm_structured,
        input_text=interpreted_text,
        output_text=result.get("raw_response"),
        output_json=result.get("data"),
        confidence=Decimal(str(result.get("confidence", 0))),
        model_used=result.get("model"),
        processing_time_ms=result.get("time_ms"),
    )
    db.add(record)
    await db.flush()
    return record


async def _stage_regex_validation(
    db: AsyncSession,
    receipt: ExpenseReceipt,
    structured_data: dict,
) -> OcrProcessingRecord:
    """Stage 4: Regex validation and correction."""
    start = time.monotonic()
    corrected, warnings = validate_and_correct(structured_data)
    elapsed_ms = int((time.monotonic() - start) * 1000)

    record = OcrProcessingRecord(
        id=uuid.uuid4(),
        receipt_id=receipt.id,
        stage=OcrStage.regex_validated,
        input_text=None,
        output_json=corrected,
        warnings=warnings if warnings else None,
        processing_time_ms=elapsed_ms,
    )
    db.add(record)
    await db.flush()
    return record


async def _create_line_items(
    db: AsyncSession,
    receipt: ExpenseReceipt,
    ocr_record: Optional[OcrProcessingRecord],
    validated_data: dict,
) -> list[ExpenseReceiptLine]:
    """Stage 5: Create line-item records from validated extraction."""
    lines = []
    raw_lines = validated_data.get("line_items", [])
    if not isinstance(raw_lines, list):
        return lines

    ocr_record_id = ocr_record.id if ocr_record else None

    for i, raw_line in enumerate(raw_lines):
        try:
            amount = Decimal(str(raw_line.get("amount", "0")))
        except (InvalidOperation, ValueError):
            amount = Decimal("0")

        unit_price = None
        if raw_line.get("unit_price"):
            try:
                unit_price = Decimal(str(raw_line["unit_price"]))
            except (InvalidOperation, ValueError):
                pass

        line = ExpenseReceiptLine(
            id=uuid.uuid4(),
            receipt_id=receipt.id,
            ocr_record_id=ocr_record_id,
            name=raw_line.get("name", f"Item {i + 1}"),
            amount=amount,
            quantity=str(raw_line.get("quantity")) if raw_line.get("quantity") else None,
            unit_price=unit_price,
            category=raw_line.get("category"),
            description=raw_line.get("description"),
            confidence=Decimal(str(raw_line.get("confidence", 0.7))) if raw_line.get("confidence") else Decimal("0.7"),
            included=True,
            sort_order=i,
        )
        db.add(line)
        lines.append(line)

    await db.flush()
    return lines
