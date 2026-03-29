import { useCallback, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileImage, RefreshCw, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';
import { expenses } from '@/api/client';
import { EmptyState, PageHeader, StatusBadge, Timeline } from '@/components/shared';
import { usePolling } from '@/hooks/usePolling';
import { formatDate, formatDateTime, formatMoney, formatStatus } from '@/lib/formatters';
import type { Expense, TimelineEvent } from '@/types/api';

const POLL_INTERVAL = 10000;

function InfoRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className={`text-right text-sm ${emphasize ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
        {value}
      </span>
    </div>
  );
}

function SectionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="narrative-block px-7 py-6">
      <div className="mb-5">
        <div className="section-kicker">{title}</div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function workflowMessage(expense: Expense) {
  switch (expense.status) {
    case 'approved':
      return 'Approved and waiting to be turned into a reimbursement action.';
    case 'pending_approval':
      return 'Active in the approval chain and still waiting on the current reviewer.';
    case 'on_hold':
      return 'Paused in workflow until a reviewer resumes it.';
    case 'rejected':
      return 'Closed with a rejection and retained as historical context.';
    case 'reimbursed':
      return 'Fully reimbursed and now serving as the final audit record.';
    case 'submitted':
      return 'Submitted and waiting to fully enter the approval queue.';
    default:
      return 'Still being assembled and not yet in the formal workflow.';
  }
}

export function ExpenseDetailPage() {
  const { expenseId } = useParams<{ expenseId: string }>();
  const navigate = useNavigate();

  const expenseFetcher = useCallback(
    () => expenses.get(expenseId!).then((response) => response.data),
    [expenseId],
  );

  const timelineFetcher = useCallback(
    () => expenses.getTimeline(expenseId!).then((response) => response.data),
    [expenseId],
  );

  const {
    data: expense,
    loading: expenseLoading,
    error: expenseError,
    refresh: refreshExpense,
  } = usePolling<Expense>({
    fetcher: expenseFetcher,
    interval: POLL_INTERVAL,
    enabled: !!expenseId,
  });

  const {
    data: timeline,
    loading: timelineLoading,
    refresh: refreshTimeline,
  } = usePolling<TimelineEvent[]>({
    fetcher: timelineFetcher,
    interval: POLL_INTERVAL,
    enabled: !!expenseId,
  });

  const handleRefresh = () => {
    refreshExpense();
    refreshTimeline();
  };

  if (expenseLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="ops-hero h-[240px] shimmer" />
        <div className="summary-strip h-[180px] shimmer" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_.78fr]">
          <div className="narrative-panel h-[760px] shimmer" />
          <div className="space-y-6">
            <div className="aside-surface h-[240px] shimmer" />
            <div className="aside-surface h-[420px] shimmer" />
          </div>
        </div>
      </div>
    );
  }

  if (expenseError || !expense) {
    return (
      <EmptyState
        title="Expense not found"
        description="This record may not exist anymore or your account may not have permission to view it."
        action={
          <button onClick={() => navigate('/app/expenses')} className="btn-secondary text-sm">
            Back to expenses
          </button>
        }
      />
    );
  }

  const isForeignCurrency = expense.original_currency !== expense.company_currency;
  const reimbursement = expense.reimbursement;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={expense.description}
        subtitle={`${expense.category} · ${formatDate(expense.expense_date, { day: 'numeric', month: 'long', year: 'numeric' })}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/app' },
          { label: 'Expenses', href: '/app/expenses' },
          { label: 'Detail' },
        ]}
        actions={
          <>
            <button onClick={() => navigate('/app/expenses')} className="btn-secondary inline-flex items-center gap-2">
              <ArrowLeft size={15} />
              Back
            </button>
            <button onClick={handleRefresh} className="btn-primary inline-flex items-center gap-2">
              <RefreshCw size={15} />
              Refresh
            </button>
          </>
        }
      />

      <section className="ops-hero p-7 xl:p-9">
        <div className="grid gap-8 xl:grid-cols-[1.4fr_.95fr]">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <StatusBadge status={expense.status} pulse={expense.status === 'pending_approval'} />
              <span className="ops-pill">
                <ShieldCheck size={12} />
                {workflowMessage(expense)}
              </span>
              {reimbursement && <StatusBadge status={reimbursement.status} size="sm" />}
            </div>
            <h1 className="max-w-4xl font-display text-[2.2rem] font-semibold leading-[1.02] tracking-[-0.05em] text-[var(--text-primary)] md:text-[3rem]">
              {expense.description}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-secondary)] md:text-base">
              This screen is the complete narrative of the claim: what was submitted, how the money changed, where the evidence came from, and what the workflow is doing now.
            </p>
          </div>

          <div className="summary-strip overflow-hidden self-start">
            <div className="summary-strip-grid">
              <div className="summary-strip-item">
                <div className="section-kicker">Employee</div>
                <div className="mt-3 text-base font-semibold text-[var(--text-primary)]">{expense.employee_name}</div>
              </div>
              <div className="summary-strip-item">
                <div className="section-kicker">Submitted amount</div>
                <div className="mt-3 font-display text-[1.9rem] font-semibold leading-none tracking-[-0.03em] text-[var(--text-primary)]">
                  {formatMoney(expense.original_amount, expense.original_currency)}
                </div>
              </div>
              <div className="summary-strip-item">
                <div className="section-kicker">Company amount</div>
                <div className="mt-3 font-display text-[1.9rem] font-semibold leading-none tracking-[-0.03em] text-[var(--text-primary)]">
                  {formatMoney(expense.converted_amount, expense.company_currency)}
                </div>
              </div>
              <div className="summary-strip-item">
                <div className="section-kicker">Workflow step</div>
                <div className="mt-3 text-base font-semibold text-[var(--text-primary)]">
                  {expense.approval_summary ? `Step ${expense.approval_summary.current_step_sequence}` : 'No policy linked'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_.78fr]">
        <section className="narrative-panel overflow-hidden">
          <SectionBlock
            title="Financial Story"
            description="The monetary path from receipt to reimbursable total should be obvious without forcing the user to compare multiple little cards."
          >
            <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
              <div className="space-y-1">
                <InfoRow
                  label="Original amount"
                  value={formatMoney(expense.original_amount, expense.original_currency)}
                  emphasize
                />
                <InfoRow
                  label="Final included total"
                  value={formatMoney(expense.final_included_total, expense.original_currency)}
                  emphasize
                />
                {isForeignCurrency && (
                  <>
                    <InfoRow
                      label={`Converted (${expense.company_currency})`}
                      value={formatMoney(expense.converted_amount, expense.company_currency)}
                      emphasize
                    />
                    <InfoRow
                      label="Conversion rate"
                      value={`1 ${expense.original_currency} = ${expense.conversion_rate} ${expense.company_currency}`}
                    />
                    <InfoRow label="Rate source" value={expense.conversion_rate_source} />
                    <InfoRow label="Rate locked" value={formatDateTime(expense.conversion_rate_timestamp)} />
                  </>
                )}
                {expense.submitted_total_before_exclusions !== expense.final_included_total && (
                  <InfoRow
                    label="Pre-exclusion total"
                    value={formatMoney(expense.submitted_total_before_exclusions, expense.original_currency)}
                  />
                )}
              </div>

              <div className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-sunken)] px-5 py-4">
                <div className="section-kicker">What changed</div>
                <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                  {expense.submitted_total_before_exclusions !== expense.final_included_total
                    ? 'Some extracted lines were excluded before submission, so the final included total differs from the initial OCR or receipt-derived total.'
                    : 'The submitted and included totals match, which means the full claim moved forward without line-level exclusions.'}
                </p>
              </div>
            </div>
          </SectionBlock>

          <SectionBlock
            title="Receipt And Evidence"
            description="Receipt evidence should stay attached to the record instead of being reduced to a tiny supporting widget."
          >
            {expense.receipt ? (
              <div className="ops-list-row">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-sunken)] text-[var(--accent)]">
                    <FileImage size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{expense.receipt.file_name}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      OCR status: {formatStatus(expense.receipt.ocr_status)}
                    </div>
                  </div>
                </div>
                <StatusBadge status={expense.receipt.ocr_status} size="sm" />
              </div>
            ) : (
              <EmptyState title="No receipt attached" description="This expense record does not include receipt evidence." />
            )}
          </SectionBlock>

          <SectionBlock
            title="Included And Excluded Lines"
            description="Line selection should be readable as one ledger-like list so the user can explain how the final total was assembled."
          >
            {expense.line_items.length > 0 ? (
              <div className="space-y-3">
                {expense.line_items.map((line, index) => (
                  <div
                    key={`${line.source_line_id}-${index}`}
                    className={`ops-list-row ${line.included ? '' : 'opacity-65'}`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`mt-0.5 ${line.included ? 'text-[var(--accent-emerald)]' : 'text-[var(--text-muted)]'}`}>
                        {line.included ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{line.name}</div>
                        <div className="mt-1 text-xs text-[var(--text-secondary)]">
                          {line.category || expense.category}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                        {formatMoney(line.amount, expense.original_currency)}
                      </div>
                      <StatusBadge status={line.included ? 'approved' : 'rejected'} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No extracted lines" description="This record does not contain line-level extracted detail." />
            )}
          </SectionBlock>
        </section>

        <aside className="space-y-6">
          <section className="aside-surface overflow-hidden">
            <div className="section-divider px-6 py-6">
              <div className="section-kicker">Workflow context</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                The current state, next responsibility, and reimbursement context should stay visible without fragmenting into many cards.
              </p>
            </div>

            <div className="section-divider px-6 py-5">
              {expense.approval_summary && (
                <>
                  <InfoRow
                    label="Current step"
                    value={`Step ${expense.approval_summary.current_step_sequence}`}
                    emphasize
                  />
                  <InfoRow
                    label="Pending approvers"
                    value={
                      expense.approval_summary.current_pending_approver_ids.length > 0
                        ? `${expense.approval_summary.current_pending_approver_ids.length} approver(s)`
                        : 'None pending'
                    }
                  />
                  <InfoRow label="Policy reference" value={expense.approval_summary.policy_id} />
                </>
              )}
              <InfoRow label="Workflow state" value={workflowMessage(expense)} emphasize />
              <InfoRow label="Receipt state" value={expense.receipt ? formatStatus(expense.receipt.ocr_status) : 'No receipt'} />
              <InfoRow label="Reimbursement" value={reimbursement ? formatStatus(reimbursement.status) : 'Not started'} />
              {reimbursement?.amount && (
                <InfoRow
                  label="Reimbursement amount"
                  value={formatMoney(reimbursement.amount, reimbursement.currency || expense.company_currency)}
                />
              )}
              {reimbursement?.paid_at && <InfoRow label="Paid at" value={formatDate(reimbursement.paid_at)} />}
            </div>
          </section>

          <section className="aside-surface overflow-hidden">
            <div className="section-divider px-6 py-6">
              <div className="section-kicker">Timeline</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Each system and human action should appear in order so the record can be audited without guesswork.
              </p>
            </div>
            <div className="section-divider px-4 py-4">
              <Timeline events={timeline ?? []} loading={timelineLoading} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
