import { useState, useCallback, type FormEvent } from 'react';
import { Plus, Pencil, Shield, Trash2, Users as UsersIcon } from 'lucide-react';
import { users } from '@/api/client';
import { ActionConfirmModal, DataTable, EmptyState, FilterBar, PageHeader, StatCard, type Column } from '@/components/shared';
import { usePolling } from '@/hooks/usePolling';
import type { ListParams, Role, SortOrder, UserDetail } from '@/types/api';

const ROLES: Role[] = ['admin', 'manager', 'employee'];

interface UserFormData {
  name: string;
  email: string;
  role: Role;
  password: string;
  is_active: boolean;
}

const emptyForm: UserFormData = {
  name: '',
  email: '',
  role: 'employee',
  password: '',
  is_active: true,
};

export function UserManagementPage() {
  const [params, setParams] = useState<ListParams>({ page: 1, page_size: 20, sort_by: 'name', sort_order: 'asc' });
  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserDetail | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteUser, setDeleteUser] = useState<UserDetail | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetcher = useCallback(() => users.list(params), [params]);
  const { data, loading, refresh } = usePolling({ fetcher, enabled: true });

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  const totals = items.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.is_active) acc.active += 1;
      if (item.role === 'admin') acc.admins += 1;
      if (item.role === 'manager') acc.managers += 1;
      if (item.role === 'employee') acc.employees += 1;
      return acc;
    },
    { total: 0, active: 0, admins: 0, managers: 0, employees: 0 },
  );

  const openCreate = () => {
    setEditUser(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (user: UserDetail) => {
    setEditUser(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      password: '',
      is_active: user.is_active,
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      if (editUser) {
        const payload: { name?: string; role?: Role; password?: string; is_active?: boolean } = {
          name: form.name,
          role: form.role,
          is_active: form.is_active,
        };
        if (form.password) payload.password = form.password;
        await users.update(editUser.id, payload);
      } else {
        await users.create({
          name: form.name,
          email: form.email,
          role: form.role,
          password: form.password,
        });
      }

      setFormOpen(false);
      await refresh();
    } catch (error: unknown) {
      const err = error as { error?: { message?: string } };
      setFormError(err?.error?.message || 'Unable to save the user.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;

    setDeleteLoading(true);
    try {
      await users.delete(deleteUser.id);
      setDeleteUser(null);
      await refresh();
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: Column<UserDetail>[] = [
    {
      key: 'name',
      label: 'Person',
      sortable: true,
      render: (user) => (
        <div>
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {user.name}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {user.email}
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (user) => <RoleBadge role={user.role} />,
    },
    {
      key: 'manager_name',
      label: 'Manager',
      render: (user) => user.manager_name ? (
        <span style={{ color: 'var(--text-secondary)' }}>{user.manager_name}</span>
      ) : (
        <span style={{ color: 'var(--text-tertiary)' }}>Unassigned</span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (user) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
          style={{
            borderColor: user.is_active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
            background: user.is_active ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            color: user.is_active ? 'var(--color-accent-emerald)' : 'var(--color-accent-rose)',
          }}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${user.is_active ? 'bg-[var(--color-accent-emerald)]' : 'bg-[var(--color-accent-rose)]'}`} />
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (user) => (
        <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
          <button
            onClick={() => openEdit(user)}
            className="rounded-lg border p-2 transition-colors hover:border-[rgba(74,124,255,0.2)] hover:bg-[rgba(74,124,255,0.06)]"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}
            title="Edit user"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteUser(user)}
            className="rounded-lg border p-2 transition-colors hover:border-[rgba(239,68,68,0.2)] hover:bg-[rgba(239,68,68,0.06)]"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}
            title="Delete user"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Create users, assign roles, and keep the company roster aligned with the workflow model."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Admin' }, { label: 'Users' }]}
        actions={
          <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus size={16} />
            New User
          </button>
        }
      />

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard label="Active users" value={totals.active} icon={<UsersIcon size={18} />} accent="blue" />
        <StatCard label="Admins" value={totals.admins} icon={<Shield size={18} />} accent="purple" />
        <StatCard label="Managers" value={totals.managers} icon={<UsersIcon size={18} />} accent="emerald" />
        <StatCard label="Employees" value={totals.employees} icon={<UsersIcon size={18} />} accent="amber" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_.78fr] gap-6">
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Search by name or email..."
            currentSearch={params.q}
            onSearch={(q) => setParams(prev => ({ ...prev, q, page: 1 }))}
            showStatus={false}
            showDates={false}
          />

          {!loading && items.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={32} className="text-[var(--text-tertiary)]" />}
              title="No users yet"
              description="Create the first account to establish the company roster."
              action={<button onClick={openCreate} className="btn-primary text-sm inline-flex items-center gap-2"><Plus size={14} /> Add user</button>}
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
              Roster posture
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Users should be easy to scan, easy to reassign, and easy to disable without losing the audit trail.
            </p>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.78)' }}>
            <div className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Account guidance
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              <li>Assign managers before moving employees into active use.</li>
              <li>Deactivate users instead of deleting where audit history matters.</li>
              <li>Keep admin accounts small and intentional.</li>
            </ul>
          </div>
        </aside>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
          <div className="relative glass-card w-full max-w-2xl p-6 animate-fade-in-scale">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {editUser ? 'Edit user' : 'Create user'}
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Keep the form precise. Users and roles are the entry point to the rest of the workflow.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Full name
                </span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm(prev => ({ ...prev, name: event.target.value }))}
                  className="input-field"
                  placeholder="Jane Doe"
                  required
                />
              </label>

              {!editUser && (
                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                    Email
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm(prev => ({ ...prev, email: event.target.value }))}
                    className="input-field"
                    placeholder="jane@company.com"
                    required
                  />
                </label>
              )}

              <label className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Role
                </span>
                <select
                  value={form.role}
                  onChange={(event) => setForm(prev => ({ ...prev, role: event.target.value as Role }))}
                  className="input-field"
                >
                  {ROLES.map(role => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Password {editUser && <span style={{ color: 'var(--text-tertiary)', textTransform: 'none' }}>(leave blank to keep current)</span>}
                </span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm(prev => ({ ...prev, password: event.target.value }))}
                  className="input-field"
                  placeholder="••••••••"
                  required={!editUser}
                />
              </label>

              <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.7)' }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm(prev => ({ ...prev, is_active: event.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  Active account
                </span>
              </label>

              {formError && (
                <p className="md:col-span-2 text-sm" style={{ color: 'var(--color-accent-rose)' }}>
                  {formError}
                </p>
              )}

              <div className="md:col-span-2 flex gap-3 pt-2">
                <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading} className="btn-primary flex-1">
                  {formLoading ? 'Saving...' : editUser ? 'Save changes' : 'Create user'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ActionConfirmModal
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleteUser?.name || 'user'}?`}
        description="This permanently removes the user from the roster. Use deactivate if the record should stay in the audit trail."
        actionLabel="Delete user"
        actionVariant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const styles = {
    admin: { label: 'Admin', color: 'rgba(139,92,246,0.14)', text: 'var(--color-accent-purple)' },
    manager: { label: 'Manager', color: 'rgba(16,185,129,0.14)', text: 'var(--color-accent-emerald)' },
    employee: { label: 'Employee', color: 'rgba(74,124,255,0.12)', text: 'var(--primary)' },
  }[role];

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium"
      style={{
        borderColor: 'var(--border-default)',
        background: styles.color,
        color: styles.text,
      }}
    >
      {styles.label}
    </span>
  );
}
