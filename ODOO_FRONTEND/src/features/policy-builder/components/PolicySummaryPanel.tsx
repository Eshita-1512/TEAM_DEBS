import { generatePolicySummary } from '@/features/policy-builder/lib/policySummary';
import { serializePolicyDefinition } from '@/features/policy-builder/lib/policySerialization';
import type { PolicyDefinition } from '@/features/policy-builder/types/policy';

export function PolicySummaryPanel({ policy }: { policy: PolicyDefinition }) {
  const summary = generatePolicySummary(policy);

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Summary
          </div>
          <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
            Human-readable narrative
          </h3>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {summary.map((line) => (
          <p key={line} className="text-sm leading-6 text-[var(--text-secondary)]">
            {line}
          </p>
        ))}
      </div>
      <div className="mt-5 rounded-2xl bg-slate-950 p-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Saved schema
        </div>
        <pre className="max-h-72 overflow-auto text-xs leading-5 text-slate-100">
          {serializePolicyDefinition(policy)}
        </pre>
      </div>
    </div>
  );
}
