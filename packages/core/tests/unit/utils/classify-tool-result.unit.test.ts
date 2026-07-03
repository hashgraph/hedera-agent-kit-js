import { describe, it, expect } from 'vitest';
import {
  classifyToolResult,
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
    it('classifies ERROR status with error string', () => {
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
      // Covers external plugins that still pass a serialized SDK Status object.
      // The object status is not a recognized string so errorCode falls back to UNKNOWN;
      // the error string is still surfaced correctly.
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
