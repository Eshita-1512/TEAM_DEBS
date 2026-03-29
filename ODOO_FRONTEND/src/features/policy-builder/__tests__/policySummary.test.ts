import { describe, expect, it } from 'vitest';
import { createSamplePolicy } from '@/features/policy-builder/__tests__/policyTestData';
import { generatePolicySummary } from '@/features/policy-builder/lib/policySummary';

describe('generatePolicySummary', () => {
  it('produces an ordered narrative for stages and rules', () => {
    const summary = generatePolicySummary(createSamplePolicy());

    expect(summary[0]).toContain('travel claims');
    expect(summary.join(' ')).toContain('manager approves first');
    expect(summary.join(' ')).toContain('Auto-approve');
  });
});
