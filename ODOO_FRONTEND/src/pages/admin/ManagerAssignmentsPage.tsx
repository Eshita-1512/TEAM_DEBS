import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { GitBranch, Plus, Pencil, Users } from 'lucide-react';
import { managerAssignments, users } from '@/api/client';
import { DataTable, EmptyState, PageHeader, StatCard, type Column } from '@/components/shared';
import { usePolling } from '@/hooks/usePolling';
import type { ListParams, ManagerAssignment, SortOrder, UserDetail } from '@/types/api';

export function ManagerAssignmentsPage() {
  const [params, setParams] = useState<ListParams>({ page: 1, page_size: 50, sort_by: 'employee_name', sort_order: 'asc' });
  const [allUsers, setAllUsers] = useState<UserDetail[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<ManagerAssignment | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [isActive, setIsActive] = useState(true);

  const fetcher = useCallback(() => managerAssignments.list(params), [params]);
  const { data, loading, refresh } = usePolling({ fetcher, enabled: true });

  useEffect(() => {
    users.list({ page: 1, page_size: 200 }).then(res => setAllUsers(res.items)).catch(() => {});
  }, []);

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  const employees = allUsers.filter(user => user.role === 'employee');
  const managers = allUsers.filter(user => user.role === 'manager' || user.role === 'admin');

  const totals = items.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.is_active) acc.active += 1;
      return acc;
    },
    { total: 0, active: 0 },
  );

  const openCreate = () => {
    setEditItem(null);
    setEmployeeId('');
    setManagerId('');
    setIsActive(true);
    setFormOpen(true);
  };

  const openEdit = (item: ManagerAssignment) => {
    setEditItem(item);
    setEmployeeId(item.employee_id);
    setManagerId(item.manager_id);
    setIsActive(item.is_active);
    setFormOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormLoading(true);
    try {
      if (editItem) {
        await managerAssignments.update(editItem.id, { manager_id: managerId, is_active: isActive });
      } else {
        await managerAssignments.create({ employee_id: employeeId, manager_id: managerId });
      }
      setFormOpen(false);
      await refresh();
    } finally {
      setFormLoading(false);
    }
  };

  const columns: Column<ManagerAssignment>[] = [
    {
      key: 'employee_name',
      label: 'Employee',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold uppercase" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.75)', color: 'var(--text-tertiary)' }}>
            {item.employee_name.charAt(0)}
          </div>
          <div>
            <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.employee_name}</div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.id.slice(0, 8)}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'manager_name',
      label: 'Manager',
      sortable: true,
      render: (item) => (
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {item.manager_name}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (item) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
          style={{
            borderColor: item.is_active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
            background: item.is_active ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            color: item.is_active ? 'var(--color-accent-emerald)' : 'var(--color-accent-rose)',
          }}
        >
          {item.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (item) => (
        <button
          onClick={(event) => { event.stopPropagation(); openEdit(item); }}
          className="rounded-lg border p-2 transition-colors hover:border-[rgba(74,124,255,0.2)] hover:bg-[rgba(74,124,255,0.06)]"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}
          title="Edit assignment"
        >
          <Pencil size={14} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manager Assignments"
        subtitle="Map employees to managers so approval routing and reporting hierarchy stay deterministic."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Admin' }, { label: 'Manager assignments' }]}
        actions={
          <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus size={16} />
            New assignment
          </button>
        }
      />

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard label="Assignments" value={totals.total} icon={<GitBranch size={18} />} accent="blue" />
        <StatCard label="Active" value={totals.active} icon={<Users size={18} />} accent="emerald" />
        <StatCard label="Employees" value={employees.length} icon={<Users size={18} />} accent="amber" />
        <StatCard label="Managers" value={managers.length} icon={<Users size={18} />} accent="purple" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_.78fr] gap-6">
        <div className="space-y-4">
          {!loading && items.length === 0 ? (
            <EmptyState
              icon={<GitBranch size={32} className="text-[var(--text-tertiary)]" />}
              title="No assignments configured"
              description="Create the first relationship to make the reporting hierarchy explicit."
              action={<button onClick={openCreate} className="btn-primary text-sm inline-flex items-center gap-2"><Plus size={14} /> Create assignment</button>}
            />
          ) : (
            <DataTable
              columns={columns}
              data={items}
              pagination={pagination}
              loading={loading}
              onPageChange={(page) => setParams(prev => ({ ...prev, page }))}
              onSort={(key, order) => setParams(prev => ({ ...prev, sort_by: key, sort_order: order }))}
              currentSort={params.sort_by ? { key: params.sort_by, order: (params.sort_order || 'asc') as SortOrder } : undefined}
            />
          )}
        </div>

        <aside className="glass-card p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Hierarchy posture
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              The relationship graph should make approval ownership obvious for every employee.
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.78)' }}>
            <div className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Operational notes
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              <li>Prefer active assignment updates over delete and recreate.</li>
              <li>Managers should be visible in the hierarchy before policy setup.</li>
              <li>Inactive relationships should still preserve the audit trail.</li>
            </ul>
          </div>
        </aside>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
          <div className="relative glass-card w-full max-w-2xl p-6 animate-fade-in-scale">
            <div className="mb-5">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                {editItem ? 'Edit assignment' : 'New assignment'}
              </h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Keep the mapping precise so approvals flow through the expected manager path.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              {!editItem && (
                <label className="space-y-1.5 md:col-span-2">
                  <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                    Employee
                  </span>
                  <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="input-field" required>
                    <option value="">Select employee...</option>
                    {employees.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="space-y-1.5 md:col-span-2">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Manager
                </span>
                <select value={managerId} onChange={e => setManagerId(e.target.value)} className="input-field" required>
                  <option value="">Select manager...</option>
                  {managers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </label>

              {editItem && (
                <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.7)' }}>
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Active relationship</span>
                </label>
              )}

              <div className="md:col-span-2 flex gap-3 pt-2">
                <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading} className="btn-primary flex-1">
                  {formLoading ? 'Saving...' : editItem ? 'Update assignment' : 'Create assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
