import { describe, it, expect } from 'vitest';
import {
  classifyToolResult,
  transactionToolOutputParser,
  type ToolResultStatus,
} from '@/shared/utils/default-tool-output-parsing';

describe('classifyToolResult', () => {
  describe('success', () => {
    it('classifies a SUCCESS-status envelope as success and lifts transactionId', () => {
      const result = classifyToolResult({
        raw: { status: 'SUCCESS', transactionId: '0.0.1234@1700000000.000000001' },
        humanMessage:
          'Message submitted successfully with transaction id 0.0.1234@1700000000.000000001',
      });

      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.transactionId).toBe('0.0.1234@1700000000.000000001');
        expect(result.humanMessage).toContain('Message submitted');
        expect(result.data).toMatchObject({ status: 'SUCCESS' });
      }
    });

    it('returns success with undefined transactionId when none is present', () => {
      const result = classifyToolResult({
        raw: { status: 'SUCCESS', topicId: '0.0.5678' },
        humanMessage: 'Topic created',
      });

      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.transactionId).toBeUndefined();
      }
    });

    it('preserves the full raw payload via the typed `data` field', () => {
      type CreateTopicData = { status: string; topicId: string; transactionId: string };
      const result = classifyToolResult<CreateTopicData>({
        raw: { status: 'SUCCESS', topicId: '0.0.5678', transactionId: '0.0.1@2.3' },
        humanMessage: 'Topic created',
      });

      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        // Type narrowing: data is typed as CreateTopicData here
        expect(result.data.topicId).toBe('0.0.5678');
        expect(result.data.transactionId).toBe('0.0.1@2.3');
      }
    });

    it('treats RETURN_BYTES mode (no status field, has bytes) as success', () => {
      const result = classifyToolResult({
        raw: { bytes: new Uint8Array([1, 2, 3]) },
        humanMessage: 'Transaction bytes are ready for signing.',
      });

      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.transactionId).toBeUndefined();
        expect((result.data as { bytes: Uint8Array }).bytes).toBeInstanceOf(Uint8Array);
      }
    });
  });

  describe('failure', () => {
    it('classifies an SDK Status object (e.g. InvalidTransaction) as failure with numeric code', () => {
      const result = classifyToolResult({
        raw: {
          status: { _code: 1 },
          error: 'Failed to submit message to topic: INVALID_TRANSACTION',
        },
        humanMessage: 'Failed to submit message to topic: INVALID_TRANSACTION',
      });

      expect(result.kind).toBe('failure');
      if (result.kind === 'failure') {
        expect(result.errorCode).toBe(1);
        expect(result.error).toContain('INVALID_TRANSACTION');
        expect(result.humanMessage).toContain('Failed to submit');
      }
    });

    it('falls back to humanMessage as `error` when raw.error is missing', () => {
      const result = classifyToolResult({
        raw: { status: { _code: 9 } },
        humanMessage: 'something went wrong',
      });

      expect(result.kind).toBe('failure');
      if (result.kind === 'failure') {
        expect(result.errorCode).toBe(9);
        expect(result.error).toBe('something went wrong');
      }
    });

    it('classifies envelope with raw.error string (no status object) as failure', () => {
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
  });

  describe('parse_error', () => {
    it('classifies PARSE_ERROR-status envelopes as parse_error', () => {
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

    it('classifies missing/null raw as parse_error', () => {
      const result = classifyToolResult({ raw: null as unknown as object, humanMessage: '' });
      expect(result.kind).toBe('parse_error');
    });

    it('classifies non-object raw (string) as parse_error', () => {
      const result = classifyToolResult({ raw: 'oops' as unknown as object, humanMessage: '' });
      expect(result.kind).toBe('parse_error');
      if (result.kind === 'parse_error') {
        expect(result.originalOutput).toBe('oops');
        expect(result.humanMessage).toContain('unexpected format');
      }
    });
  });

  describe('end-to-end with transactionToolOutputParser', () => {
    it('classifies the parser output of a successful submit_topic_message_tool', () => {
      // Shape produced by the kit when a transaction succeeds in EXECUTE_TRANSACTION mode.
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

    it('classifies a malformed parser input as parse_error end-to-end', () => {
      const envelope = transactionToolOutputParser('not-json{');
      const result = classifyToolResult(envelope);
      expect(result.kind).toBe('parse_error');
    });
  });
});
