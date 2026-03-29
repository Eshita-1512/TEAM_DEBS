import {
  createEmptyPolicyDefinition,
  createHybridRuleBlock,
  createManagerApproverBlock,
  createRoleApproverBlock,
  createSequentialStage,
} from '@/features/policy-builder/lib/policyFactory';
import type { PolicyDefinition } from '@/features/policy-builder/types/policy';

export function createSamplePolicy(): PolicyDefinition {
  const policy = createEmptyPolicyDefinition();
  policy.id = 'policy_travel';
  policy.name = 'Travel Approval Policy';
  policy.description = 'Default approval flow for travel claims';
  policy.sequence = [
    createSequentialStage(createManagerApproverBlock(), 1),
    createSequentialStage(createRoleApproverBlock('finance', 'Finance'), 2),
  ];
  const hybrid = createHybridRuleBlock();
  hybrid.conditions[1] = {
    ...hybrid.conditions[1],
    type: 'specific_approver_rule',
    userId: 'user_cfo_1',
    label: 'CFO',
  };
  policy.rules = [hybrid];
  policy.notes.notes = 'Used for most domestic and international travel reimbursements.';
  return policy;
}
