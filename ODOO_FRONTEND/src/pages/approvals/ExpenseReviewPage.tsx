import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  HandCoins,
  PauseCircle,
  PlayCircle,
  ShieldX,
  Tag,
  User,
} from 'lucide-react';
import { approvals, expenses } from '@/api/client';
import { ActionConfirmModal, EmptyState, PageHeader, StatusBadge, Timeline } from '@/components/shared';
import { useAuth } from '@/hooks/useAuth';
import { usePolling } from '@/hooks/usePolling';
import { formatDate, formatMoney, formatStatus } from '@/lib/formatters';
import type { ApprovalInstance, Expense, TimelineEvent } from '@/types/api';

type ReviewAction = 'approve' | 'reject' | 'hold' | 'resume';

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

function ReviewBlock({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="narrative-block px-7 py-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="section-kicker">{title}</div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        </div>
        {icon ? <div className="text-[var(--text-muted)]">{icon}</div> : null}
      </div>
      {children}
    </section>
  );
}

function actionReadiness(expense: Expense | null, canAct: boolean, canResume: boolean) {
  if (!expense) return 'No expense loaded.';
  if (canAct || canResume) return 'This record is actionable from the current workflow state.';
  return 'You can inspect the record, but current permissions or workflow state make this surface read-only.';
}

