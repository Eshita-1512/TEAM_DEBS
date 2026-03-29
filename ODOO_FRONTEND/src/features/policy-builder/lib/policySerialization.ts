import type { ApprovalPolicy } from '@/types/api';
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
import type { PolicyDefinition } from '@/features/policy-builder/types/policy';

function stableSortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSortObject);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = stableSortObject((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

export function serializePolicyDefinition(policy: PolicyDefinition): string {
  return JSON.stringify(stableSortObject(policy), null, 2);
}

export function deserializePolicyDefinition(input: string): PolicyDefinition {
  return JSON.parse(input) as PolicyDefinition;
}

export function policyDefinitionToApiPayload(policy: PolicyDefinition): Record<string, unknown> {
  const managerIndex = policy.sequence.findIndex(
    (stage) => stage.approver.type === 'manager_approver',
  );

  const sequenceWithoutManager = policy.sequence.filter(
    (stage) => stage.approver.type !== 'manager_approver',
  );

  return {
    name: policy.name.trim(),
    description: policy.description.trim() || null,
    is_manager_approver: managerIndex === 0,
    steps: sequenceWithoutManager.map((stage, index) => {
      switch (stage.approver.type) {
        case 'fixed_approver':
          return {
            sequence: index + 1,
            approver_type: 'specific_user',
            approver_user_id: stage.approver.userId,
            approver_role_label: stage.approver.label,
          };
        case 'role_approver':
          return {
            sequence: index + 1,
            approver_type: 'role',
            approver_user_id: null,
            approver_role_label: stage.approver.role,
          };
        default:
          return {
            sequence: index + 1,
            approver_type: 'manager',
            approver_user_id: null,
            approver_role_label: 'manager',
          };
      }
    }),
    rules: policy.rules.map((rule) => {
      if (rule.type === 'percentage_rule') {
        return {
          rule_type: 'percentage',
          operator: null,
          percentage_threshold: (rule.threshold / 100).toFixed(2),
          specific_approver_user_id: null,
        };
      }

      if (rule.type === 'specific_approver_rule') {
        return {
          rule_type: 'specific_approver',
          operator: null,
          percentage_threshold: null,
          specific_approver_user_id: rule.userId,
        };
      }

      const percentageCondition = rule.conditions.find(
        (condition) => condition.type === 'percentage_rule',
      );
      const specificCondition = rule.conditions.find(
        (condition) => condition.type === 'specific_approver_rule',
      );

      return {
        rule_type: 'combined',
        operator: rule.operator,
        percentage_threshold:
          percentageCondition && percentageCondition.type === 'percentage_rule'
            ? (percentageCondition.threshold / 100).toFixed(2)
            : null,
        specific_approver_user_id:
          specificCondition && specificCondition.type === 'specific_approver_rule'
            ? specificCondition.userId
            : null,
      };
    }),
  };
}

export function policyDefinitionFromApi(policy: ApprovalPolicy): PolicyDefinition {
  const next = createEmptyPolicyDefinition();
  next.id = policy.id;
  next.name = policy.name;
  next.description = policy.description ?? '';

  const stages = policy.steps.map((step, index) => {
    if (step.approver_type === 'specific_user') {
      return createSequentialStage(
        createFixedApproverBlock(
          step.approver_user_id ?? '',
          step.approver_role_label || 'Specific approver',
        ),
        index + 1,
      );
    }

    if (step.approver_type === 'manager') {
      return createSequentialStage(createManagerApproverBlock(), index + 1);
    }

    return createSequentialStage(
      createRoleApproverBlock(
        step.approver_role_label || 'finance',
        step.approver_role_label || 'Role approver',
      ),
      index + 1,
    );
  });

  if (policy.is_manager_approver) {
    stages.unshift(createSequentialStage(createManagerApproverBlock(), 1));
  }

  next.sequence = resequenceStages(stages);
  next.rules = policy.rules.map((rule) => {
    if (rule.type === 'percentage') {
      return createPercentageRuleBlock(
        Math.round((Number(rule.percentage_threshold ?? '0') || 0) * 100),
      );
    }

    if (rule.type === 'specific_approver') {
      return createSpecificApproverRuleBlock(
        rule.specific_approver_user_id ?? '',
        'Specific approver',
      );
    }

    const hybrid = createHybridRuleBlock();
    hybrid.operator = rule.operator ?? 'OR';
    hybrid.conditions = [
      createPercentageRuleBlock(
        Math.round((Number(rule.percentage_threshold ?? '0') || 0) * 100),
      ),
      createSpecificApproverRuleBlock(rule.specific_approver_user_id ?? '', 'Specific approver'),
    ];
    return hybrid;
  });

  return next;
}
