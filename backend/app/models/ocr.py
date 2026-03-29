"""OCR pipeline models — processing records and extracted line items.

OcrProcessingRecord stores output from each pipeline stage.
ExpenseReceiptLine stores individual extracted line items from a receipt.

Owned by BE-2.
"""

from sqlalchemy import Column, String, Integer, Numeric, Boolean, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin
from app.enums import OcrStage


class OcrProcessingRecord(Base, UUIDMixin, TimestampMixin):
    """Stores output from each OCR pipeline stage for auditability."""
    __tablename__ = "ocr_processing_records"

    receipt_id = Column(UUID(as_uuid=True), ForeignKey("expense_receipts.id"), nullable=False, index=True)
    stage = Column(Enum(OcrStage, name="ocr_stage"), nullable=False)
    input_text = Column(Text, nullable=True)
    output_text = Column(Text, nullable=True)
    output_json = Column(JSONB, nullable=True)
    confidence = Column(Numeric(precision=5, scale=4), nullable=True)
    warnings = Column(JSONB, nullable=True)  # list of warning strings
    processing_time_ms = Column(Integer, nullable=True)
    model_used = Column(String(200), nullable=True)
    error_message = Column(Text, nullable=True)

    # Relationships
    receipt = relationship("ExpenseReceipt", back_populates="ocr_records")


class ExpenseReceiptLine(Base, UUIDMixin, TimestampMixin):
    """An individual line item extracted from a receipt/bill."""
    __tablename__ = "expense_receipt_lines"

    receipt_id = Column(UUID(as_uuid=True), ForeignKey("expense_receipts.id"), nullable=False, index=True)
    ocr_record_id = Column(UUID(as_uuid=True), ForeignKey("ocr_processing_records.id"), nullable=True)
    name = Column(String(500), nullable=False)
    amount = Column(Numeric(precision=18, scale=2), nullable=False)
    quantity = Column(String(50), nullable=True)
    unit_price = Column(Numeric(precision=18, scale=2), nullable=True)
    category = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    confidence = Column(Numeric(precision=5, scale=4), nullable=True)
    included = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)

    # Relationships
    receipt = relationship("ExpenseReceipt", back_populates="extracted_lines")
    ocr_record = relationship("OcrProcessingRecord", lazy="selectin")
