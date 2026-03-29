import { useEffect, useMemo, useState, useCallback } from 'react';
import { FileText, Layers } from 'lucide-react';
import { reimbursements } from '@/api/client';
import { ActionConfirmModal, DataTable, EmptyState, FilterBar, PageHeader, StatCard, StatusBadge, REIMBURSEMENT_STATUS_OPTIONS, type Column } from '@/components/shared';
import { usePolling } from '@/hooks/usePolling';
import type { ListParams, ReimbursementItem, SortOrder } from '@/types/api';

function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  if (Number.isNaN(value)) return `${currency} ${amount}`;

  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function ReimbursementsPage() {
  const [params, setParams] = useState<ListParams>({
    page: 1,
    page_size: 20,
    sort_by: 'created_at',
    sort_order: 'desc',
    status: '',
    q: '',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const fetcher = useCallback(() => reimbursements.list(params), [params]);
  const { data, loading, refresh } = usePolling({ fetcher, enabled: true });

  useEffect(() => {
    setSelectedIds(new Set());
  }, [params.page, params.status, params.q]);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const pagination = data?.pagination;

  const selectedReadyItems = useMemo(
    () => Array.from(selectedIds).filter(id => items.find(item => item.id === id)?.status === 'ready'),
    [items, selectedIds],
  );

  const totals = useMemo(() => {
    const ready = items.filter(item => item.status === 'ready').length;
    const batched = items.filter(item => item.status === 'batched').length;
    const paid = items.filter(item => item.status === 'paid').length;
    return { ready, batched, paid };
  }, [items]);

  const handleCreateBatch = async () => {
    setBatchLoading(true);
    try {
      await reimbursements.createBatch({ expense_ids: selectedReadyItems });
      setSelectedIds(new Set());
      setModalOpen(false);
      await refresh();
    } finally {
      setBatchLoading(false);
    }
  };

  const columns: Column<ReimbursementItem>[] = [
    {
      key: 'employee_name',
      label: 'Employee',
      sortable: true,
      className: 'font-medium',
      render: (item) => <span style={{ color: 'var(--text-primary)' }}>{item.employee_name}</span>,
    },
    {
      key: 'expense_id',
      label: 'Expense',
      render: (item) => <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.expense_id.slice(0, 8)}...</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      className: 'font-semibold',
      render: (item) => <span style={{ color: 'var(--text-primary)' }}>{formatMoney(item.amount, item.currency || 'USD')}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (item) => <StatusBadge status={item.status} size="sm" />,
    },
    {
      key: 'batch_id',
      label: 'Batch',
      render: (item) => item.batch_id ? (
        <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium font-mono" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.72)', color: 'var(--text-secondary)' }}>
          {item.batch_id.slice(0, 8)}
        </span>
      ) : (
        <span style={{ color: 'var(--text-tertiary)' }}>Unbatched</span>
      ),
    },
    {
      key: 'paid_at',
      label: 'Paid',
      sortable: true,
      render: (item) => item.paid_at ? <span style={{ color: 'var(--text-secondary)' }}>{item.paid_at.slice(0, 10)}</span> : <span style={{ color: 'var(--text-tertiary)' }}>Not paid</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reimbursements"
        subtitle="Batch ready items, watch payment states, and keep payout operations controlled."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Admin' }, { label: 'Reimbursements' }]}
        actions={
          selectedReadyItems.length > 0 && (
            <button onClick={() => setModalOpen(true)} className="btn-primary inline-flex items-center gap-2 text-sm">
              <Layers size={16} />
              Create batch ({selectedReadyItems.length})
            </button>
          )
        }
      />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Ready" value={totals.ready} icon={<FileText size={18} />} accent="emerald" />
        <StatCard label="Batched" value={totals.batched} icon={<FileText size={18} />} accent="blue" />
        <StatCard label="Paid" value={totals.paid} icon={<FileText size={18} />} accent="cyan" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_.72fr] gap-6">
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Search by employee..."
            currentSearch={params.q}
            currentStatus={params.status}
            statusOptions={REIMBURSEMENT_STATUS_OPTIONS}
            onSearch={(q) => setParams(prev => ({ ...prev, q, page: 1 }))}
            onStatusChange={(status) => setParams(prev => ({ ...prev, status, page: 1 }))}
            showDates={false}
          />

          {!loading && items.length === 0 ? (
            <EmptyState
              icon={<FileText size={32} className="text-[var(--text-tertiary)]" />}
              title="No reimbursements found"
              description="There are no items matching the current filters."
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
            />
          )}
        </div>

        <aside className="glass-card p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Payment posture
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Batch creation should feel deliberate because it changes payout state for multiple employees at once.
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.78)' }}>
            <div className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Operating notes
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              <li>Only batch items that are ready.</li>
              <li>Review currency and amount before payout.</li>
              <li>Use the payment state as the source of truth for finance ops.</li>
            </ul>
          </div>
        </aside>
      </section>

      <ActionConfirmModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleCreateBatch}
        title="Create payment batch"
        description={`This will group ${selectedReadyItems.length} reimbursement-ready items into one batch.`}
        actionLabel="Create batch"
        actionVariant="primary"
        loading={batchLoading}
      />
    </div>
  );
}
