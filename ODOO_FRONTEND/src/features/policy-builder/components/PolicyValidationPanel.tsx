import type { PolicyValidationResult } from '@/features/policy-builder/types/policy';

function IssueGroup({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: { id: string; message: string; path: string }[];
  tone: 'error' | 'warning';
}) {
  if (!issues.length) {
    return null;
  }

  return (
    <div className={`rounded-2xl border p-4 ${tone === 'error' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
      <div className="mt-3 space-y-3">
        {issues.map((issue) => (
          <div key={issue.id}>
            <div className="text-sm text-[var(--text-primary)]">{issue.message}</div>
            <div className="text-xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              {issue.path}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PolicyValidationPanel({
  validation,
}: {
  validation: PolicyValidationResult;
}) {
  return (
    <div className="glass-card p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
        Validation
      </div>
      <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
        Save readiness
      </h3>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Errors block persistence. Warnings flag ambiguous or risky configurations.
      </p>
      <div className="mt-4 space-y-3">
        <IssueGroup title="Errors" issues={validation.errors} tone="error" />
        <IssueGroup title="Warnings" issues={validation.warnings} tone="warning" />
        {validation.errors.length === 0 && validation.warnings.length === 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-[var(--text-primary)]">
            Policy is structurally valid.
          </div>
        ) : null}
      </div>
    </div>
  );
}
