import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Search } from 'lucide-react';
import { approvals, expenses } from '@/api/client';
import { ActionConfirmModal, DataTable, EmptyState, FilterBar, PageHeader, StatCard, StatusBadge, type Column } from '@/components/shared';
import { usePolling } from '@/hooks/usePolling';
import type { Expense, ListParams, SortOrder } from '@/types/api';

function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  if (Number.isNaN(value)) return `${currency} ${amount}`;

  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function ExpenseOversightPage() {
  const navigate = useNavigate();
  const [params, setParams] = useState<ListParams>({
    page: 1,
    page_size: 20,
    sort_by: 'submitted_at',
    sort_order: 'desc',
    status: '',
    q: '',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const fetcher = useCallback(() => expenses.list(params), [params]);
  const { data, loading, refresh } = usePolling({ fetcher, enabled: true });

  useEffect(() => {
    setSelectedIds(new Set());
  }, [params.page, params.status, params.q]);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const pagination = data?.pagination;

  const selectedPendingItems = useMemo(
    () => Array.from(selectedIds).filter(id => items.find(item => item.id === id)?.status === 'pending_approval'),
    [items, selectedIds],
  );

  const totals = useMemo(() => {
    const pending = items.filter(item => item.status === 'pending_approval').length;
    const approved = items.filter(item => item.status === 'approved').length;
    const held = items.filter(item => item.status === 'on_hold').length;
    return { pending, approved, held };
  }, [items]);

  const handleBulkApprove = async (comment: string) => {
    setBulkActionLoading(true);
    try {
      await Promise.all(selectedPendingItems.map(id => approvals.approve(id, { comment, reason_code: null })));
      setSelectedIds(new Set());
      setModalOpen(false);
      await refresh();
    } finally {
      setBulkActionLoading(false);
    }
  };

  const columns: Column<Expense>[] = [
    {
      key: 'employee_name',
      label: 'Employee',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.employee_name}</div>
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.category}</div>
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (item) => <span className="block max-w-[240px] truncate text-sm" style={{ color: 'var(--text-secondary)' }}>{item.description}</span>,
    },
    {
      key: 'converted_amount',
      label: 'Company amount',
      sortable: true,
      className: 'text-right',
      render: (item) => (
        <div className="text-right">
          <div className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {formatMoney(item.converted_amount, item.company_currency)}
          </div>
          {item.original_currency !== item.company_currency && (
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {item.original_currency} {item.original_amount}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'State',
      sortable: true,
      render: (item) => <StatusBadge status={item.status} size="sm" />,
    },
    {
      key: 'expense_date',
      label: 'Date',
      sortable: true,
      render: (item) => <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{item.expense_date}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Expense Oversight"
        subtitle="Scan company-wide expense flow, filter the current slice, and bulk approve only what is clearly ready."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Admin' }, { label: 'Expense oversight' }]}
        actions={
          selectedPendingItems.length > 0 && (
            <button onClick={() => setModalOpen(true)} className="btn-success inline-flex items-center gap-2 text-sm">
              <CheckSquare size={16} />
              Bulk approve ({selectedPendingItems.length})
            </button>
          )
        }
      />

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard label="Pending" value={totals.pending} icon={<Search size={18} />} accent="amber" />
        <StatCard label="Approved" value={totals.approved} icon={<Search size={18} />} accent="emerald" />
        <StatCard label="On hold" value={totals.held} icon={<Search size={18} />} accent="rose" />
        <StatCard label="Selected" value={selectedIds.size} icon={<Search size={18} />} accent="blue" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_.72fr] gap-6">
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Search by description or category..."
            currentSearch={params.q}
            currentStatus={params.status}
            onSearch={(q) => setParams(prev => ({ ...prev, q, page: 1 }))}
            onStatusChange={(status) => setParams(prev => ({ ...prev, status, page: 1 }))}
            onReset={() => setParams({ page: 1, page_size: 20, sort_by: 'submitted_at', sort_order: 'desc', status: '', q: '' })}
            showDates={false}
          />

          {!loading && items.length === 0 ? (
            <EmptyState
              icon={<Search size={32} className="text-[var(--text-tertiary)]" />}
              title="No expenses found"
              description="There are no expense records matching the current filters."
            />
          ) : (
            <DataTable
              columns={columns}
              data={items}
              pagination={pagination}
              loading={loading}
              onPageChange={(page) => setParams(prev => ({ ...prev, page }))}
              onSort={(key, order) => setParams(prev => ({ ...prev, sort_by: key, sort_order: order }))}
              currentSort={params.sort_by ? { key: params.sort_by, order: (params.sort_order || 'desc') as SortOrder } : undefined}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              getRowId={(item) => item.id}
              onRowClick={(item) => navigate(`/app/expenses/${item.id}`)}
            />
          )}
        </div>

        <aside className="glass-card p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Oversight posture
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Bulk approval should remain conservative. Only act when the record is complete and the status is clearly pending.
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.78)' }}>
            <div className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Actions
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              <li>Use filters before selecting many rows.</li>
              <li>Inspect the detail page when amounts look unusual.</li>
              <li>Avoid bulk approval if the workflow state is unclear.</li>
            </ul>
          </div>
        </aside>
      </section>

      <ActionConfirmModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleBulkApprove}
        title={`Bulk approve ${selectedPendingItems.length} expenses`}
        description="This action applies the same comment to each selected pending expense. Use it only when the records are straightforward."
        actionLabel="Approve expenses"
        actionVariant="success"
        requireComment={false}
        loading={bulkActionLoading}
      />
    </div>
  );
}
