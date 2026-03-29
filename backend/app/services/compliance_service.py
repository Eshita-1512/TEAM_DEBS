"""Compliance export service — generate text-file audit exports."""

from __future__ import annotations

from typing import Optional
from uuid import UUID
from datetime import datetime, timezone
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.compliance_export import ComplianceExport
from app.models.audit_log import AuditLog
from app.services.audit_query_service import query_audit_logs
from app.services.audit_service import log_event


EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "exports")


async def list_exports(
    db: AsyncSession,
    company_id: UUID,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[ComplianceExport], int]:
    """List compliance exports for a company."""
    from sqlalchemy import func

    count_q = select(func.count()).select_from(ComplianceExport).where(
        ComplianceExport.company_id == company_id
    )
    total = (await db.execute(count_q)).scalar() or 0

    items_q = (
        select(ComplianceExport)
        .where(ComplianceExport.company_id == company_id)
        .order_by(ComplianceExport.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(items_q)
    items = list(result.scalars().all())
    return items, total


async def create_export(
    db: AsyncSession,
    company_id: UUID,
    actor_id: UUID,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    action_types: Optional[list[str]] = None,
    entity_types: Optional[list[str]] = None,
) -> ComplianceExport:
    """Generate a compliance text log export.

    Queries audit logs matching the filters and writes them to a text file.
    """
    filters = {
        "date_from": date_from.isoformat() if date_from else None,
        "date_to": date_to.isoformat() if date_to else None,
        "action_types": action_types,
        "entity_types": entity_types,
    }

    export = ComplianceExport(
        company_id=company_id,
        requested_by=actor_id,
        filters=filters,
        status="pending",
    )
    db.add(export)
    await db.flush()

    try:
        # Query matching audit logs (get all, no pagination limit)
        logs, total = await query_audit_logs(
            db,
            company_id=company_id,
            action=action_types[0] if action_types and len(action_types) == 1 else None,
            date_from=date_from,
            date_to=date_to,
            offset=0,
            limit=10000,  # reasonable upper bound
        )

        # Filter by action_types if multiple
        if action_types and len(action_types) > 1:
            logs = [l for l in logs if l.action in action_types]

        # Filter by entity_types
        if entity_types:
            logs = [l for l in logs if l.entity_type in entity_types]

        # Generate text file
        os.makedirs(EXPORT_DIR, exist_ok=True)
        file_name = f"compliance_export_{export.id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.txt"
        file_path = os.path.join(EXPORT_DIR, file_name)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(f"Compliance Export Report\n")
            f.write(f"{'=' * 60}\n")
            f.write(f"Company ID: {company_id}\n")
            f.write(f"Generated: {datetime.now(timezone.utc).isoformat()}\n")
            f.write(f"Requested by: {actor_id}\n")
            f.write(f"Filters: {filters}\n")
            f.write(f"Total Records: {len(logs)}\n")
            f.write(f"{'=' * 60}\n\n")

            for log_entry in logs:
                f.write(f"[{log_entry.timestamp.isoformat()}] ")
                f.write(f"Action: {log_entry.action} | ")
                f.write(f"Entity: {log_entry.entity_type}")
                if log_entry.entity_id:
                    f.write(f" ({log_entry.entity_id})")
                f.write(f" | Actor: {log_entry.actor_id or 'system'}")
                if log_entry.compliance_note:
                    f.write(f" | Note: {log_entry.compliance_note}")
                f.write("\n")
                if log_entry.details_before:
                    f.write(f"  Before: {log_entry.details_before}\n")
                if log_entry.details_after:
                    f.write(f"  After: {log_entry.details_after}\n")
                f.write("\n")

        # Update export record
        export.file_path = file_path
        export.file_name = file_name
        export.record_count = str(len(logs))
        export.status = "completed"
        export.completed_at = datetime.now(timezone.utc)

    except Exception as e:
        export.status = "failed"
        export.error_message = str(e)

    await db.flush()

    # Audit the export itself
    await log_event(
        db,
        actor_id=actor_id,
        action="compliance_export",
        entity_type="compliance_export",
        entity_id=export.id,
        company_id=company_id,
        details_after={"status": export.status, "file_name": export.file_name, "record_count": export.record_count},
    )

    return export
