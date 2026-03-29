import {
  POLICY_SCHEMA_VERSION,
  type ApproverBlock,
  type HybridOrRuleBlock,
  type PercentageRuleBlock,
  type PolicyDefinition,
  type SequentialStageBlock,
  type SpecificApproverRuleBlock,
} from '@/features/policy-builder/types/policy';
import { createPolicyBlockId } from '@/features/policy-builder/lib/policyIds';

export function createManagerApproverBlock(): ApproverBlock {
  return {
    id: createPolicyBlockId('manager'),
    type: 'manager_approver',
    label: 'Employee manager',
    required: true,
    helpText: 'Resolved from the submitting employee at runtime.',
  };
}

export function createRoleApproverBlock(role = 'finance', label = 'Finance'): ApproverBlock {
  return {
    id: createPolicyBlockId('role'),
    type: 'role_approver',
    role,
    label,
    required: true,
  };
}

export function createFixedApproverBlock(userId = '', label = 'Specific approver'): ApproverBlock {
  return {
    id: createPolicyBlockId('fixed'),
    type: 'fixed_approver',
    userId,
    label,
    required: true,
  };
}

export function createSequentialStage(
  approver: ApproverBlock,
  order: number,
): SequentialStageBlock {
  return {
    id: createPolicyBlockId('stage'),
    type: 'sequential_stage',
    order,
    name: `Stage ${order}`,
    approver,
  };
}

export function createPercentageRuleBlock(threshold = 60): PercentageRuleBlock {
  return {
    id: createPolicyBlockId('rule_pct'),
    type: 'percentage_rule',
    outcome: 'approve',
    threshold,
    scope: 'all_configured_approvers',
  };
}

export function createSpecificApproverRuleBlock(
  userId = '',
  label = 'Specific approver',
): SpecificApproverRuleBlock {
  return {
    id: createPolicyBlockId('rule_user'),
    type: 'specific_approver_rule',
    outcome: 'approve',
    userId,
    label,
  };
}

export function createHybridRuleBlock(): HybridOrRuleBlock {
  return {
    id: createPolicyBlockId('rule_hybrid'),
    type: 'hybrid_or_rule',
    outcome: 'approve',
    operator: 'OR',
    conditions: [
      createPercentageRuleBlock(),
      createSpecificApproverRuleBlock(),
    ],
  };
}

export function createEmptyPolicyDefinition(): PolicyDefinition {
  return {
    id: createPolicyBlockId('policy'),
    name: '',
    description: '',
    start: {
      id: createPolicyBlockId('start'),
      type: 'start',
      label: 'Submission received',
    },
    sequence: [],
    rules: [],
    notes: {
      id: createPolicyBlockId('notes'),
      type: 'policy_notes',
      notes: '',
    },
    outcome: {
      id: createPolicyBlockId('outcome'),
      type: 'approve_outcome',
      outcome: 'approve',
    },
    metadata: {
      version: POLICY_SCHEMA_VERSION,
      lastEditedAt: new Date().toISOString(),
    },
  };
}

export function resequenceStages(sequence: SequentialStageBlock[]): SequentialStageBlock[] {
  return sequence.map((stage, index) => ({
    ...stage,
    order: index + 1,
    name: stage.name || `Stage ${index + 1}`,
  }));
}
