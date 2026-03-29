import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck, Clock3, RefreshCw, ShieldCheck, ShieldX } from 'lucide-react';
import { approvals } from '@/api/client';
import { DataTable, EmptyState, FilterBar, PageHeader, StatCard, StatusBadge, type Column } from '@/components/shared';
import { usePolling } from '@/hooks/usePolling';
import { formatMoney, relativeFreshness } from '@/lib/formatters';
import type { ApprovalQueueItem, ListParams, SortOrder } from '@/types/api';

function formatSubmittedAt(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function triggerTone(state: ApprovalQueueItem['trigger_evaluation']['state']) {
  if (state === 'passed') return { label: 'Passed', color: 'var(--success)' };
  if (state === 'failed') return { label: 'Failed', color: 'var(--danger)' };
  return { label: 'Pending', color: 'var(--warning)' };
}

export function ApprovalQueuePage() {
  const navigate = useNavigate();
  const [params, setParams] = useState<ListParams>({
    page: 1,
    page_size: 20,
    sort_by: 'submitted_at',
    sort_order: 'desc',
  });

  const fetcher = useMemo(() => () => approvals.getQueue(params), [params]);
  const { data, loading, refresh, lastUpdated } = usePolling({ fetcher, interval: 15000, enabled: true });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const pagination = data?.pagination;

  const summary = useMemo(() => {
    const passed = items.filter((item) => item.trigger_evaluation?.state === 'passed').length;
    const failed = items.filter((item) => item.trigger_evaluation?.state === 'failed').length;
    const pending = items.filter((item) => item.trigger_evaluation?.state === 'pending').length;
    const onHold = items.filter((item) => item.status === 'on_hold').length;
    return { passed, failed, pending, onHold };
  }, [items]);

  const columns: Column<ApprovalQueueItem>[] = [
    {
      key: 'employee_name',
      label: 'Submitter',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-medium text-[var(--text-primary)]">{item.employee_name}</div>
          <div className="text-xs text-[var(--text-muted)]">{item.category}</div>
        </div>
      ),
    },
    {
      key: 'company_currency_amount',
      label: 'Amount',
      sortable: true,
      className: 'text-right',
      render: (item) => (
        <div className="text-right">
          <div className="font-semibold tabular-nums text-[var(--text-primary)]">
            {formatMoney(item.company_currency_amount, item.company_currency)}
          </div>
          {item.original_currency !== item.company_currency && (
            <div className="text-xs text-[var(--text-muted)]">
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
      key: 'current_step_sequence',
      label: 'Step',
      sortable: true,
      render: (item) => <span className="ops-pill">Step {item.current_step_sequence}</span>,
    },
    {
      key: 'trigger_evaluation',
      label: 'Triggers',
      render: (item) => {
        const trigger = item.trigger_evaluation;
        const tone = triggerTone(trigger.state);
        return (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: tone.color }}>
              {tone.label}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              {trigger.passed_conditions.length} passed, {trigger.failed_conditions.length} failed
            </div>
          </div>
        );
      },
    },
    {
      key: 'submitted_at',
      label: 'Submitted',
      sortable: true,
      render: (item) => <span className="text-xs text-[var(--text-muted)]">{formatSubmittedAt(item.submitted_at)}</span>,
    },
  ];

  const focusCards = [
    {
      label: 'Needs decision',
      value: pagination?.total_items ?? 0,
      detail: 'Open claims ready for reviewer action.',
      tone: 'var(--surface-tint-info)',
    },
    {
      label: 'Policy failures',
      value: summary.failed,
      detail: 'Claims that need a closer review before approval.',
      tone: 'var(--surface-tint-danger)',
    },
    {
      label: 'Pending evaluation',
      value: summary.pending,
      detail: 'Records still waiting on trigger evaluation or refresh.',
      tone: 'var(--surface-tint-pending)',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Queue"
        subtitle="Review what is actionable now, what is blocked by policy, and what is waiting on a comment or resumed workflow."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Approvals' }]}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {relativeFreshness(lastUpdated)}
            </span>
            <button onClick={() => refresh()} className="btn-secondary text-sm">
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending reviews" value={pagination?.total_items ?? 0} icon={<ClipboardCheck size={18} />} accent="amber" />
        <StatCard label="Trigger passed" value={summary.passed} icon={<ShieldCheck size={18} />} accent="emerald" />
        <StatCard label="Trigger failed" value={summary.failed} icon={<ShieldX size={18} />} accent="rose" />
        <StatCard label="On hold" value={summary.onHold} icon={<AlertTriangle size={18} />} accent="purple" />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_22rem]">
        <div className="space-y-4">
          <section className="surface-panel p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="section-kicker">Queue focus</div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Treat this page as a single working surface. Triage failed or held claims first, then clear clean approvals in submission order.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[34rem] lg:flex-1">
                {focusCards.map((card) => (
                  <div key={card.label} className="rounded-[1rem] border border-[var(--border)] px-4 py-3" style={{ background: card.tone }}>
                    <div className="section-kicker">{card.label}</div>
                    <div className="mt-2 text-2xl font-display font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                      {card.value}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{card.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <FilterBar
            searchPlaceholder="Search by employee or category..."
            currentSearch={params.q}
            currentStatus={params.status}
            currentDateFrom={params.date_from}
            currentDateTo={params.date_to}
            onSearch={(q) => setParams((prev) => ({ ...prev, q, page: 1 }))}
            onStatusChange={(status) => setParams((prev) => ({ ...prev, status, page: 1 }))}
            onDateFromChange={(date_from) => setParams((prev) => ({ ...prev, date_from, page: 1 }))}
            onDateToChange={(date_to) => setParams((prev) => ({ ...prev, date_to, page: 1 }))}
            onReset={() => setParams({ page: 1, page_size: 20, sort_by: 'submitted_at', sort_order: 'desc' })}
          />

          {!loading && items.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck size={32} className="text-[var(--text-muted)]" />}
              title="Queue clear"
              description="No items are waiting for review in the current filter window."
              action={<button onClick={() => refresh()} className="btn-secondary text-sm">Refresh queue</button>}
            />
          ) : (
            <DataTable
              columns={columns}
              data={items}
              pagination={pagination}
              loading={loading}
              onPageChange={(page) => setParams((prev) => ({ ...prev, page }))}
              onSort={(key, order) => setParams((prev) => ({ ...prev, sort_by: key, sort_order: order }))}
              currentSort={params.sort_by ? { key: params.sort_by, order: (params.sort_order || 'desc') as SortOrder } : undefined}
              onRowClick={(item) => navigate(`/app/approvals/${item.expense_id}`)}
              emptyMessage="No approval items match the current filters"
            />
          )}
        </div>

        <aside className="aside-surface space-y-5 p-6">
          <div>
            <div className="section-kicker">Reviewer guide</div>
            <h2 className="mt-2 text-xl font-display font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              Work the queue in one pass
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              The table should do the heavy lifting. This side rail exists only to reinforce review priorities.
            </p>
          </div>

          <div className="ops-info-card">
            <div className="mb-3 flex items-center justify-between">
              <span className="section-kicker">Queue signals</span>
              <Clock3 size={14} className="text-[var(--text-muted)]" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-[var(--surface-tint-approved)] px-3 py-2">
                <span className="text-sm text-[var(--text-secondary)]">Passed triggers</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{summary.passed}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[var(--surface-tint-pending)] px-3 py-2">
                <span className="text-sm text-[var(--text-secondary)]">Pending evaluation</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{summary.pending}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[var(--surface-tint-danger)] px-3 py-2">
                <span className="text-sm text-[var(--text-secondary)]">Failed triggers</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{summary.failed}</span>
              </div>
            </div>
          </div>

          <div className="ops-info-card">
            <div className="section-kicker">Decision standard</div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
              <p>Approve when the amount, receipt context, and workflow step all line up.</p>
              <p>Use hold when the claim can proceed after one clear follow-up.</p>
              <p>Reject only when the record is materially invalid and should not continue.</p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
