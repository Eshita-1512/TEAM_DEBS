import { describe, expect, it } from 'vitest';
import { getPathBreadcrumbs } from '@/lib/navigation';

describe('getPathBreadcrumbs', () => {
  it('builds an admin trail for nested admin routes', () => {
    expect(getPathBreadcrumbs('/app/admin/users', 'admin')).toEqual([
      { label: 'Workspace', to: '/app/admin/users' },
      { label: 'Administration' },
      { label: 'Users', to: '/app/admin/users' },
    ]);
  });

  it('builds a workflow trail for expense detail pages', () => {
    expect(getPathBreadcrumbs('/app/expenses/exp_123', 'employee')).toEqual([
      { label: 'Workspace', to: '/app/expenses' },
      { label: 'Workflow' },
      { label: 'Expenses', to: '/app/expenses' },
      { label: 'Expense detail' },
    ]);
  });

  it('keeps review pages attached to the approvals queue', () => {
    expect(getPathBreadcrumbs('/app/approvals/exp_123', 'manager')).toEqual([
      { label: 'Workspace', to: '/app/approvals' },
      { label: 'Workflow' },
      { label: 'Approvals', to: '/app/approvals' },
      { label: 'Review' },
    ]);
  });
});