export function ExpenseReviewPage() {
  const { expenseId } = useParams<{ expenseId: string }>();
  const navigate = useNavigate();
  const { isAdmin, isManager } = useAuth();
  const [modal, setModal] = useState<{ open: boolean; type: ReviewAction }>({ open: false, type: 'approve' });
  const [actionLoading, setActionLoading] = useState(false);

  const fetcher = async (): Promise<{
    expense: Expense;
    timeline: TimelineEvent[];
    approvalInstance: ApprovalInstance | null;
  }> => {
    if (!expenseId) throw new Error('Missing expense id');

    const [expenseRes, timelineRes] = await Promise.all([
      expenses.get(expenseId),
      expenses.getTimeline(expenseId),
    ]);

    let approvalInstance: ApprovalInstance | null = null;
    try {
      const approvalRes = await expenses.getApprovalInstance(expenseId);
      approvalInstance = approvalRes.data;
    } catch {
      approvalInstance = null;
    }

    return {
      expense: expenseRes.data,
      timeline: Array.isArray(timelineRes.data) ? timelineRes.data : [],
      approvalInstance,
    };
  };

  const { data, loading, refresh } = usePolling({
    fetcher,
    interval: 20000,
    enabled: !!expenseId,
  });

  const expense = data?.expense ?? null;
  const timeline = data?.timeline ?? [];
  const approvalInstance = data?.approvalInstance ?? null;

  const canAct = !!expense && (isAdmin || isManager) && ['pending_approval', 'on_hold'].includes(expense.status);
  const canResume = expense?.status === 'on_hold';

  const actionConfig: Record<
    ReviewAction,
    {
      title: string;
      description: string;
      actionLabel: string;
      variant: 'success' | 'danger' | 'warning' | 'primary';
      requireComment: boolean;
    }
  > = {
    approve: {
      title: 'Approve expense',
      description: 'Advance this expense through the workflow.',
      actionLabel: 'Approve',
      variant: 'success',
      requireComment: false,
    },
    reject: {
      title: 'Reject expense',
      description: 'Stop the workflow and return the record with decision context.',
      actionLabel: 'Reject',
      variant: 'danger',
      requireComment: true,
    },
    hold: {
      title: 'Put expense on hold',
      description: 'Pause the workflow until the issue is clarified.',
      actionLabel: 'Hold',
      variant: 'warning',
      requireComment: true,
    },
    resume: {
      title: 'Resume expense',
      description: 'Restart a paused workflow from its current step.',
      actionLabel: 'Resume',
      variant: 'primary',
      requireComment: false,
    },
  };

  const handleAction = async (comment: string) => {
    if (!expenseId) return;

    setActionLoading(true);
    try {
      const payload = { comment, reason_code: null };
      if (modal.type === 'approve') await approvals.approve(expenseId, payload);
      if (modal.type === 'reject') await approvals.reject(expenseId, payload);
      if (modal.type === 'hold') await approvals.hold(expenseId, payload);
      if (modal.type === 'resume') await approvals.resume(expenseId, payload);
      setModal({ open: false, type: 'approve' });
      await refresh();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="ops-hero h-[240px] shimmer" />
        <div className="summary-strip h-[180px] shimmer" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.28fr_.8fr]">
          <div className="narrative-panel h-[860px] shimmer" />
          <div className="space-y-6">
            <div className="aside-surface h-[280px] shimmer" />
            <div className="aside-surface h-[500px] shimmer" />
          </div>
        </div>
      </div>
    );
  }

  if (!expense) {
    return (
      <EmptyState
        title="Expense not found"
        description="The record may have been removed or you may no longer have access to it."
        action={
          <button onClick={() => navigate(-1)} className="btn-secondary text-sm">
            Go back
          </button>
        }
      />
    );
  }

  const modalConfig = actionConfig[modal.type];
  const currentStep =
    approvalInstance?.steps.find((step) => step.status === 'pending')?.sequence ??
    expense.approval_summary?.current_step_sequence ??
    approvalInstance?.steps.length ??
    0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Expense Review"
        subtitle="Inspect the claim, verify the policy context, and make the next workflow decision with confidence."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app' },
          { label: 'Approvals', href: '/app/approvals' },
          { label: expense.employee_name },
        ]}
        actions={
          <button onClick={() => navigate(-1)} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <ArrowLeft size={14} />
            Back
          </button>
        }
      />

      <section className="ops-hero p-7 xl:p-9">
        <div className="grid gap-8 xl:grid-cols-[1.4fr_.95fr]">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <StatusBadge status={expense.status} pulse={expense.status === 'pending_approval'} />
              <span className="ops-pill">Step {currentStep || 'Pending setup'}</span>
              {expense.reimbursement && <StatusBadge status={expense.reimbursement.status} size="sm" />}
            </div>
            <h1 className="max-w-4xl font-display text-[2.2rem] font-semibold leading-[1.02] tracking-[-0.05em] text-[var(--text-primary)] md:text-[3rem]">
              {expense.description}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-secondary)] md:text-base">
              {expense.employee_name} submitted this {expense.category.toLowerCase()} expense on {formatDate(expense.expense_date, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}. This page keeps evidence, decision context, and next-state consequences visible together.
            </p>
          </div>

          <div className="summary-strip overflow-hidden self-start">
            <div className="summary-strip-grid">
              <div className="summary-strip-item">
                <div className="section-kicker">Submitted by</div>
                <div className="mt-3 text-base font-semibold text-[var(--text-primary)]">{expense.employee_name}</div>
              </div>
              <div className="summary-strip-item">
                <div className="section-kicker">Original amount</div>
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
                <div className="section-kicker">Current step</div>
                <div className="mt-3 text-base font-semibold text-[var(--text-primary)]">Step {currentStep || 'Pending setup'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.28fr_.8fr]">
        <section className="narrative-panel overflow-hidden">
          <ReviewBlock
            title="Claim Story"
            description="The submitted claim should read like one coherent record, not a patchwork of isolated fact cards."
          >
            <div className="flex flex-wrap gap-2">
              <span className="ops-pill"><User size={12} />{expense.employee_name}</span>
              <span className="ops-pill"><Tag size={12} />{expense.category}</span>
              <span className="ops-pill">{formatStatus(expense.status)}</span>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[1.08fr_.92fr]">
              <div className="space-y-1">
                <InfoRow
                  label="Original submitted total"
                  value={formatMoney(expense.original_amount, expense.original_currency)}
                  emphasize
                />
                <InfoRow
                  label="Converted company total"
                  value={formatMoney(expense.converted_amount, expense.company_currency)}
                  emphasize
                />
                <InfoRow
                  label="Final included total"
                  value={formatMoney(expense.final_included_total, expense.original_currency)}
                  emphasize
                />
                <InfoRow
                  label="Conversion rate"
                  value={`1 ${expense.original_currency} = ${expense.conversion_rate} ${expense.company_currency}`}
                />
                {expense.submitted_total_before_exclusions !== expense.final_included_total && (
                  <InfoRow
                    label="Pre-exclusion total"
                    value={formatMoney(expense.submitted_total_before_exclusions, expense.original_currency)}
                  />
                )}
              </div>

              <div className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-sunken)] px-5 py-4">
                <div className="section-kicker">Reviewer framing</div>
                <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                  Review the claim amount, check whether excluded lines changed the submitted total, inspect the receipt evidence, and then act with an audit-quality reason if you hold or reject.
                </p>
              </div>
            </div>
          </ReviewBlock>

          <ReviewBlock
            title="Receipt And Lines"
            description="Receipt evidence and extracted lines should stay in one evidence area so the reviewer can judge the whole claim coherently."
            icon={<FileText size={18} />}
          >
            {expense.receipt ? (
              <div className="ops-list-row">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-sunken)] text-[var(--accent)]">
                    <FileText size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{expense.receipt.file_name}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      OCR state: {formatStatus(expense.receipt.ocr_status)}
                    </div>
                  </div>
                </div>
                <StatusBadge status={expense.receipt.ocr_status} size="sm" />
              </div>
            ) : (
              <EmptyState title="No receipt attached" description="This expense does not currently include receipt evidence." />
            )}

            {expense.line_items.length > 0 ? (
              <div className="mt-5 space-y-3">
                {expense.line_items.map((line) => (
                  <div key={line.source_line_id} className={`ops-list-row ${line.included ? '' : 'opacity-65'}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{line.name}</span>
                        <StatusBadge status={line.included ? 'approved' : 'rejected'} size="sm" />
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">{line.category}</div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                      {formatMoney(line.amount, expense.original_currency)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState
                  title="No extracted lines"
                  description="This record does not currently carry extracted line-item detail."
                />
              </div>
            )}
          </ReviewBlock>

          <ReviewBlock
            title="Workflow Trail"
            description="The sequence of decisions and comments should stay readable as a process narrative, not hidden behind secondary widgets."
          >
            <Timeline events={timeline} />
          </ReviewBlock>
        </section>

        <aside className="space-y-6">
          <section className="aside-surface overflow-hidden">
            <div className="section-divider px-6 py-6">
              <div className="section-kicker">Decision desk</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Actions stay grouped here so the reviewer can see readiness, decide, and leave context where required.
              </p>
            </div>

            <div className="section-divider px-6 py-5">
              <div className="grid gap-2">
                <button
                  disabled={!canAct}
                  onClick={() => setModal({ open: true, type: 'approve' })}
                  className="btn-success w-full inline-flex items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  Approve
                </button>
                <button
                  disabled={!canAct}
                  onClick={() => setModal({ open: true, type: 'reject' })}
                  className="btn-danger w-full inline-flex items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShieldX size={14} />
                  Reject
                </button>
                <button
                  disabled={!canAct}
                  onClick={() => setModal({ open: true, type: 'hold' })}
                  className="btn-warning w-full inline-flex items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PauseCircle size={14} />
                  Hold
                </button>
                <button
                  disabled={!canResume}
                  onClick={() => setModal({ open: true, type: 'resume' })}
                  className="btn-primary w-full inline-flex items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlayCircle size={14} />
                  Resume
                </button>
              </div>
            </div>

            <div className="section-divider px-6 py-5">
              <div className="section-kicker">Action state</div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {actionReadiness(expense, canAct, canResume)}
              </p>
            </div>
          </section>

          <section className="aside-surface overflow-hidden">
            <div className="section-divider px-6 py-6">
              <div className="flex items-center justify-between gap-3">
                <div className="section-kicker">Policy snapshot</div>
                <HandCoins size={18} className="text-[var(--text-muted)]" />
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Policy evaluation stays visible while a reviewer acts so decision and rule context remain connected.
              </p>
            </div>

            {approvalInstance ? (
              <>
                <div className="section-divider px-6 py-5">
                  <InfoRow label="Policy name" value={approvalInstance.policy_name} emphasize />
                  <InfoRow label="Current step" value={`Step ${currentStep || approvalInstance.steps.length}`} emphasize />
                  <InfoRow label="Trigger state" value={formatStatus(approvalInstance.trigger_evaluation.state)} />
                </div>

                <div className="section-divider px-6 py-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Passed conditions
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {approvalInstance.trigger_evaluation.passed_conditions.length > 0 ? (
                      approvalInstance.trigger_evaluation.passed_conditions.map((condition) => (
                        <span
                          key={condition}
                          className="rounded-full border border-[rgba(36,112,85,0.22)] bg-[rgba(36,112,85,0.09)] px-3 py-1.5 text-xs text-[var(--text-secondary)]"
                        >
                          {condition}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--text-muted)]">No passed conditions yet.</span>
                    )}
                  </div>
                </div>

                <div className="section-divider px-6 py-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Failed conditions
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {approvalInstance.trigger_evaluation.failed_conditions.length > 0 ? (
                      approvalInstance.trigger_evaluation.failed_conditions.map((condition) => (
                        <span
                          key={condition}
                          className="rounded-full border border-[rgba(137,63,54,0.2)] bg-[rgba(137,63,54,0.08)] px-3 py-1.5 text-xs text-[var(--text-secondary)]"
                        >
                          {condition}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--text-muted)]">No failed conditions.</span>
                    )}
                  </div>
                </div>

                <div className="section-divider px-6 py-5">
                  <div className="section-kicker">Approval steps</div>
                  <div className="mt-4 space-y-3">
                    {approvalInstance.steps.map((step) => (
                      <div key={`${step.sequence}-${step.approver_user_id}`} className="ops-list-row">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-primary)]">
                            Step {step.sequence} · {step.approver_name}
                          </div>
                          <div className="mt-1 text-xs text-[var(--text-secondary)]">{step.approver_role}</div>
                          {step.comment && (
                            <div className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">
                              {step.comment}
                            </div>
                          )}
                        </div>
                        <StatusBadge status={step.status} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="section-divider px-6 py-5">
                <EmptyState
                  title="No policy snapshot"
                  description="Approval metadata is not available yet for this expense."
                />
              </div>
            )}
          </section>
        </aside>
      </section>

      <ActionConfirmModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, type: 'approve' })}
        onConfirm={handleAction}
        title={modalConfig.title}
        description={modalConfig.description}
        actionLabel={modalConfig.actionLabel}
        actionVariant={modalConfig.variant}
        requireComment={modalConfig.requireComment}
        loading={actionLoading}
      />
    </div>
  );
}
