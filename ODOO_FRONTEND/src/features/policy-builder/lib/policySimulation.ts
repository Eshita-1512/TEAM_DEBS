import { exampleUsers } from '@/features/policy-builder/mocks/lookups';
import { generatePolicySummary } from '@/features/policy-builder/lib/policySummary';
import type {
  HybridCondition,
  PolicyDefinition,
  PolicySimulationInput,
  PolicySimulationResolvedStep,
  PolicySimulationResult,
} from '@/features/policy-builder/types/policy';

function resolveRoleUser(role: string): string {
  const match = exampleUsers.find((user) => user.role === role);
  return match ? `${match.name} (${match.title})` : role;
}

function conditionLabel(condition: HybridCondition): string {
  if (condition.type === 'percentage_rule') {
    return `${condition.threshold}% threshold`;
  }

  return `${condition.label} override`;
}

export function simulatePolicyDefinition(
  policy: PolicyDefinition,
  input: PolicySimulationInput,
): PolicySimulationResult {
  const resolvedPath: PolicySimulationResolvedStep[] = policy.sequence.map((stage) => {
    switch (stage.approver.type) {
      case 'manager_approver':
        return {
          id: stage.id,
          label: stage.approver.label,
          approverType: stage.approver.type,
          resolvedTo: input.managerName || 'Unresolved manager',
        };
      case 'fixed_approver':
        return {
          id: stage.id,
          label: stage.approver.label,
          approverType: stage.approver.type,
          resolvedTo: stage.approver.label,
        };
      case 'role_approver':
        return {
          id: stage.id,
          label: stage.approver.label,
          approverType: stage.approver.type,
          resolvedTo: resolveRoleUser(stage.approver.role),
        };
    }
  });

  const conditionalRules = policy.rules.map((rule) => {
    if (rule.type === 'hybrid_or_rule') {
      return `${rule.conditions.map(conditionLabel).join(` ${rule.operator} `)}`;
    }
    return conditionLabel(rule);
  });

  const cfoApprovalWouldAutoApprove = policy.rules.some((rule) => {
    if (rule.type === 'specific_approver_rule') {
      return rule.label.toLowerCase().includes('cfo');
    }

    if (rule.type === 'hybrid_or_rule') {
      return rule.conditions.some(
        (condition) =>
          condition.type === 'specific_approver_rule' &&
          condition.label.toLowerCase().includes('cfo'),
      );
    }

    return false;
  });

  const percentageThresholdWouldAutoApprove = policy.rules.some((rule) => {
    if (rule.type === 'percentage_rule') {
      return rule.threshold <= 100;
    }

    if (rule.type === 'hybrid_or_rule') {
      return rule.conditions.some(
        (condition) => condition.type === 'percentage_rule' && condition.threshold <= 100,
      );
    }

    return false;
  });

  const narrative = [
    `${input.employeeName} submits a ${input.category} expense for ${input.department}.`,
    ...generatePolicySummary(policy),
  ].join(' ');

  return {
    resolvedPath,
    conditionalRules,
    cfoApprovalWouldAutoApprove,
    percentageThresholdWouldAutoApprove,
    narrative,
  };
}
