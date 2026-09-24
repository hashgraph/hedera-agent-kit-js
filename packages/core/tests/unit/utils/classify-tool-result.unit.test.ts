import { describe, it, expect } from 'vitest';
import {
  classifyToolResult,
  isPolicyBlockedToolResult,
  transactionToolOutputParser,
  type ToolResultStatus,
} from '@/shared/utils/default-tool-output-parsing';

describe('classifyToolResult', () => {
  describe('success', () => {
    it('classifies SUCCESS status and lifts transactionId', () => {
      const result = classifyToolResult({
        raw: { status: 'SUCCESS', transactionId: '0.0.1234@1700000000.000000001' },
        humanMessage: 'Message submitted successfully with transaction id 0.0.1234@1700000000.000000001',
      });

      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.transactionId).toBe('0.0.1234@1700000000.000000001');
        expect(result.humanMessage).toContain('Message submitted');
        expect(result.data).toMatchObject({ status: 'SUCCESS' });
      }
    });

    it('returns undefined transactionId when absent', () => {
      const result = classifyToolResult({
        raw: { status: 'SUCCESS', topicId: '0.0.5678' },
        humanMessage: 'Topic created',
      });

      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.transactionId).toBeUndefined();
      }
    });

    it('exposes typed data via generic parameter', () => {
      type CreateTopicData = { status: string; topicId: string; transactionId: string };
      const result = classifyToolResult<CreateTopicData>({
        raw: { status: 'SUCCESS', topicId: '0.0.5678', transactionId: '0.0.1@2.3' },
        humanMessage: 'Topic created',
      });

      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data.topicId).toBe('0.0.5678');
        expect(result.data.transactionId).toBe('0.0.1@2.3');
      }
    });

    it('classifies RETURN_BYTES mode (bytes + status SUCCESS) as success', () => {
      const result = classifyToolResult({
        raw: { bytes: new Uint8Array([1, 2, 3]), status: 'SUCCESS' },
        humanMessage: 'Transaction bytes are ready for signing.',
      });

      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.transactionId).toBeUndefined();
        expect((result.data as { bytes: Uint8Array }).bytes).toBeInstanceOf(Uint8Array);
      }
    });

    it('status SUCCESS takes precedence over a present error field', () => {
      const result = classifyToolResult({
        raw: { status: 'SUCCESS', error: 'non-fatal warning' },
        humanMessage: 'Done',
      });

      expect(result.kind).toBe('success');
    });
  });

  describe('failure', () => {
    it('classifies ERROR status with error string — errorCode is ERROR', () => {
      const result = classifyToolResult({
        raw: { status: 'ERROR', error: 'Failed to get account: not found' },
        humanMessage: 'Failed to get account: not found',
      });

      expect(result.kind).toBe('failure');
      if (result.kind === 'failure') {
        expect(result.errorCode).toBe('ERROR');
        expect(result.error).toBe('Failed to get account: not found');
      }
    });

    it('uses raw.errorCode over raw.status when present — Hedera receipt failure shape', () => {
      // This is the envelope produced by BaseTool.handleError() when a ReceiptStatusError
      // is thrown: status stays 'ERROR' (discriminator) but errorCode carries the specific
      // SDK status name so callers don't have to parse the prose message.
      const result = classifyToolResult({
        raw: {
          status: 'ERROR',
          errorCode: 'INSUFFICIENT_PAYER_BALANCE',
          transactionId: '0.0.1@1700000000.000000001',
          error:
            'receipt for transaction 0.0.1@1700000000.000000001 contained error status INSUFFICIENT_PAYER_BALANCE',
        },
        humanMessage:
          'receipt for transaction 0.0.1@1700000000.000000001 contained error status INSUFFICIENT_PAYER_BALANCE',
      });

      expect(result.kind).toBe('failure');
      if (result.kind === 'failure') {
        expect(result.errorCode).toBe('INSUFFICIENT_PAYER_BALANCE');
        expect(result.error).toContain('INSUFFICIENT_PAYER_BALANCE');
      }
    });

    it('falls back to humanMessage as error when error field is absent', () => {
      const result = classifyToolResult({
        raw: { status: 'ERROR' },
        humanMessage: 'something went wrong',
      });

      expect(result.kind).toBe('failure');
      if (result.kind === 'failure') {
        expect(result.errorCode).toBe('ERROR');
        expect(result.error).toBe('something went wrong');
      }
    });

    it('classifies error string with no status as failure with UNKNOWN code', () => {
      const result = classifyToolResult({
        raw: { error: 'Network unreachable' },
        humanMessage: 'Network unreachable',
      });

      expect(result.kind).toBe('failure');
      if (result.kind === 'failure') {
        expect(result.errorCode).toBe('UNKNOWN');
        expect(result.error).toBe('Network unreachable');
      }
    });

    it('classifies object status with error string as failure with UNKNOWN code', () => {
      // Covers third-party plugins that pass a serialized SDK Status object rather than
      // the normalised 'ERROR' string. The object is not a recognised string so
      // errorCode falls back to UNKNOWN; the error string is still surfaced correctly.
      const result = classifyToolResult({
        raw: { status: { _code: 1 }, error: 'INVALID_TRANSACTION' },
        humanMessage: 'INVALID_TRANSACTION',
      });

      expect(result.kind).toBe('failure');
      if (result.kind === 'failure') {
        expect(result.errorCode).toBe('UNKNOWN');
        expect(result.error).toBe('INVALID_TRANSACTION');
      }
    });
  });

  describe('parse_error', () => {
    it('classifies PARSE_ERROR status as parse_error and surfaces originalOutput', () => {
      const result = classifyToolResult({
        raw: {
          status: 'PARSE_ERROR',
          error: new SyntaxError('Unexpected token'),
          originalOutput: 'not-json{',
        },
        humanMessage: 'Error: Failed to parse tool output. The output was malformed.',
      });

      expect(result.kind).toBe('parse_error');
      if (result.kind === 'parse_error') {
        expect(result.originalOutput).toBe('not-json{');
        expect(result.humanMessage).toContain('Failed to parse');
      }
    });

    it('classifies null raw as parse_error', () => {
      const result = classifyToolResult({ raw: null as unknown as object, humanMessage: '' });
      expect(result.kind).toBe('parse_error');
    });

    it('classifies non-object raw as parse_error and surfaces the value', () => {
      const result = classifyToolResult({ raw: 'oops' as unknown as object, humanMessage: '' });
      expect(result.kind).toBe('parse_error');
      if (result.kind === 'parse_error') {
        expect(result.originalOutput).toBe('oops');
        expect(result.humanMessage).toContain('unexpected format');
      }
    });
  });

  describe('unknown', () => {
    it('classifies unrecognized string status with no error as unknown', () => {
      const result = classifyToolResult({
        raw: { status: 'FAILED' },
        humanMessage: 'something happened',
      });

      expect(result.kind).toBe('unknown');
      if (result.kind === 'unknown') {
        expect(result.humanMessage).toBe('something happened');
      }
    });

    it('classifies object status with no error as unknown', () => {
      const result = classifyToolResult({
        raw: { status: { _code: 9 } },
        humanMessage: 'something went wrong',
      });

      expect(result.kind).toBe('unknown');
    });

    it('classifies raw with no status and no error as unknown', () => {
      const result = classifyToolResult({
        raw: { someOtherField: 'value' },
        humanMessage: 'unexpected shape',
      });

      expect(result.kind).toBe('unknown');
    });
  });

  describe('policy_block', () => {
    const policyBlockRaw = {
      raw: {
        status: 'ERROR',
        errorCode: 'POLICY_BLOCKED',
        error: 'Failed to execute Disburse Grant: Action disburse_grant blocked by policy: Grant Amount Policy (Blocks payouts above the configured auto-pay USD cap)',
        policyBlock: {
          code: 'POLICY_BLOCKED',
          policyName: 'Grant Amount Policy',
          toolMethod: 'disburse_grant',
          stage: 'post_params_normalization',
          description: 'Blocks payouts above the configured auto-pay USD cap',
          details: { approvedUsd: 750, capUsd: 500 },
        },
      },
      humanMessage: 'Failed to execute Disburse Grant: Action disburse_grant blocked by policy: Grant Amount Policy (Blocks payouts above the configured auto-pay USD cap)',
    };

    it('classifies a policy-block envelope as policy_block kind', () => {
      const result = classifyToolResult(policyBlockRaw);

      expect(result.kind).toBe('policy_block');
      if (result.kind === 'policy_block') {
        expect(result.policyName).toBe('Grant Amount Policy');
        expect(result.toolMethod).toBe('disburse_grant');
        expect(result.stage).toBe('post_params_normalization');
        expect(result.description).toBe('Blocks payouts above the configured auto-pay USD cap');
        expect(result.details).toEqual({ approvedUsd: 750, capUsd: 500 });
        expect(result.error).toContain('blocked by policy: Grant Amount Policy');
        expect(result.humanMessage).toContain('Disburse Grant');
      }
    });

    it('policy_block without details returns undefined details', () => {
      const envelope = {
        raw: {
          status: 'ERROR',
          errorCode: 'POLICY_BLOCKED',
          error: 'Failed to execute foo: Action foo blocked by policy: Reject Tool Call',
          policyBlock: {
            code: 'POLICY_BLOCKED',
            policyName: 'Reject Tool Call',
            toolMethod: 'foo',
            stage: 'pre_tool_execution',
          },
        },
        humanMessage: 'Failed to execute foo: Action foo blocked by policy: Reject Tool Call',
      };

      const result = classifyToolResult(envelope);
      expect(result.kind).toBe('policy_block');
      if (result.kind === 'policy_block') {
        expect(result.policyName).toBe('Reject Tool Call');
        expect(result.stage).toBe('pre_tool_execution');
        expect(result.details).toBeUndefined();
      }
    });

    it('policy_block survives JSON round-trip (as it would through HederaAgentAPI.run)', () => {
      const serialized = JSON.stringify({ result: policyBlockRaw });
      const parsed = JSON.parse(serialized).result;
      const result = classifyToolResult(parsed);

      expect(result.kind).toBe('policy_block');
      if (result.kind === 'policy_block') {
        expect(result.policyName).toBe('Grant Amount Policy');
        expect(result.details).toEqual({ approvedUsd: 750, capUsd: 500 });
      }
    });

    it('policy_block takes precedence over the generic failure branch', () => {
      // raw.status is ERROR which would match the failure branch — policy_block must fire first
      const result = classifyToolResult(policyBlockRaw);
      expect(result.kind).toBe('policy_block');
      expect(result.kind).not.toBe('failure');
    });
  });

  describe('isPolicyBlockedToolResult', () => {
    it('returns true for a valid policy-block envelope', () => {
      const envelope = {
        raw: {
          status: 'ERROR',
          errorCode: 'POLICY_BLOCKED',
          error: 'blocked',
          policyBlock: {
            code: 'POLICY_BLOCKED',
            policyName: 'SomePolicy',
            toolMethod: 'foo',
            stage: 'pre_tool_execution',
          },
        },
        humanMessage: 'blocked',
      };
      expect(isPolicyBlockedToolResult(envelope)).toBe(true);
    });

    it('returns false for a normal ERROR envelope', () => {
      expect(
        isPolicyBlockedToolResult({
          raw: { status: 'ERROR', error: 'something went wrong' },
          humanMessage: 'something went wrong',
        }),
      ).toBe(false);
    });

    it('returns false for a SUCCESS envelope', () => {
      expect(
        isPolicyBlockedToolResult({
          raw: { status: 'SUCCESS' },
          humanMessage: 'done',
        }),
      ).toBe(false);
    });

    it('returns false when raw is null', () => {
      expect(
        isPolicyBlockedToolResult({ raw: null as any, humanMessage: '' }),
      ).toBe(false);
    });

    it('returns false when policyBlock.code does not match', () => {
      expect(
        isPolicyBlockedToolResult({
          raw: { policyBlock: { code: 'SOMETHING_ELSE' } },
          humanMessage: '',
        }),
      ).toBe(false);
    });
  });

  describe('end-to-end with transactionToolOutputParser', () => {
    it('classifies a successful EXECUTE_TRANSACTION output', () => {
      const rawOutput = JSON.stringify({
        raw: { status: 'SUCCESS', transactionId: '0.0.1234@1700.0' },
        humanMessage: 'Message submitted successfully with transaction id 0.0.1234@1700.0',
      });
      const envelope = transactionToolOutputParser(rawOutput);
      const result: ToolResultStatus = classifyToolResult(envelope);

      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.transactionId).toBe('0.0.1234@1700.0');
      }
    });

    it('classifies malformed parser input as parse_error', () => {
      const envelope = transactionToolOutputParser('not-json{');
      const result = classifyToolResult(envelope);
      expect(result.kind).toBe('parse_error');
    });
  });
});
