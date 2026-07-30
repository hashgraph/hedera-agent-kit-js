import { describe, it, expect } from 'vitest';
import { PolicyResultParser } from '../src/policyResultParser';

const policyBlockEnvelope = {
  raw: {
    status: 'ERROR',
    errorCode: 'POLICY_BLOCKED',
    error: 'Failed to execute Transfer HBAR: Action transfer_hbar blocked by policy: Max Recipients Policy (Limits the maximum number of recipients to 1)',
    policyBlock: {
      code: 'POLICY_BLOCKED',
      policyName: 'Max Recipients Policy',
      toolMethod: 'transfer_hbar',
      stage: 'post_params_normalization',
      description: 'Limits the maximum number of recipients to 1',
      details: { recipientCount: 3, maxRecipients: 1 },
    },
  },
  humanMessage: 'Failed to execute Transfer HBAR: Action transfer_hbar blocked by policy: Max Recipients Policy (Limits the maximum number of recipients to 1)',
};

const successEnvelope = {
  raw: { status: 'SUCCESS', transactionId: '0.0.1@1.2' },
  humanMessage: 'Done',
};

const errorEnvelope = {
  raw: { status: 'ERROR', error: 'Network timeout' },
  humanMessage: 'Network timeout',
};

describe('PolicyResultParser (ADK)', () => {
  const parser = new PolicyResultParser();

  describe('parse()', () => {
    it('classifies a direct { raw, humanMessage } policy-block envelope', () => {
      const result = parser.parse(policyBlockEnvelope);
      expect(result.kind).toBe('policy_block');
      if (result.kind === 'policy_block') {
        expect(result.policyName).toBe('Max Recipients Policy');
        expect(result.stage).toBe('post_params_normalization');
        expect(result.details).toEqual({ recipientCount: 3, maxRecipients: 1 });
      }
    });

    it('classifies a nested { result: { raw, humanMessage } } shape', () => {
      const nested = { result: policyBlockEnvelope };
      const result = parser.parse(nested);
      expect(result.kind).toBe('policy_block');
    });

    it('classifies a success envelope', () => {
      expect(parser.parse(successEnvelope).kind).toBe('success');
    });

    it('classifies a generic error as failure', () => {
      expect(parser.parse(errorEnvelope).kind).toBe('failure');
    });

    it('returns parse_error for null', () => {
      expect(parser.parse(null).kind).toBe('parse_error');
    });
  });

  describe('isPolicyBlocked()', () => {
    it('returns true for a policy-block envelope', () => {
      expect(parser.isPolicyBlocked(policyBlockEnvelope)).toBe(true);
    });

    it('returns false for a success envelope', () => {
      expect(parser.isPolicyBlocked(successEnvelope)).toBe(false);
    });
  });

  describe('parsePolicyBlocks()', () => {
    it('returns only policy-block entries from a mixed array', () => {
      const blocks = parser.parsePolicyBlocks([policyBlockEnvelope, successEnvelope, errorEnvelope]);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].policyName).toBe('Max Recipients Policy');
    });

    it('returns empty array when no blocks present', () => {
      expect(parser.parsePolicyBlocks([successEnvelope])).toHaveLength(0);
    });
  });
});
