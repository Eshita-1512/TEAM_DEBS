import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, type DragEndEvent } from '@dnd-kit/core';
import { FolderInput, FolderOutput, LoaderCircle, Plus, Save, Upload } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { approvalPolicies, users as usersApi } from '@/api/client';
import { exampleUsers } from '@/features/policy-builder/mocks/lookups';
import { PolicyPalette } from '@/features/policy-builder/components/PolicyPalette';
import { PolicyCanvas } from '@/features/policy-builder/components/PolicyCanvas';
import { PolicyInspectorPanel } from '@/features/policy-builder/components/PolicyInspectorPanel';
import { PolicySummaryPanel } from '@/features/policy-builder/components/PolicySummaryPanel';
import { PolicyValidationPanel } from '@/features/policy-builder/components/PolicyValidationPanel';
import { PolicySimulationPanel } from '@/features/policy-builder/components/PolicySimulationPanel';
import { createPercentageRuleBlock, createSpecificApproverRuleBlock } from '@/features/policy-builder/lib/policyFactory';
import {
  deserializePolicyDefinition,
  policyDefinitionFromApi,
  policyDefinitionToApiPayload,
  serializePolicyDefinition,
} from '@/features/policy-builder/lib/policySerialization';
import { validatePolicyDefinition } from '@/features/policy-builder/lib/policyValidation';
import { usePolicyBuilderState } from '@/features/policy-builder/state/usePolicyBuilderState';
import type { ApprovalPolicy, UserDetail } from '@/types/api';

type PaletteBlockType =
  | 'manager_approver'
  | 'fixed_approver'
  | 'role_approver'
  | 'percentage_rule'
  | 'specific_approver_rule'
  | 'hybrid_or_rule';

