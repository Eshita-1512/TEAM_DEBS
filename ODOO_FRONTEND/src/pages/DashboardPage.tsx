import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Layers3,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { analytics, approvals, expenses } from '@/api/client';
import { EmptyState, StatusBadge } from '@/components/shared';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/formatters';
import type { AnalyticsOverview, ApprovalQueueItem, Expense, ListResponse } from '@/types/api';

const DASHBOARD_PAGE_SIZE = 12;

type DashboardRole = 'admin' | 'manager' | 'employee';

const roleCopy: Record<
  DashboardRole,
  {
    title: string;
    subtitle: string;
    primary: { label: string; to: string };
    secondary: { label: string; to: string };
  }
> = {
  admin: {
    title: 'Company operations command center',
    subtitle: 'Monitor spend, queue pressure, and payout readiness from one authored control surface instead of scattered admin widgets.',
    primary: { label: 'Review policies', to: '/app/admin/policies' },
    secondary: { label: 'Open analytics', to: '/app/admin/analytics' },
  },
  manager: {
    title: 'Approval queue command center',
    subtitle: 'See what is waiting, what is stalled, and what needs a decision now without hunting across multiple panels.',
    primary: { label: 'Open approval queue', to: '/app/approvals' },
    secondary: { label: 'View team expenses', to: '/app/expenses' },
  },
  employee: {
    title: 'Expense tracking workspace',
    subtitle: 'Follow submissions, watch status movement, and keep receipts moving through the workflow with confidence.',
    primary: { label: 'Create an expense', to: '/app/expenses/new' },
    secondary: { label: 'View history', to: '/app/expenses' },
  },
};

