import { describe, expect, it } from 'vitest';
import { createSamplePolicy } from '@/features/policy-builder/__tests__/policyTestData';
import { simulatePolicyDefinition } from '@/features/policy-builder/lib/policySimulation';

describe('simulatePolicyDefinition', () => {
  it('resolves the manager stage and rule flags', () => {
    const result = simulatePolicyDefinition(createSamplePolicy(), {
      employeeName: 'Nina Alvarez',
      managerId: 'mgr_1',
      managerName: 'Aarav Shah',
      expenseAmount: 2400,
      category: 'Travel',
      department: 'Sales',
    });

    expect(result.resolvedPath[0].resolvedTo).toBe('Aarav Shah');
    expect(result.cfoApprovalWouldAutoApprove).toBe(true);
    expect(result.percentageThresholdWouldAutoApprove).toBe(true);
  });
});
