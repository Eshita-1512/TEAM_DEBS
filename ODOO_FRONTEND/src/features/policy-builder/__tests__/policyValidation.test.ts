import { describe, expect, it } from 'vitest';
import { createSamplePolicy } from '@/features/policy-builder/__tests__/policyTestData';
import { validatePolicyDefinition } from '@/features/policy-builder/lib/policyValidation';

describe('validatePolicyDefinition', () => {
  it('accepts a valid policy definition', () => {
    const result = validatePolicyDefinition(createSamplePolicy(), {
      validUserIds: ['user_cfo_1', 'user_finance_1'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('flags invalid percentage thresholds and missing names', () => {
    const policy = createSamplePolicy();
    policy.name = '';
    policy.rules = [
      {
        id: 'rule_pct',
        type: 'percentage_rule',
        outcome: 'approve',
        threshold: 120,
        scope: 'all_configured_approvers',
      },
    ];

    const result = validatePolicyDefinition(policy, {
      validUserIds: ['user_cfo_1'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'Policy name is required.',
        'Percentage threshold must be between 1 and 100.',
      ]),
    );
  });
});
