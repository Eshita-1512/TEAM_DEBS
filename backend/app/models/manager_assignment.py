"""ManagerAssignment model — employee-to-manager reporting relationship."""

from sqlalchemy import Column, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class ManagerAssignment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "manager_assignments"

    employee_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    manager_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    effective_from = Column(DateTime(timezone=True), nullable=True)

    employee = relationship("User", foreign_keys=[employee_id], lazy="selectin")
    manager = relationship("User", foreign_keys=[manager_id], lazy="selectin")
