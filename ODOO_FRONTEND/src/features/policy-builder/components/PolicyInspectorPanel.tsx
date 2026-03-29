import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { PolicyLookupUser } from '@/features/policy-builder/mocks/lookups';
import type {
  PolicyDefinition,
  PolicyRuleBlock,
  SequentialStageBlock,
} from '@/features/policy-builder/types/policy';

const metaSchema = z.object({
  name: z.string().min(1, 'Policy name is required'),
  description: z.string(),
});

const notesSchema = z.object({
  notes: z.string(),
});

const stageSchema = z.object({
  name: z.string().min(1, 'Stage name is required'),
  approverType: z.enum(['manager_approver', 'fixed_approver', 'role_approver']),
  role: z.string().optional(),
  label: z.string().optional(),
  userId: z.string().optional(),
});

const ruleSchema = z.object({
  operator: z.enum(['OR', 'AND']).default('OR'),
  threshold: z.number().min(1).max(100).optional(),
  userId: z.string().optional(),
  label: z.string().optional(),
  hybridThreshold: z.number().min(1).max(100).optional(),
  hybridUserId: z.string().optional(),
  hybridLabel: z.string().optional(),
});

function PanelCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Inspector
        </div>
        <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function PolicyInspectorPanel({
  policy,
  selectedStage,
  selectedRule,
  selectedNotes,
  users,
  onUpdateMeta,
  onUpdateStage,
  onUpdateRule,
  onUpdateNotes,
}: {
  policy: PolicyDefinition;
  selectedStage: SequentialStageBlock | null;
  selectedRule: PolicyRuleBlock | null;
  selectedNotes: boolean;
  users: PolicyLookupUser[];
  onUpdateMeta: (values: { name: string; description: string }) => void;
  onUpdateStage: (
    stageId: string,
    values: {
      name: string;
      approverType: 'manager_approver' | 'fixed_approver' | 'role_approver';
      role?: string;
      label?: string;
      userId?: string;
    },
  ) => void;
  onUpdateRule: (ruleId: string, values: z.infer<typeof ruleSchema>) => void;
  onUpdateNotes: (notes: string) => void;
}) {
  const metaForm = useForm({
    resolver: zodResolver(metaSchema),
    values: {
      name: policy.name,
      description: policy.description,
    },
  });

  const notesForm = useForm({
    resolver: zodResolver(notesSchema),
    values: {
      notes: policy.notes.notes,
    },
  });

  const stageForm = useForm({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      name: '',
      approverType: 'role_approver' as const,
      role: '',
      label: '',
      userId: '',
    },
  });

  const ruleForm = useForm({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      operator: 'OR' as const,
      threshold: 60,
      userId: '',
      label: '',
      hybridThreshold: 60,
      hybridUserId: '',
      hybridLabel: '',
    },
  });

  useEffect(() => {
    if (!selectedStage) {
      return;
    }

    stageForm.reset({
      name: selectedStage.name,
      approverType: selectedStage.approver.type,
      role: selectedStage.approver.type === 'role_approver' ? selectedStage.approver.role : '',
      label: selectedStage.approver.label,
      userId:
        selectedStage.approver.type === 'fixed_approver' ? selectedStage.approver.userId : '',
    });
  }, [selectedStage, stageForm]);

  useEffect(() => {
    if (!selectedRule) {
      return;
    }

    if (selectedRule.type === 'percentage_rule') {
      ruleForm.reset({
        operator: 'OR',
        threshold: selectedRule.threshold,
        userId: '',
        label: '',
        hybridThreshold: 60,
        hybridUserId: '',
        hybridLabel: '',
      });
      return;
    }

    if (selectedRule.type === 'specific_approver_rule') {
      ruleForm.reset({
        operator: 'OR',
        threshold: 60,
        userId: selectedRule.userId,
        label: selectedRule.label,
        hybridThreshold: 60,
        hybridUserId: '',
        hybridLabel: '',
      });
      return;
    }

    const percentageCondition = selectedRule.conditions.find(
      (condition) => condition.type === 'percentage_rule',
    );
    const userCondition = selectedRule.conditions.find(
      (condition) => condition.type === 'specific_approver_rule',
    );

    ruleForm.reset({
      operator: selectedRule.operator,
      threshold: 60,
      userId: '',
      label: '',
      hybridThreshold:
        percentageCondition && percentageCondition.type === 'percentage_rule'
          ? percentageCondition.threshold
          : 60,
      hybridUserId:
        userCondition && userCondition.type === 'specific_approver_rule'
          ? userCondition.userId
          : '',
      hybridLabel:
        userCondition && userCondition.type === 'specific_approver_rule'
          ? userCondition.label
          : '',
    });
  }, [selectedRule, ruleForm]);

  if (selectedStage) {
    // eslint-disable-next-line react-hooks/incompatible-library
    const approverType = stageForm.watch('approverType');

    return (
      <PanelCard
        title={selectedStage.name}
        subtitle="Edit the selected sequential approval stage. These settings compile to the backend approval policy contract."
      >
        <form
          className="space-y-4"
          onSubmit={stageForm.handleSubmit((values) =>
            onUpdateStage(selectedStage.id, values),
          )}
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Stage name
            </label>
            <input className="input-field" {...stageForm.register('name')} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Approver type
            </label>
            <select className="input-field" {...stageForm.register('approverType')}>
              <option value="manager_approver">Manager approver</option>
              <option value="fixed_approver">Fixed approver</option>
              <option value="role_approver">Role approver</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Display label
            </label>
            <input className="input-field" {...stageForm.register('label')} />
          </div>

          {approverType === 'role_approver' ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Runtime role
              </label>
              <input className="input-field" {...stageForm.register('role')} />
            </div>
          ) : null}

          {approverType === 'fixed_approver' ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Specific user
              </label>
              <select className="input-field" {...stageForm.register('userId')}>
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <button type="submit" className="btn-primary w-full">
            Apply stage settings
          </button>
        </form>
      </PanelCard>
    );
  }

  if (selectedRule) {
    return (
      <PanelCard
        title="Rule configuration"
        subtitle="Configure auto-approval logic without leaking UI-only state into persistence."
      >
        <form
          className="space-y-4"
          onSubmit={ruleForm.handleSubmit((values) => onUpdateRule(selectedRule.id, values))}
        >
          {selectedRule.type === 'percentage_rule' ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Percentage threshold
              </label>
              <input
                type="number"
                className="input-field"
                {...ruleForm.register('threshold', { valueAsNumber: true })}
              />
            </div>
          ) : null}

          {selectedRule.type === 'specific_approver_rule' ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Specific approver
                </label>
                <select className="input-field" {...ruleForm.register('userId')}>
                  <option value="">Select user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} · {user.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Label
                </label>
                <input className="input-field" {...ruleForm.register('label')} />
              </div>
            </>
          ) : null}

          {selectedRule.type === 'hybrid_or_rule' ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Operator
                </label>
                <select className="input-field" {...ruleForm.register('operator')}>
                  <option value="OR">OR</option>
                  <option value="AND">AND</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Threshold
                </label>
                <input
                  type="number"
                  className="input-field"
                  {...ruleForm.register('hybridThreshold', { valueAsNumber: true })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Specific approver
                </label>
                <select className="input-field" {...ruleForm.register('hybridUserId')}>
                  <option value="">Select user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} · {user.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Specific approver label
                </label>
                <input className="input-field" {...ruleForm.register('hybridLabel')} />
              </div>
            </>
          ) : null}

          <button type="submit" className="btn-primary w-full">
            Apply rule settings
          </button>
        </form>
      </PanelCard>
    );
  }

  if (selectedNotes) {
    return (
      <PanelCard
        title="Policy notes"
        subtitle="Keep rollout guidance, audit caveats, or policy rationale visible to admins."
      >
        <form
          className="space-y-4"
          onSubmit={notesForm.handleSubmit((values) => onUpdateNotes(values.notes))}
        >
          <textarea className="input-field min-h-32" {...notesForm.register('notes')} />
          <button type="submit" className="btn-primary w-full">
            Save notes
          </button>
        </form>
      </PanelCard>
    );
  }

  return (
    <PanelCard
      title="Policy metadata"
      subtitle="Set the reusable template metadata that will be stored alongside the approval definition."
    >
      <form
        className="space-y-4"
        onSubmit={metaForm.handleSubmit((values) => onUpdateMeta(values))}
      >
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
            Policy name
          </label>
          <input className="input-field" {...metaForm.register('name')} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
            Description
          </label>
          <textarea className="input-field min-h-28" {...metaForm.register('description')} />
        </div>
        <button type="submit" className="btn-primary w-full">
          Update metadata
        </button>
      </form>
    </PanelCard>
  );
}
