import { describe, it, expect } from 'vitest';
import {
  PolicyBlockedError,
  isPolicyBlockedError,
  POLICY_BLOCK_STAGES,
  type PolicyBlockStage,
} from '@/shared/policy-blocked-error';

describe('PolicyBlockedError', () => {
  const stage: PolicyBlockStage = POLICY_BLOCK_STAGES.POST_PARAMS_NORMALIZATION;

  describe('constructor', () => {
    it('sets all fields correctly', () => {
      const err = new PolicyBlockedError(
        'Grant Amount Policy',
        'disburse_grant',
        stage,
        'Blocks payouts above the cap',
        { approvedUsd: 750, capUsd: 500 },
      );

      expect(err.code).toBe('POLICY_BLOCKED');
      expect(err.policyName).toBe('Grant Amount Policy');
      expect(err.toolMethod).toBe('disburse_grant');
      expect(err.stage).toBe('post_params_normalization');
      expect(err.description).toBe('Blocks payouts above the cap');
      expect(err.details).toEqual({ approvedUsd: 750, capUsd: 500 });
    });

    it('sets name to PolicyBlockedError', () => {
      const err = new PolicyBlockedError('P', 'm', POLICY_BLOCK_STAGES.PRE_TOOL_EXECUTION);
      expect(err.name).toBe('PolicyBlockedError');
    });

    it('produces a human-readable message with description', () => {
      const err = new PolicyBlockedError('My Policy', 'my_tool', stage, 'some description');
      expect(err.message).toBe('Action my_tool blocked by policy: My Policy (some description)');
    });

    it('produces a human-readable message without description', () => {
      const err = new PolicyBlockedError('My Policy', 'my_tool', stage);
      expect(err.message).toBe('Action my_tool blocked by policy: My Policy');
    });

    it('is an instance of Error', () => {
      const err = new PolicyBlockedError('P', 'm', stage);
      expect(err).toBeInstanceOf(Error);
    });

    it('description and details are optional', () => {
      const err = new PolicyBlockedError('P', 'm', stage);
      expect(err.description).toBeUndefined();
      expect(err.details).toBeUndefined();
    });
  });

  describe('POLICY_BLOCK_STAGES', () => {
    it('has the four expected string values', () => {
      expect(POLICY_BLOCK_STAGES.PRE_TOOL_EXECUTION).toBe('pre_tool_execution');
      expect(POLICY_BLOCK_STAGES.POST_PARAMS_NORMALIZATION).toBe('post_params_normalization');
      expect(POLICY_BLOCK_STAGES.POST_CORE_ACTION).toBe('post_core_action');
      expect(POLICY_BLOCK_STAGES.POST_SECONDARY_ACTION).toBe('post_secondary_action');
    });
  });

  describe('isPolicyBlockedError', () => {
    it('returns true for a PolicyBlockedError instance', () => {
      const err = new PolicyBlockedError('P', 'm', stage);
      expect(isPolicyBlockedError(err)).toBe(true);
    });

    it('returns true for a duck-typed object with code POLICY_BLOCKED and policyName', () => {
      const fakeErr = { code: 'POLICY_BLOCKED', policyName: 'SomePolicy', message: 'blocked' };
      expect(isPolicyBlockedError(fakeErr)).toBe(true);
    });

    it('returns false for a plain Error', () => {
      expect(isPolicyBlockedError(new Error('something'))).toBe(false);
    });

    it('returns false for null', () => {
      expect(isPolicyBlockedError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isPolicyBlockedError(undefined)).toBe(false);
    });

    it('returns false for a string', () => {
      expect(isPolicyBlockedError('POLICY_BLOCKED')).toBe(false);
    });

    it('returns false for an object with wrong code', () => {
      expect(isPolicyBlockedError({ code: 'OTHER', policyName: 'P' })).toBe(false);
    });

    it('returns false for an object with correct code but no policyName', () => {
      expect(isPolicyBlockedError({ code: 'POLICY_BLOCKED' })).toBe(false);
    });
  });

  describe('subclass instanceof', () => {
    it('a PolicyBlockedError subclass is instanceof PolicyBlockedError and Error', () => {
      class CustomPolicyError extends PolicyBlockedError {
        constructor(public readonly amountUsd: number) {
          super(
            'Custom Policy',
            'custom_tool',
            POLICY_BLOCK_STAGES.POST_PARAMS_NORMALIZATION,
            'Custom block',
            { amountUsd },
          );
        }
      }

      const err = new CustomPolicyError(750);
      expect(err).toBeInstanceOf(PolicyBlockedError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('POLICY_BLOCKED');
      expect(isPolicyBlockedError(err)).toBe(true);
      expect(err.amountUsd).toBe(750);
    });
  });
});