export function PolicyBuilderPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [activeDragLabel, setActiveDragLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const builder = usePolicyBuilderState();

  const availableUsers = useMemo(
    () =>
      users.length
        ? users.map((user) => ({
            id: user.id,
            name: user.name,
            role: user.role,
            department: user.manager_name ?? 'Operations',
            title: user.role,
          }))
        : exampleUsers,
    [users],
  );

  const validation = useMemo(
    () =>
      validatePolicyDefinition(builder.policy, {
        validUserIds: availableUsers.map((user) => user.id),
      }),
    [availableUsers, builder.policy],
  );

  async function loadAll() {
    setLoading(true);
    setLoadError('');
    try {
      const [policyResponse, userResponse] = await Promise.all([
        approvalPolicies.list(),
        usersApi.list(),
      ]);
      setPolicies(policyResponse.items);
      setUsers(userResponse.items);
    } catch (error) {
      console.error(error);
      setLoadError('Failed to load approval policies or users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  function handleAddBlock(type: PaletteBlockType) {
    if (type === 'manager_approver' || type === 'fixed_approver' || type === 'role_approver') {
      builder.addStage(type);
      return;
    }
    builder.addRule(type);
  }

  async function handleSavePolicy() {
    setSaveMessage('');

    if (!validation.valid) {
      setSaveMessage('Resolve validation errors before saving.');
      return;
    }

    setSaving(true);
    try {
      const payload = policyDefinitionToApiPayload(builder.policy);
      const existing = policies.find((policy) => policy.id === builder.policy.id);
      if (existing) {
        await approvalPolicies.update(existing.id, payload);
      } else {
        await approvalPolicies.create(payload);
      }
      await loadAll();
      setSaveMessage('Policy saved to backend.');
    } catch (error) {
      console.error(error);
      setSaveMessage('Saving failed. Check the backend API contract.');
    } finally {
      setSaving(false);
    }
  }

  function handleExportSchema() {
    const blob = new Blob([serializePolicyDefinition(builder.policy)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${builder.policy.name || 'policy-definition'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportSchema(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const parsed = deserializePolicyDefinition(text);
    builder.replacePolicy(parsed);
    setSaveMessage('Policy schema imported locally.');
    event.target.value = '';
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragLabel('');
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('palette:')) {
      const blockType = activeId.replace('palette:', '') as PaletteBlockType;
      if (overId === 'canvas:sequence' || overId.startsWith('stage-')) {
        if (blockType === 'manager_approver' || blockType === 'fixed_approver' || blockType === 'role_approver') {
          builder.addStage(blockType);
        }
      }
      if (overId === 'canvas:rules' || overId.startsWith('rule-')) {
        if (blockType === 'percentage_rule' || blockType === 'specific_approver_rule' || blockType === 'hybrid_or_rule') {
          builder.addRule(blockType);
        }
      }
      return;
    }

    const isStageDrag = builder.policy.sequence.some((stage) => stage.id === activeId);
    const isRuleDrag = builder.policy.rules.some((rule) => rule.id === activeId);

    if (isStageDrag && builder.policy.sequence.some((stage) => stage.id === overId)) {
      builder.reorderStages(activeId, overId);
    }

    if (isRuleDrag && builder.policy.rules.some((rule) => rule.id === overId)) {
      builder.reorderRules(activeId, overId);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="animate-spin text-[var(--primary)]" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Policy Builder"
        subtitle="Design reusable reimbursement approval templates with explicit sequence, conditional rules, simulation, and deterministic persistence."
        breadcrumbs={[
          { label: 'App', href: '/app' },
          { label: 'Admin', href: '/app/admin/users' },
          { label: 'Policies' },
        ]}
        actions={
          <>
            <button className="btn-secondary" onClick={() => builder.resetPolicy()}>
              <Plus size={14} className="mr-1 inline" />
              New policy
            </button>
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <FolderInput size={14} className="mr-1 inline" />
              Import schema
            </button>
            <button className="btn-secondary" onClick={handleExportSchema}>
              <FolderOutput size={14} className="mr-1 inline" />
              Export schema
            </button>
            <button className="btn-primary" onClick={() => void handleSavePolicy()} disabled={saving}>
              <Save size={14} className="mr-1 inline" />
              {saving ? 'Saving...' : 'Save policy'}
            </button>
          </>
        }
      />

      <input
        ref={fileInputRef}
        hidden
        type="file"
        accept="application/json"
        onChange={(event) => void handleImportSchema(event)}
      />

      {loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-[var(--text-primary)]">
          {loadError}
        </div>
      ) : null}
      {saveMessage ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-[var(--text-primary)]">
          {saveMessage}
        </div>
      ) : null}

      <div className="glass-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              Existing templates
            </div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              Load a saved backend policy into the builder
            </h2>
          </div>
          <button className="btn-secondary" onClick={() => void loadAll()}>
            <Upload size={14} className="mr-1 inline" />
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {policies.length ? (
            policies.map((policy) => (
              <button
                key={policy.id}
                type="button"
                onClick={() => builder.replacePolicy(policyDefinitionFromApi(policy))}
                className="rounded-2xl border border-[var(--border-default)] bg-white/80 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="text-sm font-semibold text-[var(--text-primary)]">{policy.name}</div>
                <div className="mt-2 text-sm text-[var(--text-secondary)]">
                  {policy.description ?? 'No description'}
                </div>
                <div className="mt-3 text-xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  {policy.steps.length} sequence steps · {policy.rules.length} rules
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-white/70 px-4 py-8 text-sm text-[var(--text-secondary)]">
              No policies returned from the backend yet.
            </div>
          )}
        </div>
      </div>

      <DndContext
        onDragStart={(event) => {
          setActiveDragLabel(String(event.active.id).replace('palette:', '').replaceAll('_', ' '));
        }}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <div className="glass-card p-5">
            <PolicyPalette onAddBlock={handleAddBlock} />
          </div>

          <div className="glass-card p-5">
            <PolicyCanvas
              policy={builder.policy}
              selectedBlock={builder.selectedBlock}
              onSelectBlock={builder.setSelectedBlock}
              onRemoveStage={builder.removeStage}
              onRemoveRule={builder.removeRule}
            />
          </div>

          <div className="space-y-6">
            <PolicyInspectorPanel
              policy={builder.policy}
              selectedStage={builder.selectedStage}
              selectedRule={builder.selectedRule}
              selectedNotes={builder.selectedBlock.kind === 'notes'}
              users={availableUsers}
              onUpdateMeta={builder.updatePolicyMeta}
              onUpdateNotes={builder.updateNotes}
              onUpdateStage={(stageId, values) =>
                builder.updateStage(stageId, (stage) => {
                  if (values.approverType === 'manager_approver') {
                    return {
                      ...stage,
                      name: values.name,
                      approver: {
                        id: stage.approver.id,
                        type: 'manager_approver',
                        label: values.label || 'Employee manager',
                        required: true,
                        helpText: 'Resolved from the submitting employee at runtime.',
                      },
                    };
                  }
                  if (values.approverType === 'fixed_approver') {
                    return {
                      ...stage,
                      name: values.name,
                      approver: {
                        id: stage.approver.id,
                        type: 'fixed_approver',
                        userId: values.userId || '',
                        label: values.label || 'Specific approver',
                        required: true,
                      },
                    };
                  }
                  return {
                    ...stage,
                    name: values.name,
                    approver: {
                      id: stage.approver.id,
                      type: 'role_approver',
                      role: values.role || 'finance',
                      label: values.label || values.role || 'Role approver',
                      required: true,
                    },
                  };
                })
              }
              onUpdateRule={(ruleId, values) =>
                builder.updateRule(ruleId, (rule) => {
                  if (rule.type === 'percentage_rule') {
                    return {
                      ...rule,
                      threshold: values.threshold ?? rule.threshold,
                    };
                  }
                  if (rule.type === 'specific_approver_rule') {
                    return {
                      ...rule,
                      userId: values.userId || '',
                      label: values.label || 'Specific approver',
                    };
                  }
                  return {
                    ...rule,
                    operator: values.operator,
                    conditions: [
                      createPercentageRuleBlock(values.hybridThreshold ?? 60),
                      createSpecificApproverRuleBlock(
                        values.hybridUserId || '',
                        values.hybridLabel || 'Specific approver',
                      ),
                    ],
                  };
                })
              }
            />
            <PolicySummaryPanel policy={builder.policy} />
            <PolicyValidationPanel validation={validation} />
          </div>
        </div>

        <DragOverlay>
          {activeDragLabel ? (
            <div className="rounded-2xl border border-[var(--border-default)] bg-white/90 px-4 py-3 text-sm font-semibold capitalize shadow-xl">
              {activeDragLabel}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <PolicySimulationPanel policy={builder.policy} />
    </div>
  );
}
