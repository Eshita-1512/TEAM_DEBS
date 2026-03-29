"""ExpenseReceipt model — uploaded receipt file and OCR processing state.

Owned by BE-2.
"""

from sqlalchemy import Column, String, Integer, Enum, ForeignKey, BigInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin
from app.enums import OcrStatus


class ExpenseReceipt(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "expense_receipts"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    file_name = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    mime_type = Column(String(100), nullable=False)
    ocr_status = Column(
        Enum(OcrStatus, name="ocr_status"),
        nullable=False,
        default=OcrStatus.pending,
        index=True,
    )

    # Relationships
    uploader = relationship("User", lazy="selectin")
    ocr_records = relationship("OcrProcessingRecord", back_populates="receipt", lazy="selectin")
    extracted_lines = relationship("ExpenseReceiptLine", back_populates="receipt", lazy="selectin")
