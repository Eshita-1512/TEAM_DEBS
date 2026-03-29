"""Manager assignment schemas matching Section 27.2."""

from pydantic import BaseModel
from typing import Optional


class ManagerAssignmentCreate(BaseModel):
    employee_id: str
    manager_id: str


class ManagerAssignmentUpdate(BaseModel):
    manager_id: Optional[str] = None
    is_active: Optional[bool] = None


class ManagerAssignmentResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    manager_id: str
    manager_name: str
    is_active: bool
