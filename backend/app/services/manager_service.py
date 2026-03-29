"""Manager assignment service — create and manage employee-to-manager relationships."""

from typing import Optional
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.models.manager_assignment import ManagerAssignment
from app.services.audit_service import log_event


async def list_assignments(
    db: AsyncSession,
    company_id: UUID,
    *,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """List manager assignments for the company with pagination."""
    # Build a query joining with employee and manager users in the same company
    base_query = (
        select(ManagerAssignment)
        .join(User, ManagerAssignment.employee_id == User.id)
        .where(User.company_id == company_id)
    )

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total_items = total_result.scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    assignments_result = await db.execute(
        base_query.order_by(ManagerAssignment.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    assignments = assignments_result.scalars().all()

    items = [_assignment_to_dict(a) for a in assignments]

    total_pages = (total_items + page_size - 1) // page_size if total_items > 0 else 0

    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": total_pages,
        },
    }


async def create_assignment(
    db: AsyncSession,
    company_id: UUID,
    admin_id: UUID,
    *,
    employee_id: UUID,
    manager_id: UUID,
) -> dict:
    """Create a new manager assignment.

    Validates:
    - Both users belong to the same company
    - Manager has manager or admin role
    - Employee is not the same as manager
    - No existing active assignment for this employee (deactivates old one)
    """
    if employee_id == manager_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee and manager cannot be the same person",
        )

    # Validate employee exists in the company
    employee = await _load_company_user(db, employee_id, company_id)
    # Validate manager exists in the company and has the right role
    manager = await _load_company_user(db, manager_id, company_id)

    if manager.role not in (UserRole.manager, UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned manager must have 'manager' or 'admin' role",
        )

    # Deactivate any existing active assignment for this employee
    existing_result = await db.execute(
        select(ManagerAssignment).where(
            and_(
                ManagerAssignment.employee_id == employee_id,
                ManagerAssignment.is_active == True,
            )
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        existing.is_active = False
        await db.flush()

    # Create new assignment
    assignment = ManagerAssignment(
        employee_id=employee_id,
        manager_id=manager_id,
        is_active=True,
    )
    db.add(assignment)
    await db.flush()

    await log_event(
        db,
        actor_id=admin_id,
        action="manager_assignment_created",
        entity_type="manager_assignment",
        entity_id=assignment.id,
        company_id=company_id,
        details_after={
            "employee_id": str(employee_id),
            "employee_name": employee.name,
            "manager_id": str(manager_id),
            "manager_name": manager.name,
        },
    )

    return _assignment_to_dict(assignment)


async def update_assignment(
    db: AsyncSession,
    assignment_id: UUID,
    company_id: UUID,
    admin_id: UUID,
    *,
    manager_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
) -> dict:
    """Update an existing manager assignment. Emits audit log."""
    assignment = await _load_assignment(db, assignment_id, company_id)
    before = {
        "manager_id": str(assignment.manager_id),
        "is_active": assignment.is_active,
    }

    if manager_id is not None:
        if manager_id == assignment.employee_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee and manager cannot be the same person",
            )
        manager = await _load_company_user(db, manager_id, company_id)
        if manager.role not in (UserRole.manager, UserRole.admin):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned manager must have 'manager' or 'admin' role",
            )
        assignment.manager_id = manager_id

    if is_active is not None:
        assignment.is_active = is_active

    await db.flush()

    after = {
        "manager_id": str(assignment.manager_id),
        "is_active": assignment.is_active,
    }
    await log_event(
        db,
        actor_id=admin_id,
        action="manager_assignment_updated",
        entity_type="manager_assignment",
        entity_id=assignment.id,
        company_id=company_id,
        details_before=before,
        details_after=after,
    )

    return _assignment_to_dict(assignment)


# ── Helpers ───────────────────────────────────────────────────────────

async def _load_company_user(db: AsyncSession, user_id: UUID, company_id: UUID) -> User:
    result = await db.execute(
        select(User).where(and_(User.id == user_id, User.company_id == company_id))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found in this company",
        )
    return user


async def _load_assignment(
    db: AsyncSession, assignment_id: UUID, company_id: UUID
) -> ManagerAssignment:
    result = await db.execute(
        select(ManagerAssignment)
        .join(User, ManagerAssignment.employee_id == User.id)
        .where(
            and_(
                ManagerAssignment.id == assignment_id,
                User.company_id == company_id,
            )
        )
    )
    assignment = result.scalar_one_or_none()
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manager assignment not found",
        )
    return assignment


def _assignment_to_dict(assignment: ManagerAssignment) -> dict:
    return {
        "id": str(assignment.id),
        "employee_id": str(assignment.employee_id),
        "employee_name": assignment.employee.name if assignment.employee else "",
        "manager_id": str(assignment.manager_id),
        "manager_name": assignment.manager.name if assignment.manager else "",
        "is_active": assignment.is_active,
    }