function countStatuses(items: Expense[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
}

function SummaryStrip({
  items,
}: {
  items: Array<{ label: string; value: string | number; detail: string; icon: ReactNode }>;
}) {
  return (
    <section className="summary-strip overflow-hidden">
      <div className="summary-strip-grid summary-strip-grid--four">
        {items.map((item) => (
          <div key={item.label} className="summary-strip-item">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="section-kicker">{item.label}</div>
                <div className="mt-3 font-display text-[2rem] font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)]">
                  {item.value}
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.detail}</p>
              </div>
              <div className="mt-1 text-[var(--text-muted)]">{item.icon}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SurfaceList({
  title,
  description,
  items,
  empty,
}: {
  title: string;
  description: string;
  items: ReactNode[];
  empty: ReactNode;
}) {
  return (
    <section className="narrative-panel overflow-hidden">
      <div className="px-7 py-6">
        <div className="section-kicker">{title}</div>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">{description}</p>
      </div>
      <div className="border-t border-[var(--border)] px-5 py-5">
        {items.length === 0 ? <>{empty}</> : <div className="space-y-3">{items}</div>}
      </div>
    </section>
  );
}

function ContextSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="section-divider px-6 py-5 first:border-t-0 first:pt-6">
      <div className="section-kicker">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function DashboardPage() {
  const { user, isAdmin, isManager } = useAuth();
  const role = (isAdmin ? 'admin' : isManager ? 'manager' : 'employee') as DashboardRole;
  const copy = roleCopy[role];

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [expensesData, setExpensesData] = useState<ListResponse<Expense> | null>(null);
  const [queueData, setQueueData] = useState<ListResponse<ApprovalQueueItem> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const requests: Promise<unknown>[] = [
          expenses.list({ page: 1, page_size: DASHBOARD_PAGE_SIZE, sort_by: 'expense_date', sort_order: 'desc' }),
        ];

        if (isAdmin || isManager) {
          requests.push(
            approvals.getQueue({ page: 1, page_size: DASHBOARD_PAGE_SIZE, sort_by: 'submitted_at', sort_order: 'desc' }),
          );
        }

        if (isAdmin) {
          requests.push(analytics.overview());
        }

        const [expenseResult, queueResult, analyticsResult] = await Promise.allSettled(requests);
        if (!active) return;

        if (expenseResult?.status === 'fulfilled') {
          setExpensesData(expenseResult.value as ListResponse<Expense>);
        }

        if ((isAdmin || isManager) && queueResult?.status === 'fulfilled') {
          setQueueData(queueResult.value as ListResponse<ApprovalQueueItem>);
        }

        if (isAdmin && analyticsResult?.status === 'fulfilled') {
          setOverview((analyticsResult.value as { data: AnalyticsOverview }).data);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [isAdmin, isManager]);

  const recentExpenses = expensesData?.items ?? [];
  const queueItems = queueData?.items ?? [];
  const totalExpenses = expensesData?.pagination?.total_items ?? 0;
  const totalPending = queueData?.pagination?.total_items ?? 0;
  const statusCounts = countStatuses(recentExpenses);

  const summaryItems = isAdmin
    ? [
        {
          label: 'Total spend',
          value: overview ? formatMoney(overview.total_amount, overview.currency) : '—',
          detail: 'Normalized company-currency spend across the current reporting window.',
          icon: <Wallet size={18} />,
        },
        {
          label: 'Pending reviews',
          value: totalPending,
          detail: 'Claims still waiting on an approval decision in the active queue.',
          icon: <ClipboardCheck size={18} />,
        },
        {
          label: 'Approved claims',
          value: overview?.approved_count ?? '—',
          detail: 'Claims that cleared workflow and are ready to move toward reimbursement.',
          icon: <CheckCircle2 size={18} />,
        },
        {
          label: 'Avg approval time',
          value: overview?.avg_approval_time_hours ? `${overview.avg_approval_time_hours}h` : '—',
          detail: 'How long the workflow is taking to convert submission into approval.',
          icon: <Clock3 size={18} />,
        },
      ]
    : isManager
      ? [
          {
            label: 'Pending reviews',
            value: totalPending,
            detail: 'Claims that are currently waiting for a manager decision.',
            icon: <ClipboardCheck size={18} />,
          },
          {
            label: 'Visible expenses',
            value: totalExpenses,
            detail: 'Expense records currently visible inside your role boundary.',
            icon: <ReceiptText size={18} />,
          },
          {
            label: 'On hold',
            value: statusCounts.on_hold ?? '—',
            detail: 'Claims paused and waiting for further information or action.',
            icon: <Clock3 size={18} />,
          },
          {
            label: 'Approved',
            value: statusCounts.approved ?? '—',
            detail: 'Claims that have already moved cleanly through the queue.',
            icon: <CheckCircle2 size={18} />,
          },
        ]
      : [
          {
            label: 'My expenses',
            value: totalExpenses,
            detail: 'Your total visible expense records across submitted and completed states.',
            icon: <ReceiptText size={18} />,
          },
          {
            label: 'Pending',
            value: statusCounts.pending_approval ?? statusCounts.submitted ?? '—',
            detail: 'Claims still working their way through workflow review.',
            icon: <Clock3 size={18} />,
          },
          {
            label: 'Approved',
            value: statusCounts.approved ?? '—',
            detail: 'Claims cleared by approvers and moving toward payout readiness.',
            icon: <CheckCircle2 size={18} />,
          },
          {
            label: 'Reimbursed',
            value: statusCounts.reimbursed ?? '—',
            detail: 'Claims that have completed the reimbursement journey.',
            icon: <Layers3 size={18} />,
          },
        ];

  const shortcuts = [
    copy.primary,
    copy.secondary,
    { label: 'Review queue', to: '/app/approvals' },
  ].filter((item, index, all) => {
    if (role === 'employee' && item.to === '/app/approvals') return false;
    if (index === 2 && role === 'employee') return false;
    return all.findIndex((candidate) => candidate.to === item.to) === index;
  });

  const renderedQueue = queueItems.map((item) => (
    <Link key={item.id} to={`/app/approvals/${item.expense_id}`} className="ops-list-row">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.employee_name}</p>
          <StatusBadge status={item.status} size="sm" />
        </div>
        <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
          {item.category} · Step {item.current_step_sequence} · {formatDateTime(item.submitted_at)}
        </p>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          {formatMoney(item.company_currency_amount, item.company_currency)}
        </div>
        {item.original_currency !== item.company_currency && (
          <div className="text-xs text-[var(--text-muted)]">
            {item.original_currency} {item.original_amount}
          </div>
        )}
      </div>
    </Link>
  ));

  const renderedExpenses = recentExpenses.map((item) => (
    <Link key={item.id} to={`/app/expenses/${item.id}`} className="ops-list-row">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.category}</p>
          <StatusBadge status={item.status} size="sm" />
        </div>
        <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
          {item.description} · {formatDateTime(item.expense_date)}
        </p>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          {formatMoney(item.converted_amount, item.company_currency)}
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          {item.original_currency} {item.original_amount}
        </div>
      </div>
    </Link>
  ));

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="ops-hero h-[240px] shimmer" />
        <div className="summary-strip h-[190px] shimmer" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_.8fr]">
          <div className="narrative-panel h-[420px] shimmer" />
          <div className="aside-surface h-[420px] shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="ops-hero p-7 xl:p-9">
        <div className="grid gap-8 xl:grid-cols-[1.45fr_.95fr]">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="ops-pill"><ShieldCheck size={12} />{role}</span>
              <span className="ops-pill">Company {user?.company.name}</span>
              <span className="ops-pill">Currency {user?.company.default_currency}</span>
            </div>
            <h1 className="max-w-4xl font-display text-[2.2rem] font-semibold leading-[1.02] tracking-[-0.05em] text-[var(--text-primary)] md:text-[3rem]">
              {copy.title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-secondary)] md:text-base">
              {copy.subtitle}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to={copy.primary.to} className="btn-primary">{copy.primary.label}<ArrowRight size={14} /></Link>
              <Link to={copy.secondary.to} className="btn-secondary">{copy.secondary.label}<ArrowRight size={14} /></Link>
            </div>
          </div>

          <div className="aside-surface self-start">
            <ContextSection
              title="Current posture"
              description={
                role === 'admin'
                  ? 'Monitoring spend, policy pressure, and payout readiness across the company.'
                  : role === 'manager'
                    ? 'Focused on queue movement, decision quality, and approval latency.'
                    : 'Focused on clean submissions, accurate OCR review, and reimbursement progress.'
              }
            >
              <p className="text-sm font-medium leading-6 text-[var(--text-primary)]">
                {role === 'admin'
                  ? `${overview?.total_expenses ?? totalExpenses} expense records are visible in the current operating view.`
                  : role === 'manager'
                    ? `${totalPending} approval items are currently waiting for action.`
                    : `${totalExpenses} expense records are visible in your history.`}
              </p>
            </ContextSection>

            <ContextSection
              title="Shortcuts"
              description="Direct routes into the highest-value actions for this role."
            >
              <div className="grid gap-2">
                {shortcuts.map((action) => (
                  <Link key={action.to} to={action.to} className="ops-list-row">
                    <span className="text-sm text-[var(--text-primary)]">{action.label}</span>
                    <ArrowRight size={14} className="text-[var(--text-muted)]" />
                  </Link>
                ))}
              </div>
            </ContextSection>
          </div>
        </div>
      </section>

      <SummaryStrip items={summaryItems} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_.8fr]">
        <SurfaceList
          title={role === 'employee' ? 'Recent submissions' : 'Operational queue'}
          description={
            role === 'admin'
              ? 'Recent company-wide work that needs attention, ordered for operational scanability.'
              : role === 'manager'
                ? 'Expense claims waiting for review, with enough context to decide what to open next.'
                : 'Your latest submissions and the current state of each record.'
          }
          items={role === 'employee' ? renderedExpenses : renderedQueue}
          empty={
            <EmptyState
              title={role === 'employee' ? 'No expenses yet' : 'Queue clear'}
              description={
                role === 'employee'
                  ? 'Create your first expense to start the reimbursement workflow.'
                  : 'No items are waiting for action right now.'
              }
              action={
                role === 'employee'
                  ? <Link to="/app/expenses/new" className="btn-primary"><ReceiptText size={14} />Create an expense</Link>
                  : <Link to="/app/expenses" className="btn-secondary"><ArrowRight size={14} />Open expense history</Link>
              }
            />
          }
        />

        <section className="aside-surface overflow-hidden">
          {role === 'admin' && overview ? (
            <>
              <ContextSection
                title="Spend by status"
                description="The status mix shows where spend is accumulating across the workflow."
              >
                <div className="space-y-3">
                  {overview.expenses_by_status.map((item) => {
                    const total = overview.total_expenses || 1;
                    const width = Math.max(4, Math.round((item.count / total) * 100));
                    return (
                      <div key={item.status} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-secondary)]">{formatStatus(item.status)}</span>
                          <span className="text-[var(--text-primary)]">{item.count}</span>
                        </div>
                        <div className="ops-track">
                          <div className="ops-fill" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ContextSection>

              <ContextSection
                title="Monthly trend"
                description="Recent spend movement, compressed into a quick-read operational pattern."
              >
                <div className="space-y-3">
                  {overview.monthly_trend.slice(-4).map((month) => {
                    const width = Math.max(8, Math.min(100, (Number(month.amount) / Number(overview.total_amount || '1')) * 100));
                    return (
                      <div key={month.month} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-secondary)]">{month.month}</span>
                          <span className="text-[var(--text-primary)]">{formatMoney(month.amount, overview.currency)}</span>
                        </div>
                        <div className="ops-track">
                          <div className="ops-fill ops-fill-success" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ContextSection>
            </>
          ) : role === 'manager' ? (
            <>
              <ContextSection
                title="Actionable state"
                description="Queue pressure should be legible before the reviewer drills into individual records."
              >
                <div className="grid gap-2">
                  <div className="flex items-center justify-between rounded-xl bg-[var(--surface-tint-info)] px-3 py-2.5">
                    <span className="text-sm text-[var(--text-secondary)]">Pending reviews</span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{totalPending}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-[var(--surface-tint-pending)] px-3 py-2.5">
                    <span className="text-sm text-[var(--text-secondary)]">Queue pressure</span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {totalPending > 8 ? 'High' : totalPending > 3 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                </div>
              </ContextSection>

              <ContextSection
                title="Review standard"
                description="Managers should move valid claims quickly and make hold or reject actions richly contextual."
              >
                <p className="text-sm leading-6 text-[var(--text-secondary)]">
                  Approvals should move the workflow cleanly. Holds and rejections should leave an audit-quality reason for the submitter and the next reviewer.
                </p>
              </ContextSection>
            </>
          ) : (
            <>
              <ContextSection
                title="Submission guidance"
                description="The employee workflow should stay careful and guided, not noisy."
              >
                <p className="text-sm leading-6 text-[var(--text-secondary)]">
                  Upload a receipt, review OCR output carefully, confirm line inclusion, and then submit. That reduces back-and-forth with approvers later.
                </p>
              </ContextSection>

              <ContextSection
                title="Status mix"
                description="A compact view of where your claims currently sit in the process."
              >
                <div className="flex flex-wrap gap-2">
                  {Object.entries(statusCounts).slice(0, 6).map(([status, count]) => (
                    <span key={status} className="ops-pill">
                      <StatusBadge status={status} size="sm" />
                      {count}
                    </span>
                  ))}
                </div>
              </ContextSection>
            </>
          )}
        </section>
      </section>
    </div>
  );
}
