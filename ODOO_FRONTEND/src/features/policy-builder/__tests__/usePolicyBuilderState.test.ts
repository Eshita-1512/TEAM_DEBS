import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePolicyBuilderState } from '@/features/policy-builder/state/usePolicyBuilderState';

describe('usePolicyBuilderState', () => {
  it('adds, updates, and reorders sequence stages', () => {
    const { result } = renderHook(() => usePolicyBuilderState());

    act(() => {
      result.current.addStage('role_approver');
      result.current.addStage('fixed_approver');
    });

    const [first, second] = result.current.policy.sequence;

    act(() => {
      result.current.updateStage(second.id, (stage) => ({
        ...stage,
        name: 'Director review',
      }));
      result.current.reorderStages(second.id, first.id);
    });

    expect(result.current.policy.sequence[0].name).toBe('Director review');
    expect(result.current.policy.sequence[0].order).toBe(1);
  });
});
