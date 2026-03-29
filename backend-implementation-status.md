# Backend Implementation Status

This file tracks the backend-only state of the reimbursement system. It is intentionally separate from frontend notes.

## Implemented

- Company bootstrap on signup with admin user creation
- Role-based auth and permission checks
- Manager assignment model and service
- Expense submission with original and converted currency amounts
- Locked submission-time conversion rate
- Receipt and OCR-related backend models
- Sequential approval workflow with hold, resume, reject, and approve
- Conditional approval rules with snapshotting and trigger evaluation
- Audit logging hooks for major workflow actions

## Backend Gaps To Watch

- Manager expense visibility should remain limited to direct reports, not company-wide access
- Approval and trigger audit records should keep strong foreign-key integrity
- Pydantic schemas should avoid mutable defaults

## Notes

- The backend is already structured as a layered FastAPI application.
- The main remaining work is refinement, not a rewrite.
