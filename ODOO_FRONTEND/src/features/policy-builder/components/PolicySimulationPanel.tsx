import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { simulatePolicyDefinition } from '@/features/policy-builder/lib/policySimulation';
import { exampleDepartments, exampleUsers } from '@/features/policy-builder/mocks/lookups';
import type { PolicyDefinition, PolicySimulationInput } from '@/features/policy-builder/types/policy';

export function PolicySimulationPanel({ policy }: { policy: PolicyDefinition }) {
  const { register, watch } = useForm<PolicySimulationInput>({
    defaultValues: {
      employeeName: 'Nina Alvarez',
      managerId: 'mgr_1',
      managerName: 'Aarav Shah',
      expenseAmount: 2400,
      category: 'Travel',
      department: 'Sales',
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const values = watch();
  const simulation = useMemo(() => simulatePolicyDefinition(policy, values), [policy, values]);

  return (
    <div className="glass-card p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
        Simulation
      </div>
      <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
        Example employee resolution
      </h3>
      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="grid gap-3">
          <input className="input-field" placeholder="Employee name" {...register('employeeName')} />
          <input className="input-field" placeholder="Manager name" {...register('managerName')} />
          <input className="input-field" type="number" placeholder="Expense amount" {...register('expenseAmount', { valueAsNumber: true })} />
          <input className="input-field" placeholder="Category" {...register('category')} />
          <select className="input-field" {...register('department')}>
            {exampleDepartments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-[var(--border-default)] bg-white/80 p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)]">Resolved path</div>
            <div className="mt-3 space-y-2">
              {simulation.resolvedPath.map((step, index) => (
                <div key={step.id} className="flex items-center justify-between gap-4 rounded-xl bg-[var(--bg-inset)] px-3 py-2">
                  <span className="text-sm text-[var(--text-primary)]">
                    {index + 1}. {step.label}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">{step.resolvedTo}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-950 p-4 text-slate-50">
              <div className="text-xs uppercase tracking-[0.1em] text-slate-400">CFO override</div>
              <div className="mt-2 text-sm font-semibold">
                {simulation.cfoApprovalWouldAutoApprove ? 'Enabled' : 'Not configured'}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-950 p-4 text-slate-50">
              <div className="text-xs uppercase tracking-[0.1em] text-slate-400">Threshold override</div>
              <div className="mt-2 text-sm font-semibold">
                {simulation.percentageThresholdWouldAutoApprove ? 'Enabled' : 'Not configured'}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-950 p-4 text-slate-50">
              <div className="text-xs uppercase tracking-[0.1em] text-slate-400">Rules</div>
              <div className="mt-2 text-sm font-semibold">
                {simulation.conditionalRules.join(', ') || 'Sequential only'}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-white/80 p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)]">Narrative</div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{simulation.narrative}</p>
          </div>

          <div className="text-xs text-[var(--text-tertiary)]">
            Example directory available for simulation: {exampleUsers.map((user) => user.name).join(', ')}.
          </div>
        </div>
      </div>
    </div>
  );
}
