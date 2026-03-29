import { useMemo, useState, useCallback } from 'react';
import { Download, FileDown, Plus } from 'lucide-react';
import { audit } from '@/api/client';
import { DataTable, EmptyState, PageHeader, StatCard, type Column } from '@/components/shared';
import { usePolling } from '@/hooks/usePolling';
import type { ComplianceExport, ListParams, SortOrder } from '@/types/api';

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ComplianceExportPage() {
  const [params, setParams] = useState<ListParams>({ page: 1, page_size: 20, sort_by: 'created_at', sort_order: 'desc' });
  const [modalOpen, setModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetcher = useCallback(() => audit.getExports(params), [params]);
  const { data, loading, refresh } = usePolling({ fetcher, enabled: true });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const pagination = data?.pagination;

  const summary = useMemo(() => {
    const completed = items.filter(item => item.status === 'completed').length;
    const pending = items.filter(item => item.status === 'pending').length;
    const failed = items.filter(item => item.status === 'failed').length;
    return { completed, pending, failed };
  }, [items]);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      await audit.createExport({ date_from: dateFrom, date_to: dateTo });
      setModalOpen(false);
      await refresh();
    } finally {
      setExportLoading(false);
    }
  };

  const columns: Column<ComplianceExport>[] = [
    {
      key: 'created_at',
      label: 'Generated',
      sortable: true,
      render: (item) => <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{formatTimestamp(item.created_at)}</span>,
    },
    {
      key: 'requested_by_name',
      label: 'Requested by',
      className: 'font-medium',
      render: (item) => <span style={{ color: 'var(--text-primary)' }}>{item.requested_by_name}</span>,
    },
    {
      key: 'period',
      label: 'Period',
      render: (item) => (
        <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.72)', color: 'var(--text-secondary)' }}>
          {item.date_from} - {item.date_to}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (item) => (
        <ExportStatus status={item.status} />
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (item) => (
        <a
          href={item.file_url || '#'}
          download
          className={`btn-secondary inline-flex items-center gap-2 text-xs ${!item.file_url ? 'pointer-events-none opacity-50' : ''}`}
        >
          <FileDown size={14} />
          Download
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance Exports"
        subtitle="Generate downloadable audit history slices for internal or external review."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Admin' }, { label: 'Compliance exports' }]}
        actions={
          <button onClick={() => setModalOpen(true)} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus size={16} />
            New export
          </button>
        }
      />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Completed" value={summary.completed} icon={<Download size={18} />} accent="emerald" />
        <StatCard label="Pending" value={summary.pending} icon={<Download size={18} />} accent="amber" />
        <StatCard label="Failed" value={summary.failed} icon={<Download size={18} />} accent="rose" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_.72fr] gap-6">
        <div className="space-y-4">
          {!loading && items.length === 0 ? (
            <EmptyState
              icon={<Download size={32} className="text-[var(--text-tertiary)]" />}
              title="No exports generated"
              description="Create an export to capture a compliance slice for review."
              action={<button onClick={() => setModalOpen(true)} className="btn-primary text-sm inline-flex items-center gap-2"><Plus size={14} /> Create export</button>}
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
            />
          )}
        </div>

        <aside className="glass-card p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Export posture
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Exports should feel procedural and time-bounded, not like a random file dump.
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.78)' }}>
            <div className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Notes
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              <li>Keep the date range explicit.</li>
              <li>Use exports to preserve audit evidence externally.</li>
              <li>Check completion before linking files out to others.</li>
            </ul>
          </div>
        </aside>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative glass-card w-full max-w-md p-6 animate-fade-in-scale">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Generate compliance export
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Choose a date range and create an export record for auditing.
            </p>

            <div className="mt-5 space-y-4">
              <label className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Start date
                </span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  End date
                </span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field" />
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleExport} disabled={exportLoading || !dateFrom || !dateTo} className="btn-primary flex-1 disabled:opacity-50">
                {exportLoading ? 'Initiating...' : 'Generate export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportStatus({ status }: { status: ComplianceExport['status'] }) {
  const palette = {
    completed: { bg: 'rgba(16,185,129,0.08)', color: 'var(--color-accent-emerald)' },
    pending: { bg: 'rgba(245,158,11,0.08)', color: 'var(--color-status-pending)' },
    failed: { bg: 'rgba(239,68,68,0.08)', color: 'var(--color-accent-rose)' },
  }[status];

  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium" style={{ borderColor: 'var(--border-default)', background: palette.bg, color: palette.color }}>
      {status === 'pending' ? 'Generating' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
