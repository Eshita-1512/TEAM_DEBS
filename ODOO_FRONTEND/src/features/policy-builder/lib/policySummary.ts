import type {
  HybridCondition,
  PolicyDefinition,
  PolicyRuleBlock,
  SequentialStageBlock,
} from '@/features/policy-builder/types/policy';

function summarizeStage(stage: SequentialStageBlock): string {
  switch (stage.approver.type) {
    case 'manager_approver':
      return `Stage ${stage.order}: the submitting employee's manager approves first.`;
    case 'fixed_approver':
      return `Stage ${stage.order}: ${stage.approver.label} must approve.`;
    case 'role_approver':
      return `Stage ${stage.order}: ${stage.approver.label || stage.approver.role} approves in sequence.`;
    default:
      return `Stage ${stage.order}: approval configured.`;
  }
}

function summarizeCondition(condition: HybridCondition): string {
  if (condition.type === 'percentage_rule') {
    return `${condition.threshold}% of configured approvers approve`;
  }

  return `${condition.label} approves`;
}

function summarizeRule(rule: PolicyRuleBlock): string {
  if (rule.type === 'percentage_rule') {
    return `Auto-approve once ${rule.threshold}% of configured approvers have approved.`;
  }

  if (rule.type === 'specific_approver_rule') {
    return `Auto-approve if ${rule.label} approves.`;
  }

  const parts = rule.conditions.map(summarizeCondition);
  return `Auto-approve when ${parts.join(` ${rule.operator} `)}.`;
}

export function generatePolicySummary(policy: PolicyDefinition): string[] {
  const lines = [
    policy.description.trim() || 'Policy template for reimbursement approval routing.',
  ];

  lines.push(...policy.sequence.map(summarizeStage));

  if (policy.rules.length) {
    lines.push(...policy.rules.map(summarizeRule));
  }

  if (policy.notes.notes.trim()) {
    lines.push(`Notes: ${policy.notes.notes.trim()}`);
  }

  return lines;
}
