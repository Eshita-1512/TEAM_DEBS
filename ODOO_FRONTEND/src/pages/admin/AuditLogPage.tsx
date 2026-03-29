import { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, ScrollText, ShieldCheck, ShieldX } from 'lucide-react';
import { audit } from '@/api/client';
import { DataTable, EmptyState, FilterBar, PageHeader, StatCard, type Column } from '@/components/shared';
import { usePolling } from '@/hooks/usePolling';
import type { AuditLogEntry, ListParams, SortOrder } from '@/types/api';

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AuditLogPage() {
  const [params, setParams] = useState<ListParams & { action_type?: string }>({
    page: 1,
    page_size: 50,
    sort_by: 'timestamp',
    sort_order: 'desc',
    q: '',
    action_type: '',
  });

  const fetcher = useCallback(() => audit.getLogs(params), [params]);
  const { data, loading } = usePolling({ fetcher, enabled: true });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const pagination = data?.pagination;

  const summary = useMemo(() => {
    const approvals = items.filter(item => item.action_type === 'approve').length;
    const rejections = items.filter(item => item.action_type === 'reject').length;
    const holds = items.filter(item => item.action_type === 'hold').length;
    const resumes = items.filter(item => item.action_type === 'resume').length;
    return { approvals, rejections, holds, resumes };
  }, [items]);

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      sortable: true,
      className: 'whitespace-nowrap',
      render: (item) => (
        <span className="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.72)' }}>
          {formatTimestamp(item.timestamp)}
        </span>
      ),
    },
    {
      key: 'actor',
      label: 'Actor',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {item.actor_name}
          </div>
          <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
            {item.actor_role}
          </div>
        </div>
      ),
    },
    {
      key: 'action_type',
      label: 'Action',
      sortable: true,
      render: (item) => <ActionBadge action={item.action_type} />,
    },
    {
      key: 'entity',
      label: 'Entity',
      render: (item) => (
        <div className="flex items-center gap-2 text-xs">
          <span className="uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
            {item.entity_type}
          </span>
          <span className="rounded-lg border px-2 py-0.5 font-mono" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.72)', color: 'var(--text-secondary)' }}>
            {item.entity_id.slice(0, 8)}
          </span>
          <Link to={`/app/${item.entity_type}s/${item.entity_id}`} title="View entity" style={{ color: 'var(--primary)' }}>
            <ExternalLink size={12} />
          </Link>
        </div>
      ),
    },
    {
      key: 'compliance_note',
      label: 'Details',
      render: (item) => (
        <div className="max-w-xl truncate text-sm" title={item.compliance_note || ''} style={{ color: 'var(--text-secondary)' }}>
          {item.compliance_note || <span style={{ color: 'var(--text-tertiary)' }}>No additional details recorded</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle="Immutable action history for workflow decisions, user management, and compliance events."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Admin' }, { label: 'Audit log' }]}
      />

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard label="Approvals" value={summary.approvals} icon={<ShieldCheck size={18} />} accent="emerald" />
        <StatCard label="Rejections" value={summary.rejections} icon={<ShieldX size={18} />} accent="rose" />
        <StatCard label="Holds" value={summary.holds} icon={<AlertTriangle size={18} />} accent="amber" />
        <StatCard label="Resumes" value={summary.resumes} icon={<ScrollText size={18} />} accent="purple" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_.76fr] gap-6">
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Search actor, notes, or entity..."
            currentSearch={params.q}
            currentDateFrom={params.date_from}
            currentDateTo={params.date_to}
            onSearch={(q) => setParams(prev => ({ ...prev, q, page: 1 }))}
            showStatus={false}
            showDates={true}
            onDateFromChange={(date_from) => setParams(prev => ({ ...prev, date_from, page: 1 }))}
            onDateToChange={(date_to) => setParams(prev => ({ ...prev, date_to, page: 1 }))}
            onReset={() => setParams({ page: 1, page_size: 50, sort_by: 'timestamp', sort_order: 'desc', q: '', action_type: '' })}
          />

          {!loading && items.length === 0 ? (
            <EmptyState
              icon={<ScrollText size={32} className="text-[var(--text-tertiary)]" />}
              title="No audit activity"
              description="The current filter window does not contain audit events."
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
              emptyMessage="No audit events match the current filters"
            />
          )}
        </div>

        <aside className="glass-card p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Audit posture
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Good audit records explain who did what, when, and against which entity.
            </p>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.78)' }}>
            <div className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Reading tips
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              <li>Use the entity link to jump back into the workflow.</li>
              <li>Keep notes readable and specific enough for compliance review.</li>
              <li>Filter by time window when you need a concise operational slice.</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const palette = {
    approve: { bg: 'rgba(16,185,129,0.1)', color: 'var(--color-accent-emerald)' },
    reject: { bg: 'rgba(239,68,68,0.1)', color: 'var(--color-accent-rose)' },
    hold: { bg: 'rgba(245,158,11,0.1)', color: 'var(--color-accent-amber)' },
    resume: { bg: 'rgba(74,124,255,0.1)', color: 'var(--primary)' },
    submit: { bg: 'rgba(74,124,255,0.1)', color: 'var(--primary)' },
    reimburse: { bg: 'rgba(6,182,212,0.1)', color: 'var(--color-status-reimbursed)' },
  }[action] || { bg: 'rgba(15,23,42,0.06)', color: 'var(--text-secondary)' };

  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium" style={{ borderColor: 'var(--border-default)', background: palette.bg, color: palette.color }}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}
