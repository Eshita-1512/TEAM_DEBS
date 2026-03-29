import type {
  HybridOrRuleBlock,
  PolicyDefinition,
  PolicyValidationIssue,
  PolicyValidationResult,
} from '@/features/policy-builder/types/policy';

interface ValidationOptions {
  validUserIds: string[];
}

function createIssue(
  level: 'error' | 'warning',
  path: string,
  message: string,
): PolicyValidationIssue {
  return {
    id: `${level}_${path}_${message}`,
    level,
    path,
    message,
  };
}

function hasManagerOutsideFirstStage(policy: PolicyDefinition): boolean {
  return policy.sequence.some(
    (stage, index) => stage.approver.type === 'manager_approver' && index !== 0,
  );
}

function validateHybridRule(
  rule: HybridOrRuleBlock,
  validUserIds: string[],
): PolicyValidationIssue[] {
  const issues: PolicyValidationIssue[] = [];

  if (rule.conditions.length < 2) {
    issues.push(
      createIssue(
        'error',
        `rules.${rule.id}`,
        'Hybrid rules must include at least two valid child conditions.',
      ),
    );
  }

  for (const condition of rule.conditions) {
    if (
      condition.type === 'specific_approver_rule' &&
      !validUserIds.includes(condition.userId)
    ) {
      issues.push(
        createIssue(
          'error',
          `rules.${rule.id}.conditions.${condition.id}`,
          'Specific approver must reference a valid user.',
        ),
      );
    }
    if (
      condition.type === 'percentage_rule' &&
      (condition.threshold < 1 || condition.threshold > 100)
    ) {
      issues.push(
        createIssue(
          'error',
          `rules.${rule.id}.conditions.${condition.id}`,
          'Percentage threshold must be between 1 and 100.',
        ),
      );
    }
  }

  return issues;
}

export function validatePolicyDefinition(
  policy: PolicyDefinition,
  options: ValidationOptions,
): PolicyValidationResult {
  const issues: PolicyValidationIssue[] = [];

  if (!policy.name.trim()) {
    issues.push(createIssue('error', 'name', 'Policy name is required.'));
  }

  if (policy.sequence.length === 0) {
    issues.push(
      createIssue(
        'error',
        'sequence',
        'At least one approver path is required.',
      ),
    );
  }

  if (hasManagerOutsideFirstStage(policy)) {
    issues.push(
      createIssue(
        'warning',
        'sequence',
        'Manager approver should be the first stage because the backend only snapshots managers at the start of a policy.',
      ),
    );
  }

  policy.sequence.forEach((stage) => {
    if (stage.approver.type === 'manager_approver' && 'userId' in stage.approver) {
      issues.push(
        createIssue(
          'error',
          `sequence.${stage.id}`,
          'Manager blocks must not store a hardcoded manager user id.',
        ),
      );
    }

    if (stage.approver.type === 'fixed_approver' && !options.validUserIds.includes(stage.approver.userId)) {
      issues.push(
        createIssue(
          'error',
          `sequence.${stage.id}`,
          'Fixed approver must reference a valid user.',
        ),
      );
    }

    if (stage.approver.type === 'role_approver' && !stage.approver.role.trim()) {
      issues.push(
        createIssue(
          'warning',
          `sequence.${stage.id}`,
          'Role approver should have a role label configured.',
        ),
      );
    }
  });

  policy.rules.forEach((rule) => {
    if (rule.type === 'percentage_rule' && (rule.threshold < 1 || rule.threshold > 100)) {
      issues.push(
        createIssue(
          'error',
          `rules.${rule.id}`,
          'Percentage threshold must be between 1 and 100.',
        ),
      );
    }

    if (rule.type === 'specific_approver_rule' && !options.validUserIds.includes(rule.userId)) {
      issues.push(
        createIssue(
          'error',
          `rules.${rule.id}`,
          'Specific approver must reference a valid user.',
        ),
      );
    }

    if (rule.type === 'hybrid_or_rule') {
      issues.push(...validateHybridRule(rule, options.validUserIds));
    }
  });

  const percentageRules = new Set<number>();
  const specificApprovers = new Set<string>();
  for (const rule of policy.rules) {
    if (rule.type === 'percentage_rule') {
      if (percentageRules.has(rule.threshold)) {
        issues.push(
          createIssue(
            'warning',
            'rules',
            `Duplicate ${rule.threshold}% auto-approve rules should be consolidated.`,
          ),
        );
      }
      percentageRules.add(rule.threshold);
    }

    if (rule.type === 'specific_approver_rule') {
      if (specificApprovers.has(rule.userId)) {
        issues.push(
          createIssue(
            'warning',
            'rules',
            'Duplicate specific approver auto-approve rules should be consolidated.',
          ),
        );
      }
      specificApprovers.add(rule.userId);
    }
  }

  if (!policy.rules.length) {
    issues.push(
      createIssue(
        'warning',
        'rules',
        'No conditional rules configured. The policy will only follow the sequential path.',
      ),
    );
  }

  return {
    valid: !issues.some((issue) => issue.level === 'error'),
    errors: issues.filter((issue) => issue.level === 'error'),
    warnings: issues.filter((issue) => issue.level === 'warning'),
  };
}
