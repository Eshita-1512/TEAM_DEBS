import { useMemo, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import {
  createEmptyPolicyDefinition,
  createFixedApproverBlock,
  createHybridRuleBlock,
  createManagerApproverBlock,
  createPercentageRuleBlock,
  createRoleApproverBlock,
  createSequentialStage,
  createSpecificApproverRuleBlock,
  resequenceStages,
} from '@/features/policy-builder/lib/policyFactory';
import type {
  BlockSelection,
  PolicyDefinition,
  PolicyRuleBlock,
  SequentialStageBlock,
} from '@/features/policy-builder/types/policy';

export function reorderSequenceBlocks(
  sequence: SequentialStageBlock[],
  activeId: string,
  overId: string,
): SequentialStageBlock[] {
  const oldIndex = sequence.findIndex((stage) => stage.id === activeId);
  const newIndex = sequence.findIndex((stage) => stage.id === overId);

  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return sequence;
  }

  return resequenceStages(arrayMove(sequence, oldIndex, newIndex));
}

export function reorderRuleBlocks<T extends PolicyRuleBlock>(
  rules: T[],
  activeId: string,
  overId: string,
): T[] {
  const oldIndex = rules.findIndex((rule) => rule.id === activeId);
  const newIndex = rules.findIndex((rule) => rule.id === overId);

  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return rules;
  }

  return arrayMove(rules, oldIndex, newIndex);
}

export function usePolicyBuilderState(initialPolicy?: PolicyDefinition) {
  const [policy, setPolicy] = useState<PolicyDefinition>(initialPolicy ?? createEmptyPolicyDefinition());
  const [selectedBlock, setSelectedBlock] = useState<BlockSelection>({ kind: 'policy' });

  const selectedStage = useMemo(
    () =>
      selectedBlock.kind === 'stage'
        ? policy.sequence.find((stage) => stage.id === selectedBlock.id) ?? null
        : null,
    [policy.sequence, selectedBlock],
  );

  const selectedRule = useMemo(
    () =>
      selectedBlock.kind === 'rule'
        ? policy.rules.find((rule) => rule.id === selectedBlock.id) ?? null
        : null,
    [policy.rules, selectedBlock],
  );

  function replacePolicy(next: PolicyDefinition) {
    setPolicy(next);
    setSelectedBlock({ kind: 'policy' });
  }

  function resetPolicy() {
    replacePolicy(createEmptyPolicyDefinition());
  }

  function updatePolicyMeta(changes: Partial<Pick<PolicyDefinition, 'name' | 'description'>>) {
    setPolicy((current) => ({ ...current, ...changes }));
  }

  function updateNotes(notes: string) {
    setPolicy((current) => ({
      ...current,
      notes: {
        ...current.notes,
        notes,
      },
    }));
  }

  function addStage(blockType: 'manager_approver' | 'fixed_approver' | 'role_approver') {
    setPolicy((current) => {
      const order = current.sequence.length + 1;
      const approver =
        blockType === 'manager_approver'
          ? createManagerApproverBlock()
          : blockType === 'fixed_approver'
            ? createFixedApproverBlock()
            : createRoleApproverBlock();
      const stage = createSequentialStage(approver, order);
      setSelectedBlock({ kind: 'stage', id: stage.id });
      return {
        ...current,
        sequence: resequenceStages([...current.sequence, stage]),
      };
    });
  }

  function addRule(blockType: 'percentage_rule' | 'specific_approver_rule' | 'hybrid_or_rule') {
    setPolicy((current) => {
      const rule =
        blockType === 'percentage_rule'
          ? createPercentageRuleBlock()
          : blockType === 'specific_approver_rule'
            ? createSpecificApproverRuleBlock()
            : createHybridRuleBlock();

      setSelectedBlock({ kind: 'rule', id: rule.id });
      return {
        ...current,
        rules: [...current.rules, rule],
      };
    });
  }

  function removeStage(id: string) {
    setPolicy((current) => ({
      ...current,
      sequence: resequenceStages(current.sequence.filter((stage) => stage.id !== id)),
    }));
    setSelectedBlock({ kind: 'policy' });
  }

  function removeRule(id: string) {
    setPolicy((current) => ({
      ...current,
      rules: current.rules.filter((rule) => rule.id !== id),
    }));
    setSelectedBlock({ kind: 'policy' });
  }

  function reorderStages(activeId: string, overId: string) {
    setPolicy((current) => ({
      ...current,
      sequence: reorderSequenceBlocks(current.sequence, activeId, overId),
    }));
  }

  function reorderRules(activeId: string, overId: string) {
    setPolicy((current) => ({
      ...current,
      rules: reorderRuleBlocks(current.rules, activeId, overId),
    }));
  }

  function updateStage(id: string, updater: (stage: SequentialStageBlock) => SequentialStageBlock) {
    setPolicy((current) => ({
      ...current,
      sequence: current.sequence.map((stage) => (stage.id === id ? updater(stage) : stage)),
    }));
  }

  function updateRule(id: string, updater: (rule: PolicyRuleBlock) => PolicyRuleBlock) {
    setPolicy((current) => ({
      ...current,
      rules: current.rules.map((rule) => (rule.id === id ? updater(rule) : rule)),
    }));
  }

  return {
    policy,
    selectedBlock,
    selectedStage,
    selectedRule,
    setSelectedBlock,
    replacePolicy,
    resetPolicy,
    updatePolicyMeta,
    updateNotes,
    addStage,
    addRule,
    removeStage,
    removeRule,
    reorderStages,
    reorderRules,
    updateStage,
    updateRule,
  };
}
