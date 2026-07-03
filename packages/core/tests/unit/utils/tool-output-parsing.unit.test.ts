import { describe, it, expect } from 'vitest';
import {
  transactionToolOutputParser,
  untypedQueryOutputParser,
  classifyToolResult,
} from '@hashgraph/hedera-agent-kit';

describe('transactionToolOutputParser', () => {
  it('returns PARSE_ERROR on malformed JSON', () => {
    const result = transactionToolOutputParser('not json');
    expect(result.raw.status).toBe('PARSE_ERROR');
  });

  it('returns PARSE_ERROR on unrecognized envelope shape', () => {
    const result = transactionToolOutputParser(JSON.stringify({ foo: 'bar' }));
    expect(result.raw.status).toBe('PARSE_ERROR');
  });

  it('passes through RETURN_BYTES result unchanged (status set by ReturnBytesStrategy)', () => {
    // ReturnBytesStrategy now sets status: 'SUCCESS' before serialization;
    // the parser passes it through without injecting anything itself.
    const input = JSON.stringify({ bytes: [1, 2, 3], status: 'SUCCESS' });
    const result = transactionToolOutputParser(input);
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.bytes).toBeDefined();
  });

  it('passes through EXECUTE_TRANSACTION success unchanged', () => {
    const input = JSON.stringify({
      raw: { status: 'SUCCESS', transactionId: '0.0.1@1234' },
      humanMessage: 'Done',
    });
    const result = transactionToolOutputParser(input);
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBe('0.0.1@1234');
    expect(result.humanMessage).toBe('Done');
  });

  it('passes through EXECUTE_TRANSACTION error shape unchanged', () => {
    const input = JSON.stringify({
      raw: { status: { _code: 10 }, error: 'Failed to execute' },
      humanMessage: 'Failed to execute',
    });
    const result = transactionToolOutputParser(input);
    expect(result.raw.error).toBe('Failed to execute');
  });
});

describe('untypedQueryOutputParser', () => {
  it('returns PARSE_ERROR on malformed JSON', () => {
    const result = untypedQueryOutputParser('not json');
    expect(result.raw.status).toBe('PARSE_ERROR');
  });

  it('returns PARSE_ERROR when envelope is missing raw or humanMessage', () => {
    const result = untypedQueryOutputParser(JSON.stringify({ data: 42 }));
    expect(result.raw.status).toBe('PARSE_ERROR');
  });

  it('passes through query success raw unchanged (status set by the tool coreAction)', () => {
    // Query tools now set status: 'SUCCESS' in their coreAction; the parser is passive.
    const input = JSON.stringify({
      raw: { current_rate: { cent_equivalent: 300 }, timestamp: '123', status: 'SUCCESS' },
      humanMessage: 'Rate fetched',
    });
    const result = untypedQueryOutputParser(input);
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.current_rate.cent_equivalent).toBe(300);
  });

  it('passes through query error raw unchanged', () => {
    const input = JSON.stringify({
      raw: { status: 'ERROR', error: 'Failed to get rate' },
      humanMessage: 'Failed to get rate',
    });
    const result = untypedQueryOutputParser(input);
    expect(result.raw.status).toBe('ERROR');
    expect(result.raw.error).toBe('Failed to get rate');
  });
});

describe('classifyToolResult', () => {
  it('classifies executed transaction success', () => {
    expect(
      classifyToolResult({
        raw: { status: 'SUCCESS', transactionId: '0.0.1@1234' },
        humanMessage: 'Done',
      }),
    ).toMatchObject({ kind: 'success' });
  });

  it('classifies RETURN_BYTES success (status set by ReturnBytesStrategy)', () => {
    expect(
      classifyToolResult({
        raw: { bytes: new Uint8Array([1, 2, 3]), status: 'SUCCESS' },
        humanMessage: 'Transaction bytes are ready for signing.',
      }),
    ).toMatchObject({ kind: 'success' });
  });

  it('classifies query tool success (status set by coreAction)', () => {
    expect(
      classifyToolResult({
        raw: { current_rate: { cent_equivalent: 300 }, status: 'SUCCESS' },
        humanMessage: 'Rate fetched',
      }),
    ).toMatchObject({ kind: 'success' });
  });

  it('classifies parse error', () => {
    expect(
      classifyToolResult({
        raw: { status: 'PARSE_ERROR', error: 'bad json', originalOutput: '...' },
        humanMessage: 'Error: Failed to parse tool output.',
      }),
    ).toMatchObject({ kind: 'parse_error' });
  });

  it('classifies query tool error (string ERROR status + error field)', () => {
    expect(
      classifyToolResult({
        raw: { status: 'ERROR', error: 'Failed to get account' },
        humanMessage: 'Failed to get account',
      }),
    ).toMatchObject({ kind: 'failure' });
  });

  it('classifies BaseTool.handleError output (ERROR status + error field)', () => {
    expect(
      classifyToolResult({
        raw: { status: 'ERROR', error: 'Failed to execute tool' },
        humanMessage: 'Failed to execute tool',
      }),
    ).toMatchObject({ kind: 'failure' });
  });

  it('classifies custom transaction tool handleError output (serialized SDK Status + error)', () => {
    expect(
      classifyToolResult({
        raw: { status: { _code: 10 }, error: 'Failed to submit' },
        humanMessage: 'Failed to submit',
      }),
    ).toMatchObject({ kind: 'failure' });
  });

  it('classifies unrecognized string status with no error as unknown — not success', () => {
    // This is the gap case: a tool returning { status: 'FAILED' } without an
    // error field would have silently passed as success before this fix.
    expect(
      classifyToolResult({
        raw: { status: 'FAILED' },
        humanMessage: 'Something went wrong',
      }),
    ).toMatchObject({ kind: 'unknown' });
  });

  it('classifies null raw as parse_error', () => {
    expect(classifyToolResult({ raw: null as any, humanMessage: '' })).toMatchObject({
      kind: 'parse_error',
    });
  });

  it('parse_error takes precedence over failure when both status and error are present', () => {
    // parse errors set both status: 'PARSE_ERROR' and error — PARSE_ERROR wins
    expect(
      classifyToolResult({
        raw: { status: 'PARSE_ERROR', error: 'bad', originalOutput: '' },
        humanMessage: '',
      }),
    ).toMatchObject({ kind: 'parse_error' });
  });
});
