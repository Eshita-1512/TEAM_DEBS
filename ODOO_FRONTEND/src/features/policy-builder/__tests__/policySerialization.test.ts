import { describe, expect, it } from 'vitest';
import { createSamplePolicy } from '@/features/policy-builder/__tests__/policyTestData';
import {
  deserializePolicyDefinition,
  policyDefinitionFromApi,
  policyDefinitionToApiPayload,
  serializePolicyDefinition,
} from '@/features/policy-builder/lib/policySerialization';

describe('policy serialization', () => {
  it('serializes deterministically and round-trips JSON schema', () => {
    const policy = createSamplePolicy();
    const serialized = serializePolicyDefinition(policy);
    const parsed = deserializePolicyDefinition(serialized);

    expect(parsed.name).toBe('Travel Approval Policy');
    expect(serializePolicyDefinition(policy)).toBe(serialized);
  });

  it('maps between builder schema and backend schema', () => {
    const policy = createSamplePolicy();
    const payload = policyDefinitionToApiPayload(policy);

    expect(payload).toMatchObject({
      name: 'Travel Approval Policy',
      is_manager_approver: true,
    });

    const rebuilt = policyDefinitionFromApi({
      id: 'policy_api',
      name: 'API Policy',
      description: 'Loaded from backend',
      is_manager_approver: true,
      steps: [
        {
          id: 'step_api',
          sequence: 1,
          approver_type: 'role',
          approver_user_id: null,
          approver_role_label: 'finance',
        },
      ],
      rules: [
        {
          id: 'rule_api',
          type: 'percentage',
          operator: null,
          percentage_threshold: '0.60',
          specific_approver_user_id: null,
        },
      ],
    });

    expect(rebuilt.sequence).toHaveLength(2);
    expect(rebuilt.rules[0].type).toBe('percentage_rule');
  });
});
