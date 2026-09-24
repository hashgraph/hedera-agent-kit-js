import { describe, it, expect } from 'vitest';
import { PolicyResultParser } from '../src/policyResultParser';

const policyBlockEnvelope = {
  raw: {
    status: 'ERROR',
    errorCode: 'POLICY_BLOCKED',
    error: 'Failed to execute Disburse Grant: Action disburse_grant blocked by policy: Grant Amount Policy (cap)',
    policyBlock: {
      code: 'POLICY_BLOCKED',
      policyName: 'Grant Amount Policy',
      toolMethod: 'disburse_grant',
      stage: 'post_params_normalization',
      description: 'cap',
      details: { approvedUsd: 750, capUsd: 500 },
    },
  },
  humanMessage: 'Failed to execute Disburse Grant: Action disburse_grant blocked by policy: Grant Amount Policy (cap)',
};

const successEnvelope = {
  raw: { status: 'SUCCESS', transactionId: '0.0.1@1.2' },
  humanMessage: 'Done',
};

const errorEnvelope = {
  raw: { status: 'ERROR', error: 'Network error' },
  humanMessage: 'Network error',
};

describe('PolicyResultParser (AI SDK)', () => {
  const parser = new PolicyResultParser();

  describe('parse()', () => {
    it('classifies a bare { raw, humanMessage } policy-block envelope', () => {
      const result = parser.parse(policyBlockEnvelope);
      expect(result.kind).toBe('policy_block');
      if (result.kind === 'policy_block') {
        expect(result.policyName).toBe('Grant Amount Policy');
        expect(result.stage).toBe('post_params_normalization');
        expect(result.details).toEqual({ approvedUsd: 750, capUsd: 500 });
      }
    });

    it('classifies AI SDK output shape: { output: { raw, humanMessage } }', () => {
      const toolResult = { output: policyBlockEnvelope };
      const result = parser.parse(toolResult);
      expect(result.kind).toBe('policy_block');
    });

    it('classifies a success envelope', () => {
      expect(parser.parse(successEnvelope).kind).toBe('success');
    });

    it('classifies a generic error envelope as failure', () => {
      expect(parser.parse(errorEnvelope).kind).toBe('failure');
    });

    it('returns parse_error for null', () => {
      expect(parser.parse(null).kind).toBe('parse_error');
    });

    it('returns parse_error for opaque string (not an envelope)', () => {
      expect(parser.parse('{"status":"ERROR"}').kind).toBe('parse_error');
    });
  });

  describe('isPolicyBlocked()', () => {
    it('returns true for a policy-block envelope', () => {
      expect(parser.isPolicyBlocked(policyBlockEnvelope)).toBe(true);
    });

    it('returns true for AI SDK { output: envelope } shape', () => {
      expect(parser.isPolicyBlocked({ output: policyBlockEnvelope })).toBe(true);
    });

    it('returns false for a success envelope', () => {
      expect(parser.isPolicyBlocked(successEnvelope)).toBe(false);
    });

    it('returns false for a generic error envelope', () => {
      expect(parser.isPolicyBlocked(errorEnvelope)).toBe(false);
    });
  });

  describe('parsePolicyBlocks()', () => {
    it('filters only policy-block entries from a mixed array', () => {
      const results = [policyBlockEnvelope, successEnvelope, errorEnvelope];
      const blocks = parser.parsePolicyBlocks(results);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].policyName).toBe('Grant Amount Policy');
    });

    it('returns empty array when no policy blocks present', () => {
      expect(parser.parsePolicyBlocks([successEnvelope, errorEnvelope])).toHaveLength(0);
    });

    it('returns empty array for empty input', () => {
      expect(parser.parsePolicyBlocks([])).toHaveLength(0);
    });

    it('handles AI SDK output-shape entries in mixed array', () => {
      const blocks = parser.parsePolicyBlocks([
        { output: policyBlockEnvelope },
        successEnvelope,
      ]);
      expect(blocks).toHaveLength(1);
    });
  });
});
